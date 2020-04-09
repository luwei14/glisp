import {MalVal, MalFunc, MalAtom, cloneAST} from './types'
import printExp, {printer} from './printer'
import readStr from './reader'

function _error(e: string) {
	throw new Error(e)
}

// String functions
function slurp(url: string) {
	const req = new XMLHttpRequest()
	req.open('GET', url, false)
	req.send()
	if (req.status !== 200) {
		_error(`Failed to slurp file: ${url}`)
	}
	return req.responseText
}

export const coreNS = new Map<string, any>([
	[
		'throw',
		(a: any) => {
			throw a
		}
	],

	['nil?', (a: MalVal) => a === null],
	['true?', (a: MalVal) => a === true],
	['false?', (a: MalVal) => a === false],
	['number?', (a: MalVal) => typeof a === 'number'],
	['string?', (a: MalVal) => typeof a === 'string'],
	['symbol', (a: string) => Symbol.for(a)],
	['symbol?', (a: MalVal) => typeof a === 'symbol'],
	['fn?', (a: MalVal) => typeof a === 'function' && !(a as MalFunc).ismacro],
	[
		'macro?',
		(a: MalVal) => typeof a === 'function' && !!(a as MalFunc).ismacro
	],

	// Compare
	['=', (a: MalVal, b: MalVal) => a === b],
	['!=', (a: MalVal, b: MalVal) => a !== b],
	['<', (a: number, b: number) => a < b],
	['<=', (a: number, b: number) => a <= b],
	['>', (a: number, b: number) => a > b],
	['>=', (a: number, b: number) => a >= b],

	['or', (...a: MalVal[]) => a.reduce((x, y) => x || y, false)],
	['and', (...a: MalVal[]) => a.reduce((x, y) => x && y, true)],

	// Calculus
	['+', (...a: number[]) => a.reduce((x, y) => x + y, 0)],
	[
		'-',
		(i: number, ...a: number[]) =>
			a.length ? a.reduce((x, y) => x - y, i) : -i
	],
	['*', (...args: number[]) => args.reduce((a, b) => a * b, 1)],
	[
		'/',
		(i: number, ...a: number[]) =>
			a.length ? a.reduce((x, y) => x / y, i) : 1 / i
	],

	['list', (...a: MalVal[]) => a],
	['list?', Array.isArray],

	[
		'nth',
		(a: MalVal[], b: number) =>
			b < a.length ? a[b] : _error('nth: index out of range')
	],
	['first', (a: MalVal[]) => (a !== null && a.length > 0 ? a[0] : null)],
	['rest', (a: MalVal[]) => (a === null ? [] : a.slice(1))],
	[
		'last',
		(a: MalVal[]) => (a !== null && a.length > 0 ? a[a.length - 1] : null)
	],
	['non-last', (a: MalVal[]) => (a === null ? [] : a.slice(0, a.length - 1))],

	['empty?', (l: MalVal[]) => l.length === 0],
	['count', (a: MalVal[]) => (a === null ? 0 : a.length)],
	[
		'apply',
		(f: MalFunc, ...a: MalVal[]) => f(...a.slice(0, -1).concat(a[a.length - 1]))
	],

	['str', (...a: MalVal[]) => a.map(e => printExp(e, false)).join('')],
	[
		'prn',
		(...a: MalVal[]) => {
			printer.log(...a.map(e => printExp(e, true)))
			return null
		}
	],
	[
		'println',
		(...a: MalVal[]) => {
			printer.log(...a.map(e => printExp(e, false)))
			return null
		}
	],

	['read-string', readStr],
	['slurp', slurp],

	['cons', (a: MalVal, b: MalVal) => [a].concat(b)],
	['push', (a: MalVal[], b: MalVal) => [...a, b]],
	[
		'concat',
		(...args: MalVal[]) => args.reduce((x: MalVal[], y) => x.concat(y), [])
	],

	['meta', (a: MalVal) => (a as any)?.meta || null],
	[
		'with-meta',
		(a: MalVal, m: any) => {
			const c = cloneAST(a)
			;(c as any).meta = m
			return c
		}
	],
	['atom', (a: MalVal) => new MalAtom(a)],
	['atom?', (a: MalVal) => a instanceof MalAtom],
	['deref', (atm: MalAtom) => atm.val],
	['reset!', (atm: MalAtom, a: MalVal) => (atm.val = a)],
	[
		'swap!',
		(atm: MalAtom, fn: MalFunc, ...args: any) =>
			(atm.val = fn(...[atm.val].concat(args)))
	],

	// Conditionals
	[
		'range',
		(...args: number[]) => {
			let start = 0,
				end = 0,
				step = 1

			if (args.length === 1) {
				;[end] = args
			} else if (args.length === 2) {
				;[start, end] = args
			} else {
				;[start, end, step] = args
			}

			const arr = []

			for (let i = start; i < end; i += step) {
				arr.push(i)
			}

			return arr
		}
	]
])

// Expose Math
Object.getOwnPropertyNames(Math).forEach(k => coreNS.set(k, (Math as any)[k]))
