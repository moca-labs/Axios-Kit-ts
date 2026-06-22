export const METHOD_META_KEY = Symbol("mc:method");
export const RESPONSE_TYPE_KEY = Symbol("mc:responseType");
export const SUCCESS_HANDLER_KEY = Symbol("mc:successHandler");
export const ERROR_HANDLER_KEY = Symbol("mc:errorHandler");
export const HANDLER_SYMBOL_MAP_KEY = Symbol("mc:handlerSymbolMap");
export const HEADER_KEY = Symbol("mc:header");
export const PATH_OVERRIDE_KEY = Symbol("mc:pathOverride");
export const REQUEST_OVERRIDE_KEY = Symbol("mc:requestOverride");
export const PARAM_NAMES_KEY = Symbol("mc:paramNames");
// true when the field had an arrow-function initializer; false for bare `!` declarations.
// Controls whether path params are mapped by name or by URL order.
export const HAS_INITIALIZER_KEY = Symbol("mc:hasInitializer");
// Stores the original arrow-function body so McAxios can probe it for dispatch() sentinels.
export const BODY_FN_KEY = Symbol("mc:bodyFn");

// Method-level metadata (method decorator style)
const fnMeta = new WeakMap<Function, Map<symbol, unknown>>();

// Field-level pending metadata: accumulates per-instance during field initialization
// (used by inner decorators like @HEADER, @PATH before outer @GET reads it)
const pendingFieldMeta = new WeakMap<object, Map<string | symbol, Map<symbol, unknown>>>();

export function setFnMeta(fn: Function, key: symbol, value: unknown): void {
	let m = fnMeta.get(fn);
	if (!m) {
		m = new Map();
		fnMeta.set(fn, m);
	}
	m.set(key, value);
}

export function getFnMeta(fn: Function, key: symbol): unknown {
	return fnMeta.get(fn)?.get(key);
}

function setPendingMeta(instance: object, name: string | symbol, key: symbol, value: unknown): void {
	let fields = pendingFieldMeta.get(instance);
	if (!fields) { fields = new Map(); pendingFieldMeta.set(instance, fields); }
	let meta = fields.get(name);
	if (!meta) { meta = new Map(); fields.set(name, meta); }
	meta.set(key, value);
}

function consumePendingMeta(instance: object, name: string | symbol): Map<symbol, unknown> {
	const fields = pendingFieldMeta.get(instance);
	const meta = fields?.get(name) ?? new Map<symbol, unknown>();
	fields?.delete(name);
	return meta;
}

export function extractParamNames(fn: Function): string[] {
	const match = fn.toString().match(/^[^(]*\(([^)]*)\)/);
	if (!match?.[1]?.trim()) return [];
	return match[1]
		.split(",")
		.map((p) => p.trim().split(/[\s:=<>|&?]/)[0].trim().replace(/^_/, ""))
		.filter(Boolean);
}

// Dual-mode decorator type: works as method decorator OR field decorator.
// init returns `any` so TypeScript accepts it as the field's concrete type at each usage site.
type DualDec = ((value: Function, ctx: ClassMethodDecoratorContext) => void) &
	((value: undefined, ctx: ClassFieldDecoratorContext) => (this: object, init: any) => any);

// HTTP verb decorator — supports both method style and arrow-function field style
//
// Method style (current):     @GET(...)  getPost(): Promise<T> { return this.stub(); }
// Field style  (new):         @GET(...)  getPost = (_id: string): Promise<T> => this.stub();
// Body-free field style:      @GET(...)  getPost!: (id: string) => Promise<T>;
const createDecorator = (method: string, path: string, type: new (res: unknown) => unknown): DualDec =>
	((value: any, ctx: any): any => {
		if (ctx.kind === "method") {
			setFnMeta(value, METHOD_META_KEY, { method, path });
			setFnMeta(value, RESPONSE_TYPE_KEY, type);
		} else {
			return function (this: object, initialFn: unknown) {
				const paramNames = initialFn ? extractParamNames(initialFn as Function) : [];
				const meta = consumePendingMeta(this, ctx.name);
				meta.set(PARAM_NAMES_KEY, paramNames);
				meta.set(HAS_INITIALIZER_KEY, initialFn != null);
				if (initialFn != null) meta.set(BODY_FN_KEY, initialFn);
				return (this as any).__buildFieldEndpoint(method, path, type, meta);
			};
		}
	}) as DualDec;

// SUCCESS/ERROR handler reference decorator (dual-mode)
const handlerDec =
	(metaKey: symbol) =>
	(fn: Function | symbol): DualDec =>
		((value: any, ctx: any): any => {
			if (ctx.kind === "method") {
				setFnMeta(value, metaKey, fn);
			} else {
				return function (this: object, initialFn: unknown) {
					setPendingMeta(this, ctx.name, metaKey, fn);
					return initialFn;
				};
			}
		}) as DualDec;

