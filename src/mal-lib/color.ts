import chroma from 'chroma-js'
import {MalSymbol, MalList, MalVal} from '@/mal/types'

const Exports = [
	[
		'color/mix',
		function (color1: string, color2: string, ratio: number, mode = 'lrgb') {
			return chroma.mix(color1, color2, ratio, mode as any).css()
		},
	],
	[
		'color/brighten',
		function (color: string, value = 1) {
			return chroma(color)
				.brighten(value as number)
				.hex()
		},
	],
	[
		'color/darken',
		function (color: string, value = 1) {
			return chroma(color)
				.darken(value as number)
				.hex()
		},
	],
	[
		'color/invert',
		function (color: string, mode: 'rgb' | 'hsl' = 'rgb') {
			const c = chroma(color)
			const a = c.alpha()
			if (mode === 'rgb') {
				const [r, g, b] = c.rgb()
				return chroma([255 - r, 255 - g, 255 - b, a]).hex()
			} else if (mode === 'hsl') {
				const [h, s, l] = c.hsl()
				return chroma((h + 180) % 360, 1 - s, 1 - l, 'hsl').hex()
			}
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
