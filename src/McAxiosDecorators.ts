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
// (TC39 mode: used by inner decorators like @HEADER, @PATH before outer @GET reads it)
const pendingFieldMeta = new WeakMap<object, Map<string | symbol, Map<symbol, unknown>>>();

// Legacy property decorator mode: accumulates metadata at prototype level during class definition.
// Values for HEADER_KEY / PATH_OVERRIDE_KEY are stored as Record<string, string|number>
// (unresolved param names) and resolved in the setter when the arrow-function is assigned.
const legacyProtoPendingMeta = new WeakMap<object, Map<string | symbol, Map<symbol, unknown>>>();

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
	if (!fields) {
		fields = new Map();
		pendingFieldMeta.set(instance, fields);
	}
	let meta = fields.get(name);
	if (!meta) {
		meta = new Map();
		fields.set(name, meta);
	}
	meta.set(key, value);
}

function consumePendingMeta(instance: object, name: string | symbol): Map<symbol, unknown> {
	const fields = pendingFieldMeta.get(instance);
	const meta = fields?.get(name) ?? new Map<symbol, unknown>();
	fields?.delete(name);
	return meta;
}

function setLegacyProtoPending(proto: object, propName: string | symbol, key: symbol, value: unknown): void {
	let fields = legacyProtoPendingMeta.get(proto);
	if (!fields) {
		fields = new Map();
		legacyProtoPendingMeta.set(proto, fields);
	}
	let meta = fields.get(propName);
	if (!meta) {
		meta = new Map();
		fields.set(propName, meta);
	}
	meta.set(key, value);
}

function getLegacyProtoPending(proto: object, propName: string | symbol): Map<symbol, unknown> {
	return legacyProtoPendingMeta.get(proto)?.get(propName) ?? new Map<symbol, unknown>();
}

// Returns true when the second decorator argument is a TC39 Stage 3 context object.
// Legacy decorators pass a string/symbol key as the second argument instead.
function isTC39Context(ctx: unknown): ctx is { kind: string; name: string | symbol; addInitializer?: (fn: () => void) => void } {
	return ctx !== null && typeof ctx === "object" && "kind" in (ctx as object);
}

export function extractParamNames(fn: Function): string[] {
	const match = fn.toString().match(/^[^(]*\(([^)]*)\)/);
	if (!match?.[1]?.trim()) return [];
	return match[1]
		.split(",")
		.map((p) =>
			p
				.trim()
				.split(/[\s:=<>|&?]/)[0]
				.trim()
				.replace(/^_/, ""),
		)
		.filter(Boolean);
}

function resolveParamIdx(nameOrIdx: string | number, paramNames: string[]): number {
	return typeof nameOrIdx === "number" ? nameOrIdx : paramNames.indexOf(nameOrIdx);
}

// Builds a resolved meta Map from prototype-level pending meta in legacy property decorator mode.
// Param names come from the arrow-function that was just assigned (initialFn).
function resolveLegacyMeta(proto: object, propName: string | symbol, paramNames: string[], initialFn: unknown): Map<symbol, unknown> {
	const protoMeta = getLegacyProtoPending(proto, propName);
	const meta = new Map<symbol, unknown>();
	for (const [k, v] of protoMeta) {
		if (k === HEADER_KEY || k === PATH_OVERRIDE_KEY) {
			const raw = v as Record<string, string | number>;
			const resolved: Record<string, number> = {};
			for (const [name, nameOrIdx] of Object.entries(raw)) {
				resolved[name] = resolveParamIdx(nameOrIdx, paramNames);
			}
			meta.set(k, resolved);
		} else if (k === REQUEST_OVERRIDE_KEY) {
			meta.set(k, resolveParamIdx(v as string | number, paramNames));
		} else {
			meta.set(k, v);
		}
	}
	meta.set(PARAM_NAMES_KEY, paramNames);
	meta.set(HAS_INITIALIZER_KEY, initialFn != null);
	if (initialFn != null) meta.set(BODY_FN_KEY, initialFn);
	return meta;
}

