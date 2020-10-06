import seedrandom from 'seedrandom'
import {
	MalVal,
	MalSymbol,
	MalList,
	MalMap,
	MalError,
	MalAtom,
	isMalSeq,
	MalVector,
	MalBoolean,
	MalString,
	MalKeyword,
	MalNil,
	MalNumber,
	MalFunc,
	MalMacro,
	MalSeq,
	MalF,
} from '@/mal/types'
import printExp from '@/mal/printer'
import {partition} from '@/utils'
import isNodeJS from 'is-node'

const Exports = [
	['type', (x: MalVal) => MalKeyword.create(x.type)],
	['nil?', (x: MalVal) => MalBoolean.create(MalNil.is(x))],
	['true?', (x: MalVal) => MalBoolean.create(x.value === true)],
	['false?', (x: MalVal) => MalBoolean.create(x.value === false)],
	['boolean?', (x: MalVal) => MalBoolean.create(MalBoolean.is(x))],
	['number?', (x: MalVal) => MalBoolean.create(MalNumber.is(x))],
	['string?', (x: MalVal) => MalBoolean.create(MalString.is(x))],
	['keyword?', (x: MalVal) => MalBoolean.create(MalKeyword.is(x))],
	['fn?', (x: MalVal) => MalBoolean.create(MalFunc.is(x))],
	['macro?', (x: MalVal) => MalBoolean.create(MalMacro.is(x))],

	['keyword', (x: MalString) => MalKeyword.create(x.value)],
	['symbol', (x: MalString) => MalSymbol.create(x.value)],
	['symbol?', (x: MalVal) => MalBoolean.create(MalSymbol.is(x))],

	// // Compare
	['=', (a: MalVal, b: MalVal) => MalBoolean.create(a.equals(b))],
	['!=', (a: MalVal, b: MalVal) => MalBoolean.create(!a.equals(b))],
	['<', (a: MalNumber, b: MalNumber) => MalBoolean.create(a.value < b.value)],
	['<=', (a: MalNumber, b: MalNumber) => MalBoolean.create(a.value <= b.value)],
	['>', (a: MalNumber, b: MalNumber) => MalBoolean.create(a.value > b.value)],
	['>=', (a: MalNumber, b: MalNumber) => MalBoolean.create(a.value >= b.value)],

	// Calculus
	[
		'+',
		(...a: MalNumber[]) => MalNumber.create(a.reduce((x, y) => x + y.value, 0)),
	],
	[
		'-',
		(...xs: MalNumber[]) => {
			switch (xs.length) {
				case 0:
					return MalNumber.create(0)
				case 1:
					return MalNumber.create(-xs[0].value)
				case 2:
					return MalNumber.create(xs[0].value - xs[1].value)
				default:
					return MalNumber.create(
						xs.slice(1).reduce((a, b) => a - b.value, xs[0].value)
					)
			}
		},
	],
	[
		'*',
		(...args: MalNumber[]) =>
			MalNumber.create(args.reduce((a, b) => a * b.value, 1)),
	],
	[
		'/',
		(...xs: MalNumber[]) => {
			switch (xs.length) {
				case 0:
					return MalNumber.create(1)
				case 1:
					return MalNumber.create(1 / xs[0].value)
				case 2:
					return MalNumber.create(xs[0].value / xs[1].value)
				default:
					return MalNumber.create(
						xs.slice(1).reduce((a, b) => a / b.value, xs[0].value)
					)
			}
		},
	],
	[
		'mod',
		(x: MalNumber, y: MalNumber) => {
			const _x = x.value
			const _y = y.value
			MalNumber.create(((_x % _y) + _y) % _y)
		},
	],

	// Array
	['list', (...coll: MalVal[]) => MalList.create(...coll)],
	['lst', (coll: MalSeq) => MalList.create(...coll.value)],
	['list?', (x: MalVal) => MalBoolean.create(MalList.is(x))],

	['vector', (...xs: MalVal[]) => MalVector.create(...xs)],
	['vector?', (x: MalVal) => MalBoolean.create(MalVector.is(x))],
	['vec', (a: MalSeq) => MalVector.create(...a.value)],
	['sequential?', (x: MalVal) => MalBoolean.create(isMalSeq(x))],
	[
		'seq',
		(a: MalVal) => {
			if (isMalSeq(a)) {
				return a.clone()
			} else if (MalString.is(a)) {
				return MalVector.create(...a.value.split('').map(MalString.create))
			} else if (MalMap.is(a)) {
				return MalVector.create(
					...a
						.entries()
						.map(([k, v]) => MalVector.create(MalString.create(k), v))
				)
			} else {
				return MalNil.create()
			}
		},
	],
	[
		'nth',
		(a: MalSeq, index: MalNumber) => {
			if (!MalNumber.is(index)) {
				throw new MalError('index argument to nth must be a number')
			}

			const i = index.value

			if (i < 0 && -i <= a.length) {
				return a.get(a.length - i)
			} else if (i < a.length) {
				return a.get(i)
			}

			throw new MalError('index out of range')
		},
	],
	[
		'first',
		(a: MalSeq) => (a !== null && a.length > 0 ? a.get(0) : MalNil.create()),
	],
	[
		'rest',
		(a: MalSeq) =>
			a === null ? MalVector.create() : MalVector.create(...a.value.slice(1)),
	],
	[
		'last',
		(a: MalSeq) => (a.length > 0 ? a.get(a.length - 1) : MalNil.create()),
	],
	[
		'butlast',
		(a: MalSeq) => MalVector.create(...a.value.slice(0, a.length - 1)),
	],
	['count', (a: MalSeq) => MalNumber.create(a === null ? 0 : a.length)],
	[
		'slice',
		(a: MalSeq, start: MalNumber, end: MalNumber) => {
			if (isMalSeq(a)) {
				return MalVector.create(...a.value.slice(start.value, end.value))
			} else {
				throw new MalError(`[slice] ${printExp(a)} is not an array`)
			}
		},
	],
	[
		'apply',
		(f: MalFunc, ...a: MalSeq[]) => {
			const args: MalVal[] = []
			a.forEach(x => args.push(...x.value))
			return f.value(...args)
		},
	],
	[
		'map',
		(f: MalFunc, coll: MalSeq) =>
			MalVector.create(...coll.value.map(x => f.value(x))),
	],
	[
		'map-indexed',
		(f: MalFunc, coll: MalSeq) =>
			MalVector.create(
				...coll.value.map((x, i) => f.value(MalNumber.create(i), x))
			),
	],
	[
		'filter',
		(f: MalFunc, coll: MalSeq) =>
			MalVector.create(...coll.value.filter(x => f.value(x))),
	],
	[
		'remove',
		(f: MalFunc, coll: MalSeq) =>
			MalVector.create(...coll.value.filter(x => !f.value(x))),
	],
	['sort', (coll: MalSeq) => MalVector.create(...[...coll.value].sort())],
	[
		'partition',
		(n: MalNumber, coll: MalSeq) =>
			MalVector.create(
				...partition(n.value, coll.value).map(x => MalVector.create(...x))
			),
	],
	[
		'index-of',
		(coll: MalSeq, a: MalString) => MalNumber.create(coll.value.indexOf(a)),
	],
	[
		'last-index-of',
		(coll: MalSeq, a: MalString) => MalNumber.create(coll.value.lastIndexOf(a)),
	],
	[
		'repeat',
		(a: MalVal, n: MalNumber) =>
			MalVector.create(...Array(n).map(() => a.clone())),
	],
	['reverse', (coll: MalSeq) => MalVector.create(...[...coll.value].reverse())],
	['cons', (a: MalVal, b: MalVal) => MalVector.create(...[a].concat(b))],
	[
		'conj',
		(coll: MalVal, ...xs: MalVal[]) => {
			if (MalList.is(coll)) {
				return MalList.create(...xs.reverse(), ...coll.value)
			} else if (MalVector.is(coll)) {
				return MalVector.create(...coll.value, ...xs)
			}
		},
	],
	[
		'concat',
		(...xs: MalVal[]) => MalVector.create(...xs.map(x => x.value).flat()),
	],
	[
		'join',
		(separator: MalString, coll: MalSeq) =>
			MalString.create(
				coll.value.map(v => printExp(v, false)).join(separator.value)
			),
	],

	// Map
	['hash-map', (...a: MalVal[]) => MalMap.fromMalSeq(...a)],
	['map?', (x: MalVal) => MalBoolean.create(MalMap.is(x))],
	['assoc', (m: MalMap, ...pairs: MalVal[]) => m.assoc(...pairs)],
	[
		'get',
		(m: MalMap, a: MalString, notfound: MalVal = MalNil.create()) => {
			if (MalMap.is(m)) {
				return a.value in m.value ? m.value[a.value] : notfound
			} else {
				return notfound
			}
		},
	],
	[
		'contains?',
		(m: MalMap, a: MalVal) =>
			MalBoolean.create(typeof a === 'string' ? a in m : false),
	],
	[
		'entries',
		(a: MalMap) =>
			MalVector.create(
				...a.entries().map(([k, v]) => MalVector.create(MalString.create(k), v))
			),
	],
	[
		'merge',
		(...xs: MalVal[]) => {
			return MalMap.create(
				xs
					.filter(MalMap.is)
					.reduce(
						(ret, m) => ({...ret, ...m.value}),
						{} as {[k: string]: MalVal}
					)
			)
		},
	],

	// String
	[
		'pr-str',
		(...a: MalVal[]) =>
			MalString.create(a.map(e => printExp(e, true)).join(' ')),
	],
	[
		'str',
		(...a: MalVal[]) =>
			MalString.create(a.map(e => printExp(e, false)).join('')),
	],
	[
		'subs',
		(a: MalString, from: MalNumber, to?: MalNumber) =>
			MalString.create(a.value.substr(from.value, to?.value)),
	],

	// Meta
	['meta', x => x.meta],
	['with-meta', (x, meta) => x.withMeta(meta)],
	['with-meta-sugar', (meta, x) => x.withMeta(meta)],
	[
		// Atom
		'atom',
		(a: MalVal) => new MalAtom(a),
	],
	['atom?', (a: MalVal) => MalBoolean.create(a instanceof MalAtom)],
	['deref', (atm: MalAtom) => atm.value],
	['reset!', (atm: MalAtom, a: MalVal) => (atm.value = a)],
	[
		'swap!',
		(atm: MalAtom, f: MalFunc, ...args: any) =>
			(atm.value = f.value(atm.value, ...args)),
	],

	// Other useful functions in JS
	[
		'range',
		(...args: MalNumber[]) => {
			const ret = []
			let start = 0,
				end = 0,
				step = Math.sign(end - start)
			if (args.length === 1) {
				end = args[0].value
			} else if (args.length === 2) {
				start = args[0].value
				end = args[1].value
			} else {
				start = args[0].value
				end = args[1].value
				step = args[2].value
			}
			if (start !== end) {
				if ((end - start) * step <= 0) {
					step = Math.sign(end - start) * Math.abs(step) || 1
				}
				for (let i = start; step > 0 ? i < end : i > end; i += step) {
					ret.push(i)
				}
			}
			return MalVector.create(...ret.map(MalNumber.create))
		},
	],
	// Random
	['rnd', (a: MalVal) => MalNumber.create(seedrandom(a.toJS())())],

	// I/O
	[
		'spit',
		(f: MalString, content: MalString) => {
			if (isNodeJS) {
				// eslint-disable-next-line @typescript-eslint/no-var-requires
				const fs = require('fs')
				// eslint-disable-next-line @typescript-eslint/no-var-requires
				const path = require('path')
				fs.writeFileSync(path.join(process.cwd(), f), content.value)
			} else {
				throw new MalError('Cannot spit on browser')
			}

			return MalNil.create()
		},
	],
] as [string, MalF][]

// Expose Math
Object.getOwnPropertyNames(Math).forEach(k =>
	Exports.push([k, (Math as any)[k]])
)

const Exp = MalList.create(
	MalSymbol.create('do'),
	...Exports.map(([sym, body]) =>
		MalList.create(
			MalSymbol.create('def'),
			MalSymbol.create(sym),
			MalFunc.create(body)
		)
	)
)
;(globalThis as any)['glisp_library'] = Exp

export default Exp
