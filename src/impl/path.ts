/* eslint-ignore @typescript-eslint/no-use-before-define */
import {vec2} from 'gl-matrix'
import Bezier from 'bezier-js'
import {MalVal} from './types'
import {chunkByCount} from './core'
import {LispError} from './repl'

type PathType = (symbol | number)[]
type SegmentType = [symbol, ...number[]]


const S = Symbol.for

const EPSILON = 1e-5

const SYM_PATH = S('path')
const SYM_M = S('M')
const SYM_L = S('L')
const SYM_C = S('C')
const SYM_Z = S('Z')

const SIN_Q = [0, 1, 0, -1]
const COS_Q = [1, 0, -1, 0]
const TWO_PI = Math.PI * 2
const HALF_PI = Math.PI / 2
const K = (4 * (Math.sqrt(2) - 1)) / 3
const UNIT_QUAD_BEZIER = new Bezier([
	{x: 1, y: 0},
	{x: 1, y: K},
	{x: K, y: 1},
	{x: 0, y: 1}
])

const unsignedMod = (x: number, y: number) => ((x % y) + y) % y

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

function getBezier(points: number[]) {
	const coords = chunkByCount(points, 2).map(([x, y]) => ({x, y}))
	if (coords.length !== 4) {
		throw new LispError('Invalid point count for cubic bezier')
	}
	return new Bezier(coords)
}

export function* iterateSegment(path: PathType): Generator<SegmentType> {
	if (!Array.isArray(path) || path.length < 1) {
		throw new LispError('Invalid path')
	}

	let start = path[0] === SYM_PATH ? 1 : 0

	for (let i = start + 1, l = path.length; i <= l; i++) {
		if (i === l || typeof path[i] === 'symbol') {
			yield path.slice(start, i) as SegmentType
			start = i
		}
	}
}

function* iterateSegmentWithLength(path: PathType): Generator<[SegmentType, number]> {
	let length = 0

	const first = vec2.create()
	const prev = vec2.create()
	const curt = vec2.create()

	for (const seg of iterateSegment(path)) {
		const [cmd, ...points] = seg
		switch (cmd) {
			case SYM_M:
				vec2.copy(first, points as vec2)
				vec2.copy(prev, first)
				break
			case SYM_L:
				vec2.copy(curt, points.slice(-2) as vec2)
				length += vec2.dist(prev, curt)
				vec2.copy(prev, curt)
				break
			case SYM_C: {
				const bezier = getBezier([...(prev as number[]), ...points])
				length += bezier.length()
				vec2.copy(prev, points.slice(-2) as vec2)
				break
			}
			case SYM_Z:
				length += vec2.dist(prev, first)
				break
		}
		yield [seg, length]
	}
}

function pathToBeziers(path: PathType) {
	const ret: PathType = [SYM_PATH]

	for (const line of iterateSegment(path)) {
		const [cmd, ...args] = line

		let sx = 0,
			sy = 0

		switch (cmd) {
			case SYM_M:
			case SYM_C:
				;[sx, sy] = args
				ret.push(...line)
				break
			case SYM_Z:
				ret.push(...line)
				break
			case SYM_L:
				ret.push(SYM_L, sx, sy, ...args, ...args)
				break
			default:
				throw new Error(
					`Invalid d-path command: ${
					typeof cmd === 'symbol' ? Symbol.keyFor(cmd) : cmd
					}`
				)
		}
	}
	return ret
}

function pathLength(path: PathType) {
	const segs = Array.from(iterateSegmentWithLength(path))
	return segs.slice(-1)[0][1]
}

function positionAtLength(len: number, path: PathType) {
	const segs = Array.from(iterateSegmentWithLength(path))
	const length = segs.slice(-1)[0][1]

	len = clamp(len, 0, length)

	const first = vec2.create()
	const prev = vec2.create()
	const curt = vec2.create()
	let startLen = 0

	for (let i = 0; i < segs.length; i++) {
		const [[cmd, ...points], endLen] = segs[i]
		if (cmd === SYM_M) {
			vec2.copy(first, points as vec2)
		}
		vec2.copy(curt, cmd === SYM_Z ? first : points.slice(-2) as vec2)

		if (len <= endLen) {
			const t = (len - startLen) / (endLen - startLen)

			switch (cmd) {
				case SYM_M:
					return [...curt]
				case SYM_L:
				case SYM_Z:
					vec2.lerp(prev, prev, curt, t)
					return [...prev]
				case SYM_C: {
					const bezier = getBezier([...prev, ...points])
					const {x, y} = bezier.get(t)
					return [x, y]
				}
				default:
					throw new LispError('Dont know why...')
			}
		}

		vec2.copy(prev, curt)
		startLen = endLen
	}

}