// Dual-mode decorator type: works as method decorator OR field decorator (TC39),
// and also accepts legacy method/property decorator calling conventions at runtime.
// init returns `any` so TypeScript accepts it as the field's concrete type at each usage site.
type DualDec = ((value: Function, ctx: ClassMethodDecoratorContext) => void) & ((value: undefined, ctx: ClassFieldDecoratorContext) => (this: object, init: any) => any);

// HTTP verb decorator — supports TC39 method/field style and legacy method/property style.
//
// TC39 method style:       @GET(...)  getPost(): Promise<T> { return this.dispatch(); }
// TC39 field style:        @GET(...)  getPost = (_id: string): Promise<T> => this.dispatch();
// TC39 body-free field:    @GET(...)  getPost!: (id: string) => Promise<T>;
// Legacy method style:     @GET(...)  getPost(id: string): Promise<T> { return this.dispatch(); }
// Legacy property style:   @GET(...)  getPost = (_id: string): Promise<T> => this.dispatch();
const createDecorator = (method: string, path: string, type: new (res: unknown) => unknown): DualDec =>
	((arg0: any, arg1: any, arg2?: any): any => {
		if (isTC39Context(arg1)) {
			// TC39 mode: arg0 = value (function or undefined), arg1 = context
			if (arg1.kind === "method") {
				setFnMeta(arg0, METHOD_META_KEY, { method, path });
				setFnMeta(arg0, RESPONSE_TYPE_KEY, type);
			} else {
				// TC39 field decorator: use addInitializer so the endpoint is built after all
				// sibling decorator initializers (@SUCCESS, @ERROR, @HEADER …) have run.
				// Lowered TC39 runtimes (e.g. esbuild) call field initializers outermost-first,
				// so consuming pendingMeta inside the returned initializer would see an empty map.
				const fieldName = arg1.name;
				let capturedInitFn: unknown;
				if (typeof (arg1 as any).addInitializer === "function") {
					(arg1 as any).addInitializer(function (this: object) {
						const paramNames = capturedInitFn ? extractParamNames(capturedInitFn as Function) : [];
						const meta = consumePendingMeta(this, fieldName);
						meta.set(PARAM_NAMES_KEY, paramNames);
						meta.set(HAS_INITIALIZER_KEY, capturedInitFn != null);
						if (capturedInitFn != null) meta.set(BODY_FN_KEY, capturedInitFn);
						(this as any)[fieldName] = (this as any).__buildFieldEndpoint(method, path, type, meta);
					});
					return function (this: object, initialFn: unknown) {
						capturedInitFn = initialFn;
						return initialFn;
					};
				}
				// Fallback for environments without addInitializer support
				return function (this: object, initialFn: unknown) {
					const paramNames = initialFn ? extractParamNames(initialFn as Function) : [];
					const meta = consumePendingMeta(this, fieldName);
					meta.set(PARAM_NAMES_KEY, paramNames);
					meta.set(HAS_INITIALIZER_KEY, initialFn != null);
					if (initialFn != null) meta.set(BODY_FN_KEY, initialFn);
					return (this as any).__buildFieldEndpoint(method, path, type, meta);
				};
			}
		} else if (arg2 !== undefined) {
			// Legacy method decorator: (target, propertyKey, descriptor)
			if (typeof arg2.value === "function") {
				setFnMeta(arg2.value, METHOD_META_KEY, { method, path });
				setFnMeta(arg2.value, RESPONSE_TYPE_KEY, type);
			}
			return arg2;
		} else {
			// Legacy property decorator: (target, propertyKey)
			// Define a setter on the prototype; when the arrow-function initializer is assigned
			// during construction, the setter fires and builds the endpoint in its place.
			const proto = arg0;
			const propName = arg1 as string | symbol;
			Object.defineProperty(proto, propName, {
				configurable: true,
				enumerable: true,
				set(this: any, initialFn: unknown) {
					const paramNames = initialFn ? extractParamNames(initialFn as Function) : [];
					const meta = resolveLegacyMeta(proto, propName, paramNames, initialFn);
					Object.defineProperty(this, propName, {
						configurable: true,
						writable: true,
						enumerable: true,
						value: (this as any).__buildFieldEndpoint(method, path, type, meta),
					});
				},
				get() {
					return undefined;
				},
			});
		}
	}) as DualDec;

