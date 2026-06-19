export const METHOD_META_KEY = Symbol("mc:method");
export const REQUEST_KEY = Symbol("mc:requestBody");
export const RESPONSE_TYPE_KEY = Symbol("mc:responseType");
export const PATH_PARAMS_KEY = Symbol("mc:pathParams");
export const SUCCESS_HANDLER_KEY = Symbol("mc:successHandler");
export const ERROR_HANDLER_KEY = Symbol("mc:errorHandler");
export const HANDLER_SYMBOL_MAP_KEY = Symbol("mc:handlerSymbolMap");
export const FORMDATA_KEY = Symbol("mc:formdata");
export const HEADER_KEY = Symbol("mc:header");

const fnMeta = new WeakMap<Function, Map<symbol, unknown>>();

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

type MethodDec = (value: Function, context: ClassMethodDecoratorContext) => void;

const createDecorator = (method: string, path: string, type: new (res: unknown) => unknown): MethodDec =>
	(value, _ctx) => {
		setFnMeta(value, METHOD_META_KEY, { method, path });
		setFnMeta(value, RESPONSE_TYPE_KEY, type);
	};

const indexParamDec = (metaKey: symbol) => (paramIdx: number): MethodDec =>
	(value, _ctx) => setFnMeta(value, metaKey, paramIdx);

const keyedParamDec = (metaKey: symbol) => (key: string, paramIdx: number): MethodDec =>
	(value, _ctx) => {
		const existing = (getFnMeta(value, metaKey) as Record<string, number>) ?? {};
		existing[key] = paramIdx;
		setFnMeta(value, metaKey, existing);
	};

const handlerDec = (metaKey: symbol) => (fn: Function | symbol): MethodDec =>
	(value, _ctx) => setFnMeta(value, metaKey, fn);

const symbolMapDec = () => (sym: symbol): MethodDec =>
	(value, _ctx) => setFnMeta(value, HANDLER_SYMBOL_MAP_KEY, sym);

const McAxiosDecorators = {
	GET: (url: string, type: new (res: unknown) => unknown) => createDecorator("GET", url, type),
	POST: (url: string, type: new (res: unknown) => unknown) => createDecorator("POST", url, type),
	PUT: (url: string, type: new (res: unknown) => unknown) => createDecorator("PUT", url, type),
	DELETE: (url: string, type: new (res: unknown) => unknown) => createDecorator("DELETE", url, type),
	MULTIPART: (url: string, type: new (res: unknown) => unknown) => createDecorator("MULTIPART", url, type),
	PATCH: (url: string, type: new (res: unknown) => unknown) => createDecorator("PATCH", url, type),
	REQUEST: indexParamDec(REQUEST_KEY),
	FORM_DATA: indexParamDec(FORMDATA_KEY),
	HEADER: keyedParamDec(HEADER_KEY),
	PATH: keyedParamDec(PATH_PARAMS_KEY),
	SUCCESS: handlerDec(SUCCESS_HANDLER_KEY),
	ERROR: handlerDec(ERROR_HANDLER_KEY),
	SUCCESS_HANDLER: symbolMapDec(),
	ERROR_HANDLER: symbolMapDec(),
};

export default McAxiosDecorators;