function positionAt(t: number, path: PathType) {
	const length = pathLength(path)
	return positionAtLength(t * length, path)
}

function arc(
	x: number,
	y: number,
	r: number,
	start: number,
	end: number
): MalVal[] {
	const min = Math.min(start, end)
	const max = Math.max(start, end)

	let points: number[][] = [[x + r * Math.cos(min), y + r * Math.sin(min)]]

	const minSeg = Math.ceil(min / HALF_PI - EPSILON)
	const maxSeg = Math.floor(max / HALF_PI + EPSILON)

	// For trim
	const t1 = unsignedMod(min / HALF_PI, 1)
	const t2 = unsignedMod(max / HALF_PI, 1)

	// quadrant
	//  2 | 3
	// ---+---
	//  1 | 0
	if (minSeg > maxSeg) {
		// Less than 90 degree
		const bezier = UNIT_QUAD_BEZIER.split(t1, t2)
		const q = unsignedMod(Math.floor(min / HALF_PI), 4),
			sin = SIN_Q[q],
			cos = COS_Q[q]

		points.push(
			...bezier.points
				.slice(1)
				.map(p => [
					x + r * (p.x * cos - p.y * sin),
					y + r * (p.x * sin + p.y * cos)
				])
		)
	} else {
		// More than 90 degree

		// Add beginning segment
		if (Math.abs(minSeg * HALF_PI - min) > EPSILON) {
			const bezier = UNIT_QUAD_BEZIER.split(t1, 1)
			const q = unsignedMod(minSeg - 1, 4),
				sin = SIN_Q[q],
				cos = COS_Q[q]

			points.push(
				...bezier.points
					.slice(1)
					.map(p => [
						x + r * (p.x * cos - p.y * sin),
						y + r * (p.x * sin + p.y * cos)
					])
			)
		}

		// Cubic bezier points of the quarter circle in quadrant 0 in position [0, 0]
		const qpoints: number[][] = [
			[r, K * r],
			[K * r, r],
			[0, r]
		]

		// Add arc by every quadrant
		for (let seg = minSeg; seg < maxSeg; seg++) {
			const q = unsignedMod(seg, 4),
				sin = SIN_Q[q],
				cos = COS_Q[q]
			points.push(
				...qpoints.map(([px, py]) => [
					x + px * cos - py * sin,
					y + px * sin + py * cos
				])
			)
		}

		// Add terminal segment
		if (Math.abs(maxSeg * HALF_PI - max) > EPSILON) {
			const bezier = UNIT_QUAD_BEZIER.split(0, t2)
			const q = unsignedMod(maxSeg, 4),
				sin = SIN_Q[q],
				cos = COS_Q[q]

			points.push(
				...bezier.points
					.slice(1)
					.map(p => [
						x + r * (p.x * cos - p.y * sin),
						y + r * (p.x * sin + p.y * cos)
					])
			)
		}
	}

	if (end < start) {
		points = points.reverse()
	}

	return [
		SYM_PATH,
		S('M'),
		...points[0],
		...chunkByCount(points.slice(1), 3)
			.map(pts => [S('C'), ...pts.flat()])
			.flat()
	]
}

function offsetBezier(...args: number[]) {
	const bezier = getBezier(args.slice(0, 8))

	if (bezier.length() < EPSILON) {
		return false
	}

	const d = args[8]

	const offset = bezier.offset(d)

	const {x, y} = offset[0].points[0]

	const ret = [SYM_M, x, y]

	for (const seg of offset) {
		const pts = seg.points
		ret.push(SYM_C)
		for (let i = 1; i < 4; i++) {
			ret.push(pts[i].x, pts[i].y)
		}
	}

	return ret
}

function offsetLine(a: vec2, b: vec2, d: number) {
	if (vec2.equals(a, b)) {
		return false
	}

	const dir = vec2.create()

	vec2.sub(dir, b, a)
	vec2.rotate(dir, dir, [0, 0], Math.PI / 2)
	vec2.normalize(dir, dir)
	vec2.scale(dir, dir, d)

	const oa = vec2.create()
	const ob = vec2.create()

	vec2.add(oa, a, dir)
	vec2.add(ob, b, dir)

	return [SYM_M, ...oa, SYM_L, ...ob] as PathType
}

function isPathClosed(path: PathType) {
	return path.slice(-1)[0] === SYM_Z
}

function getTurnAngle(from: vec2, through: vec2, to: vec2): number {
	// A --- B----
	//        \  <- this angle
	//         \
	//          C
	// Returns positive angle if ABC is CW, else negative

	const AB = vec2.create()
	const BC = vec2.create()

	vec2.sub(AB, through, from)
	vec2.sub(BC, to, through)

	const angle = vec2.angle(AB, BC)

	// Rotate AB 90 degrees in CW
	vec2.rotate(AB, AB, [0, 0], HALF_PI)
	const rot = Math.sign(vec2.dot(AB, BC))

	return angle * rot
}

