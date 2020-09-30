import {MalVal, MalSymbol, MalVector, MalNumber, MalList} from '@/mal/types'
import hull from 'hull.js'
import BezierEasing from 'bezier-easing'
import Delaunator from 'delaunator'
import {partition} from '@/utils'

const Exports = [
	[
		'convex-hull',
		(pts: [number, number][], concavity: number | null = null) => {
			return MalVector.create(
				...hull(pts, concavity === null ? Infinity : concavity).map(([a, b]) =>
					MalVector.create(MalNumber.create(a), MalNumber.create(b))
				)
			)
		},
	],
	[
		'delaunay',
		(pts: [number, number][]) => {
			const delaunay = Delaunator.from(pts)
			return MalVector.create(
				...partition(3, delaunay.triangles).map(([a, b, c]) => [
					MalVector.create(...pts[a]),
					MalVector.create(...pts[b]),
					MalVector.create(...pts[c]),
				])
			)
		},
	],
	[
		'cubic-bezier',
		(x1: number, y1: number, x2: number, y2: number, t: number) => {
			const easing = BezierEasing(x1, y1, x2, y2)
			return MalNumber.create(easing(Math.min(Math.max(0, t), 1)))
		},
	],
] as [string, MalVal][]

const Exp = MalList.create(
	MalSymbol.create('do'),
	...Exports.map(([sym, body]) =>
		MalList.create(MalSymbol.create('def'), MalSymbol.create(sym), body)
	)
)
;(globalThis as any)['glisp_library'] = Exp

export default Exp