// SUCCESS_HANDLER / ERROR_HANDLER — always method-only (marks handler methods, not endpoints)
const symbolMapDec =
	() =>
	(sym: symbol): ((value: Function, ctx: ClassMethodDecoratorContext) => void) =>
	(value, _ctx) =>
		setFnMeta(value, HANDLER_SYMBOL_MAP_KEY, sym);

// @HEADER("X-Header", "paramName" | index) — dual-mode
// Pass a string (param name) when using arrow-function body style.
// Pass a number (arg index) when using the body-free `!` declaration style.
const headerDec = (headerName: string, paramNameOrIndex: string | number): DualDec =>
	((value: any, ctx: any): any => {
		const resolveIdx = (fn: unknown) =>
			typeof paramNameOrIndex === "number"
				? paramNameOrIndex
				: fn
					? extractParamNames(fn as Function).indexOf(paramNameOrIndex)
					: -1;
		if (ctx.kind === "method") {
			const existing = (getFnMeta(value, HEADER_KEY) as Record<string, number>) ?? {};
			existing[headerName] = resolveIdx(value);
			setFnMeta(value, HEADER_KEY, existing);
		} else {
			return function (this: object, initialFn: unknown) {
				const existingHdr =
					(pendingFieldMeta.get(this)?.get(ctx.name)?.get(HEADER_KEY) as Record<string, number>) ?? {};
				existingHdr[headerName] = resolveIdx(initialFn);
				setPendingMeta(this, ctx.name, HEADER_KEY, existingHdr);
				return initialFn;
			};
		}
	}) as DualDec;

// @PATH("urlKey", "paramName" | index) — dual-mode
// Pass a string (param name) when using arrow-function body style.
// Pass a number (arg index) when using the body-free `!` declaration style.
const pathDec = (urlKey: string, paramNameOrIndex: string | number): DualDec =>
	((value: any, ctx: any): any => {
		const resolveIdx = (fn: unknown) =>
			typeof paramNameOrIndex === "number"
				? paramNameOrIndex
				: fn
					? extractParamNames(fn as Function).indexOf(paramNameOrIndex)
					: -1;
		if (ctx.kind === "method") {
			const existing = (getFnMeta(value, PATH_OVERRIDE_KEY) as Record<string, number>) ?? {};
			existing[urlKey] = resolveIdx(value);
			setFnMeta(value, PATH_OVERRIDE_KEY, existing);
		} else {
			return function (this: object, initialFn: unknown) {
				const existingPath =
					(pendingFieldMeta.get(this)?.get(ctx.name)?.get(PATH_OVERRIDE_KEY) as Record<string, number>) ?? {};
				existingPath[urlKey] = resolveIdx(initialFn);
				setPendingMeta(this, ctx.name, PATH_OVERRIDE_KEY, existingPath);
				return initialFn;
			};
		}
	}) as DualDec;

// @REQUEST("label", "paramName" | index) — dual-mode
// Pass a string (param name) when using arrow-function body style.
// Pass a number (arg index) when using the body-free `!` declaration style.
const requestDec = (_label: string, paramNameOrIndex: string | number): DualDec =>
	((value: any, ctx: any): any => {
		const resolveIdx = (fn: unknown) =>
			typeof paramNameOrIndex === "number"
				? paramNameOrIndex
				: fn
					? extractParamNames(fn as Function).indexOf(paramNameOrIndex)
					: -1;
		if (ctx.kind === "method") {
			setFnMeta(value, REQUEST_OVERRIDE_KEY, resolveIdx(value));
		} else {
			return function (this: object, initialFn: unknown) {
				setPendingMeta(this, ctx.name, REQUEST_OVERRIDE_KEY, resolveIdx(initialFn));
				return initialFn;
			};
		}
	}) as DualDec;

const McAxiosDecorators = {
	GET: (url: string, type: new (res: unknown) => unknown) => createDecorator("GET", url, type),
	POST: (url: string, type: new (res: unknown) => unknown) => createDecorator("POST", url, type),
	PUT: (url: string, type: new (res: unknown) => unknown) => createDecorator("PUT", url, type),
	DELETE: (url: string, type: new (res: unknown) => unknown) => createDecorator("DELETE", url, type),
	MULTIPART: (url: string, type: new (res: unknown) => unknown) => createDecorator("MULTIPART", url, type),
	PATCH: (url: string, type: new (res: unknown) => unknown) => createDecorator("PATCH", url, type),
	PATH: pathDec,
	REQUEST: requestDec,
	HEADER: headerDec,
	SUCCESS: handlerDec(SUCCESS_HANDLER_KEY),
	ERROR: handlerDec(ERROR_HANDLER_KEY),
	SUCCESS_HANDLER: symbolMapDec(),
	ERROR_HANDLER: symbolMapDec(),
};

export default McAxiosDecorators;