// SUCCESS/ERROR handler reference decorator (dual-mode)
const handlerDec =
	(metaKey: symbol) =>
	(fn: Function | symbol): DualDec =>
		((arg0: any, arg1: any, arg2?: any): any => {
			if (isTC39Context(arg1)) {
				if (arg1.kind === "method") {
					setFnMeta(arg0, metaKey, fn);
				} else {
					return function (this: object, initialFn: unknown) {
						setPendingMeta(this, arg1.name, metaKey, fn);
						return initialFn;
					};
				}
			} else if (arg2 !== undefined) {
				// Legacy method decorator
				if (typeof arg2.value === "function") setFnMeta(arg2.value, metaKey, fn);
				return arg2;
			} else {
				// Legacy property decorator
				setLegacyProtoPending(arg0, arg1, metaKey, fn);
			}
		}) as DualDec;

// SUCCESS_HANDLER / ERROR_HANDLER — marks handler methods (method-only, not field endpoints)
const symbolMapDec =
	() =>
	(sym: symbol): ((value: any, context: any, descriptor?: any) => any) =>
	(arg0: any, arg1: any, arg2?: any): any => {
		// 1. TC39 표준 데코레이터 환경 처리
		if (isTC39Context(arg1)) {
			if (arg1.kind === "method") {
				setFnMeta(arg0, HANDLER_SYMBOL_MAP_KEY, sym);
				return arg0;
			}
			if (arg1.kind === "field") {
				return (val: any) => {
					if (typeof val === "function") {
						setFnMeta(val, HANDLER_SYMBOL_MAP_KEY, sym);
					}
					return val;
				};
			}
		}

		// 2. Legacy(구버전) 메서드 데코레이터 처리
		if (arg2?.value) {
			setFnMeta(arg2.value, HANDLER_SYMBOL_MAP_KEY, sym);
			return arg2;
		}

		// 3. Legacy(구버전) 화살표 함수 프로퍼티 처리
		const shadowKey = Symbol(arg1);
		Object.defineProperty(arg0, arg1, {
			configurable: true,
			enumerable: true,
			get() {
				return this[shadowKey];
			},
			set(val) {
				if (typeof val === "function") setFnMeta(val, HANDLER_SYMBOL_MAP_KEY, sym);
				this[shadowKey] = val;
			},
		});
	};

// @HEADER("X-Header", "paramName" | index) — dual-mode
// Pass a string (param name) when using arrow-function body style.
// Pass a number (arg index) when using the body-free `!` declaration style.
const headerDec = (headerName: string, paramNameOrIndex: string | number): DualDec =>
	((arg0: any, arg1: any, arg2?: any): any => {
		const resolveIdx = (fn: unknown) => (typeof paramNameOrIndex === "number" ? paramNameOrIndex : fn ? extractParamNames(fn as Function).indexOf(paramNameOrIndex) : -1);

		if (isTC39Context(arg1)) {
			if (arg1.kind === "method") {
				const existing = (getFnMeta(arg0, HEADER_KEY) as Record<string, number>) ?? {};
				existing[headerName] = resolveIdx(arg0);
				setFnMeta(arg0, HEADER_KEY, existing);
			} else {
				return function (this: object, initialFn: unknown) {
					const existingHdr = (pendingFieldMeta.get(this)?.get(arg1.name)?.get(HEADER_KEY) as Record<string, number>) ?? {};
					existingHdr[headerName] = resolveIdx(initialFn);
					setPendingMeta(this, arg1.name, HEADER_KEY, existingHdr);
					return initialFn;
				};
			}
		} else if (arg2 !== undefined) {
			// Legacy method decorator
			const existing = (getFnMeta(arg2.value, HEADER_KEY) as Record<string, number>) ?? {};
			existing[headerName] = resolveIdx(arg2.value);
			setFnMeta(arg2.value, HEADER_KEY, existing);
			return arg2;
		} else {
			// Legacy property decorator: store unresolved; resolved in the @GET setter
			const existing = (getLegacyProtoPending(arg0, arg1).get(HEADER_KEY) as Record<string, string | number>) ?? {};
			existing[headerName] = paramNameOrIndex;
			setLegacyProtoPending(arg0, arg1, HEADER_KEY, existing);
		}
	}) as DualDec;

