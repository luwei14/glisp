import Env from './env'

export enum MalType {
	// Collections
	List = 'list',
	Vector = 'vector',
	Map = 'map',

	// Atoms
	Number = 'number',
	String = 'string',
	Boolean = 'boolean',
	Nil = 'nil',
	Symbol = 'symbol',
	Keyword = 'keyword',
	Atom = 'atom',

	// Functions
	Function = 'fn',
	Macro = 'macro',
}

export type MalBind = (
	| MalSymbol
	| string
	| {[k: string]: MalSymbol}
	| MalBind
)[]

export enum ExpandType {
	Constant = 1,
	Env,
	Unchange,
}

export interface ExpandInfoConstant {
	type: ExpandType.Constant
	exp: MalVal
}

export interface ExpandInfoEnv {
	type: ExpandType.Env
	exp: MalVal
	env: Env
}

export interface ExpandInfoUnchange {
	type: ExpandType.Unchange
}

export type ExpandInfo = ExpandInfoConstant | ExpandInfoEnv | ExpandInfoUnchange

export interface MalFuncThis {
	callerEnv: Env
}

export abstract class MalVal {
	parent: {ref: MalColl; index: number} | undefined = undefined

	abstract type: MalType
	abstract get evaluated(): MalVal
	abstract toString(): string
	abstract clone(): MalVal
	
	static isType(_: MalVal): boolean {
		return false
	}
}

export type MalColl = MalList | MalVector | MalMap
export type MalSeq = MalList | MalVal

export class MalNumber extends MalVal {
	readonly type: MalType.Number = MalType.Number

	private constructor(public readonly value: number) {
		super()
	}

	get evaluated() {
		return this
	}

	valueOf() {
		return this.value
	}

	toString() {
		return this.value.toFixed(4).replace(/\.?[0]+$/, '')
	}

	clone() {
		return new MalNumber(this.value)
	}

	static isType(value: MalVal) : value is MalNumber {
		return value.type === MalType.Number
	}

	static create(value: number) {
		return new MalNumber(value)
	}
}

export class MalString extends MalVal {
	readonly type: MalType.String = MalType.String

	private constructor(public readonly value: string) {
		super()
	}

	get evaluated() {
		return this
	}

	valueOf() {
		return this.value
	}

	toString() {
		return `"${this.value}"`
	}

	clone() {
		return new MalString(this.value)
	}	

	static isType(value: MalVal) : value is MalString {
		return value.type === MalType.String
	}

	static create(value: string) {
		return new MalString(value)
	}
}

export class MalBoolean extends MalVal {
	readonly type: MalType.Boolean = MalType.Boolean

	private constructor(public readonly value: boolean) {
		super()
	}

	get evaluated() {
		return this
	}

	valueOf() {
		return this.value
	}

	toString() {
		return this.value.toString()
	}

	clone() {
		return new MalBoolean(this.value)
	}

	static isType(value: MalVal) : value is MalBoolean {
		return value.type === MalType.Boolean
	}

	static create(value: boolean) {
		return new MalBoolean(value)
	}
}

export class MalNil extends MalVal {
	readonly type: MalType.Nil = MalType.Nil

	private constructor() {
		super()
	}

	get evaluated() {
		return this
	}

	valueOf() {
		return null
	}

	toString() {
		return 'nil'
	}

	clone() {
		return new MalNil()
	}

	static isType(value: MalVal) : value is MalNil {
		return value.type === MalType.Nil
	}

	static create() {
		return new MalNil()
	}
}

export class MalKeyword extends MalVal {
	readonly type: MalType.Keyword = MalType.Keyword

	private constructor(public readonly value: string) {
		super()
	}

	get evaluated() {
		return this
	}

	toString() {
		return this.value
	}

	clone() {
		return new MalKeyword(this.value)
	}

	static isType(value: MalVal) : value is MalKeyword {
		return value.type === MalType.Keyword
	}

	private static map = new Map<string, MalKeyword>()

	static create(value: string) {
		const cached = this.map.get(value)
		if (cached) {
			return cached
		}

		const token = new MalKeyword(value)
		this.map.set(value, token)

		return token
	}
}

export class MalList extends MalVal {
	readonly type: MalType.List = MalType.List

	public delimiters: string[] | undefined = undefined
	public str: string | undefined = undefined
	private _evaluated: MalVal | undefined = undefined

	constructor(private readonly value: MalVal[]) {
		super()
	}

	set evaluated(value: MalVal) {
		this._evaluated = value
	}