function getPathRotation(path: PathType): number {
	// Returns +1 if the path is clock-wise and -1 when CCW.
	// Returns 0 if the direction is indeterminate
	// like when the path is opened or 8-shaped.

	// Indeterminate case: the path is opened
	if (!isPathClosed(path)) {
		return 0
	}

	const segments = Array.from(iterateSegment(path))

	// Remove the last (Z)
	segments.pop()

	// Indeterminate case: the vertex of the path is < 3
	if (segments.length < 3) {
		return 0
	}

	// Extract only vertex points
	const points = segments.map(seg => seg.slice(-2)) as number[][]
	const numpt = points.length

	let rot = 0

	for (let i = 0; i < numpt; i++) {
		const last = points[(i - 1 + numpt) % numpt]
		const curt = points[i]
		const next = points[(i + 1) % numpt]

		rot += getTurnAngle(last as vec2, curt as vec2, next as vec2)
	}

	return Math.sign(Math.round(rot))
}

function pathOffset(d: number, path: PathType) {
	const isClockwise = getPathRotation(path) === 1

	if (isClockwise) {
		d *= -1
	}

	if (!Array.isArray(path) || path[0] !== SYM_PATH) {
		throw new Error('Invalid path')
	} else {
		const ret: PathType = [SYM_PATH]
		const commands = path.slice(1)

		//       loff   foff
		//----------|  /\
		//          | /  \
		//----------|/    \
		//      lorig\     \
		//            \     \

		const lorig = vec2.create() // original last
		const forig = vec2.create() // original first
		const loff = vec2.create() // last offset
		const foff = vec2.create() // forig offset

		const dirLast = vec2.create()
		const dirNext = vec2.create()

		const makeRoundCorner = (origin: vec2, last: vec2, next: vec2) => {

			// dont know why this order
			vec2.sub(dirLast, last, origin)
			vec2.sub(dirNext, next, origin)

			if (d < 0) {
				vec2.scale(dirLast, dirLast, -1)
				vec2.scale(dirNext, dirNext, -1)
			}

			const angle = vec2.angle(dirLast, dirNext)

			// Turn left or right
			vec2.rotate(dirLast, dirLast, [0, 0], HALF_PI)
			const turn = Math.sign(vec2.dot(dirLast, dirNext))

			const start = Math.atan2(dirLast[1], dirLast[0])
			const end = start - angle * turn

			return arc(origin[0], origin[1], d, start, end).slice(1) as PathType
		}

		let continued = false

		let cmd, args
		for ([cmd, ...args] of iterateSegment(commands)) {
			if (cmd === SYM_M) {
				vec2.copy(forig, args as vec2)
				vec2.copy(lorig, forig)
			} else if (cmd === SYM_L || cmd === SYM_C || cmd === SYM_Z) {
				if (cmd === SYM_Z) {
					args = forig as number[]
				}

				let off =
					cmd === SYM_C
						? offsetBezier(...lorig, ...(args as number[]), d)
						: offsetLine(lorig, args as vec2, d)
				if (off) {
					if (continued) {
						if (vec2.equals(loff, off.slice(1) as vec2)) {
							off = off.slice(3) // remove (M 0 1)
						} else {
							// make a bevel
							const corner = makeRoundCorner(lorig, loff, off.slice(1, 3) as vec2)
							// (M x y # ...) + (M x y # ...)
							off = [...corner.slice(3), ...off.slice(3)]
							// make a chamfer Bevel
							// off[0] = S('L')
						}
					} else {
						// First time to offset
						continued = true
						vec2.copy(foff, off.slice(1, 3) as vec2)
					}
					ret.push(...off)
					vec2.copy(lorig, args.slice(-2) as vec2)
					vec2.copy(loff, off.slice(-2) as vec2)
				}
			}

			if (cmd === SYM_Z) {
				// Make a bevel corner
				const corner = makeRoundCorner(lorig, loff, foff)
				ret.push(...corner.slice(3), SYM_Z)
				// Chanfer
				// ret.push(SYM_Z)

				continued = false
			}
		}
		return ret
	}
}

export const pathNS = new Map<string, any>([
	['arc', arc],
	['path/to-beziers', pathToBeziers],
	['path/offset', pathOffset],
	['path/length', pathLength],
	['path/closed?', isPathClosed],
	['path/position-at-length', positionAtLength],
	['path/position-at', positionAt],
	[
		'path/split-segments',
		([_, ...path]: PathType) => Array.from(iterateSegment(path))
	]
])