// @PATH("urlKey", "paramName" | index) — dual-mode
// Pass a string (param name) when using arrow-function body style.
// Pass a number (arg index) when using the body-free `!` declaration style.
const pathDec = (urlKey: string, paramNameOrIndex: string | number): DualDec =>
	((arg0: any, arg1: any, arg2?: any): any => {
		const resolveIdx = (fn: unknown) => (typeof paramNameOrIndex === "number" ? paramNameOrIndex : fn ? extractParamNames(fn as Function).indexOf(paramNameOrIndex) : -1);

		if (isTC39Context(arg1)) {
			if (arg1.kind === "method") {
				const existing = (getFnMeta(arg0, PATH_OVERRIDE_KEY) as Record<string, number>) ?? {};
				existing[urlKey] = resolveIdx(arg0);
				setFnMeta(arg0, PATH_OVERRIDE_KEY, existing);
			} else {
				return function (this: object, initialFn: unknown) {
					const existingPath = (pendingFieldMeta.get(this)?.get(arg1.name)?.get(PATH_OVERRIDE_KEY) as Record<string, number>) ?? {};
					existingPath[urlKey] = resolveIdx(initialFn);
					setPendingMeta(this, arg1.name, PATH_OVERRIDE_KEY, existingPath);
					return initialFn;
				};
			}
		} else if (arg2 !== undefined) {
			// Legacy method decorator
			const existing = (getFnMeta(arg2.value, PATH_OVERRIDE_KEY) as Record<string, number>) ?? {};
			existing[urlKey] = resolveIdx(arg2.value);
			setFnMeta(arg2.value, PATH_OVERRIDE_KEY, existing);
			return arg2;
		} else {
			// Legacy property decorator: store unresolved; resolved in the @GET setter
			const existing = (getLegacyProtoPending(arg0, arg1).get(PATH_OVERRIDE_KEY) as Record<string, string | number>) ?? {};
			existing[urlKey] = paramNameOrIndex;
			setLegacyProtoPending(arg0, arg1, PATH_OVERRIDE_KEY, existing);
		}
	}) as DualDec;

// @REQUEST("label", "paramName" | index) — dual-mode
// Pass a string (param name) when using arrow-function body style.
// Pass a number (arg index) when using the body-free `!` declaration style.
const requestDec = (_label: string, paramNameOrIndex: string | number): DualDec =>
	((arg0: any, arg1: any, arg2?: any): any => {
		const resolveIdx = (fn: unknown) => (typeof paramNameOrIndex === "number" ? paramNameOrIndex : fn ? extractParamNames(fn as Function).indexOf(paramNameOrIndex) : -1);

		if (isTC39Context(arg1)) {
			if (arg1.kind === "method") {
				setFnMeta(arg0, REQUEST_OVERRIDE_KEY, resolveIdx(arg0));
			} else {
				return function (this: object, initialFn: unknown) {
					setPendingMeta(this, arg1.name, REQUEST_OVERRIDE_KEY, resolveIdx(initialFn));
					return initialFn;
				};
			}
		} else if (arg2 !== undefined) {
			// Legacy method decorator
			setFnMeta(arg2.value, REQUEST_OVERRIDE_KEY, resolveIdx(arg2.value));
			return arg2;
		} else {
			// Legacy property decorator: store unresolved; resolved in the @GET setter
			setLegacyProtoPending(arg0, arg1, REQUEST_OVERRIDE_KEY, paramNameOrIndex);
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