	get evaluated(): MalVal {
		return this._evaluated || this
	}

	toString() {
		if (this.str === undefined) {
			if (!this.delimiters) {
				this.delimiters =
					this.value.length === 0
						? []
						: ['', ...Array(this.value.length - 1).fill(' '), '']
			}

			let str = this.delimiters[0]
			for (let i = 0; i < this.value.length; i++) {
				str += this.delimiters[i + 1] + this.value[i]?.toString()
			}
			str += this.delimiters[this.delimiters.length - 1]

			this.str = '(' + str + ')'
		}

		return this.str
	}

	clone() {
		const list = new MalList(this.value.map(v => v.clone()))
		if (this.delimiters) {
			list.delimiters = [...this.delimiters]
		}
		list.str = this.str
		return list
	}

	static isType(value: MalVal) : value is MalList {
		return value.type === MalType.List
	}

	static create(...value: MalVal[]) {
		return new MalList(value)
	}
}

export class MalVector extends MalVal {
	readonly type: MalType.Vector = MalType.Vector

	public delimiters: string[] | undefined = undefined
	public str: string | undefined = undefined
	private _evaluated: MalVector | undefined = undefined

	constructor(private readonly value: MalVal[]) {
		super()
	}

	set evaluated(value: MalVector) {
		this._evaluated = value
	}

	get evaluated(): MalVector {
		return this._evaluated || this
	}

	toString() {
		if (this.str === undefined) {
			if (!this.delimiters) {
				this.delimiters =
					this.value.length === 0
						? ['']
						: ['', ...Array(this.value.length - 1).fill(' '), '']
			}

			let str = this.delimiters[0]
			for (let i = 0; i < this.value.length; i++) {
				str += this.delimiters[i + 1] + this.value[i]?.toString()
			}
			str += this.delimiters[this.delimiters.length - 1]

			this.str = '[' + str + ']'
		}

		return this.str
	}

	clone() {
		const list = new MalVector(this.value.map(v => v.clone()))
		if (this.delimiters) {
			list.delimiters = [...this.delimiters]
		}
		list.str = this.str
		return list
	}

	static isType(value: MalVal) : value is MalVector {
		return value.type === MalType.Vector
	}

	static create(...value: MalVal[]) {
		return new MalVector(value)
	}
}

export class MalMap extends MalVal {
	readonly type: MalType.Map = MalType.Map

	public delimiters: string[] | undefined = undefined
	public str: string | undefined = undefined
	public _evaluated: MalMap | undefined = undefined

	constructor(readonly value: {[key: string]: MalVal} | T) {
		super()
	}

	set evaluated(value: MalMap) {
		this._evaluated = value
	}

	get evaluated(): MalMap {
		return this._evaluated || this
	}

	toString() {
		if (this.str === undefined) {
			const entries = Object.entries(this.value)

			if (!this.delimiters) {
				const size = entries.length
				this.delimiters =
					this.value.length === 0
						? ['']
						: ['', ...Array(size * 2 - 1).fill(' '), '']
			}

			let str = ''
			for (let i = 0; i < entries.length; i++) {
				const [k, v] = entries[i]
				str +=
					this.delimiters[2 * i + 1] +
					`:${k}` +
					this.delimiters[2 * 1 + 2] +
					v?.toString()
			}
			str += this.delimiters[this.delimiters.length - 1]

			this.str = '{' + str + '}'
		}

		return this.str
	}

	clone() {
		const list = new MalMap(this.value)
		if (this.delimiters) {
			list.delimiters = [...this.delimiters]
		}
		list.str = this.str
		return list
	}

	static isType(value: MalVal) : value is MalMap {
		return value.type === MalType.Map
	}

	static create(value: {[key: string]: MalVal}) {
		return new MalMap(value)
	}

	static fromMalColl(...coll: MalVal[]) {
		const map: {[key: string]: MalVal} = {}

		for (let i = 0; i + 1 < coll.length; i += 1) {
			const k = coll[i]
			const v = coll[i + 1]
			if (MalKeyword.isType(k) || MalString.isType(k)) {
				map[getName(k)] = v
			} else {
				throw new MalError(
					`Unexpected key symbol: ${k.type}, expected: keyword or string`
				)
			}
		}

		return new MalMap(map)
	}
}

type MalF = (
	this: MalFuncThis | void,
	...args: (MalVal | undefined)[]
) => MalVal

export class MalFunction extends MalVal {
	readonly type: MalType.Function = MalType.Function
	value!: MalF

	exp!: MalVal | undefined
	env!: Env
	params!: MalVal
	meta!: MalVal
	isMacro!: boolean

	private constructor() {
		super()
	}

	get evaluated() {
		return this
	}

	toString() {
		if (this.exp) {
			const keyword = this.isMacro ? 'macro' : 'fn'
			return `(${keyword} ${this.params.toString()} ${MalVal})`
		} else {
			return `#<JS Function>`
		}
	}

	clone() {
		const f = new MalFunction()
		f.value = this.value
		f.exp = this.exp?.clone()
		f.env = this.env
		f.params = this.params.clone()
		f.meta = this.meta.clone()
		f.isMacro = this.isMacro

		return f
	}

	static isType(value: MalVal) : value is MalFunction {
		return value.type === MalType.Function
	}

	static create(func: MalF) {
		const f = new MalFunction()
		f.value = func
		f.isMacro = false
	}

	static fromMal(
		func: MalF,
		exp: MalVal,
		env: Env,
		params: MalVal,
		meta: MalVal = MalNil.create(),
		isMacro = false
	): MalFunction {

		const f = new MalFunction()

		f.value = func
		f.exp = exp
		f.env = env
		f.params = params
		f.meta = meta
		f.isMacro = isMacro

		return f
	}
}

export function createMap(map: any) {
	return map as MalMap
}

export class MalError extends Error {}

// Expand
function expandSymbolsInExp(exp: MalVal, env: Env): MalVal {
	const type = exp.type
	switch (type) {
		case MalType.List:
		case MalType.Vector: {
			let ret = (exp as MalVal[]).map(val => expandSymbolsInExp(val, env))
			if (type === MalType.List) {
				ret = MalList.create(...ret)
			}
			return ret
		}
		case MalType.Map: {
			const ret = {} as MalMap
			Object.entries(exp as MalMap).forEach(([key, val]) => {
				ret[key] = expandSymbolsInExp(val, env)
			})
			return ret
		}
		case MalType.Symbol:
			if (env.hasOwn(exp as MalSymbol)) {
				return env.get(exp as MalSymbol)
			} else {
				return exp
			}
		default:
			return exp
	}
}

export function setExpandInfo(exp: MalSeq, info: ExpandInfo) {
	exp[M_EXPAND] = info
}

export function expandExp(exp: MalVal) {
	if (MalList.isType((exp) && M_EXPAND in exp) {
		const info = exp[M_EXPAND]
		switch (info.type) {
			case ExpandType.Constant:
				return info.exp
			case ExpandType.Env:
				return expandSymbolsInExp(info.exp, info.env)
			case ExpandType.Unchange:
				return exp
		}
	} else {
		return exp.evaluated
	}
}

export const isMalColl = (v: MalVal | undefined): v is MalColl => {
	const type = v?.type
	return (
		type === MalType.List || type === MalType.Map || type === MalType.Vector
	)
}

export const isMalSeq = (v: MalVal | undefined): v is MalSeq => {
	return v?.type === MalType.Vector || v?.type === MalType.List
}


export function getName(exp: MalVal): string {
	switch (exp.type) {
		case MalType.String:
			return (exp as MalString).value
		case MalType.Keyword:
			return (exp as MalKeyword).value
		case MalType.Symbol:
			return (exp as MalSymbol).value
		default:
			throw new MalError(
				'getName() can only extract the name by string/keyword/symbol'
			)
	}
}

// Symbol
export class MalSymbol extends MalVal {
	public readonly type: MalType.Symbol = MalType.Symbol
	private _def!: MalSeq | undefined
	private _evaluated!: MalVal | undefined

	private constructor(public readonly value: string) {
		super()
	}

	set evaluated(value: MalVal) {
		this._evaluated = value
	}

	get evaluated(): MalVal {
		return this._evaluated || this
	}


	set def(def: MalSeq | undefined) {
		this._def = def
	}

	get def(): MalSeq | undefined {
		return this._def || undefined
	}

	toString() {
		return this.value
	}

	clone() {
		return new MalSymbol(this.value)
	}

	static create(identifier: string) {
		return new MalSymbol(identifier)
	}
}

// Atoms
export class MalAtom extends MalVal {
	public readonly type: MalType.Atom = MalType.Atom
	public constructor(public value: MalVal) {
		super()
	}

	get evaluated() {
		return this.value
	}

	clone() {
		return new MalAtom(this.value.clone())
	}

	toString(): string {
		return `(atom ${this.value?.toString()})`
	}

	
}