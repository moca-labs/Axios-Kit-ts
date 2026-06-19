export const METHOD_META_KEY = Symbol("mc:method");
export const RESPONSE_TYPE_KEY = Symbol("mc:responseType");
export const SUCCESS_HANDLER_KEY = Symbol("mc:successHandler");
export const ERROR_HANDLER_KEY = Symbol("mc:errorHandler");
export const HANDLER_SYMBOL_MAP_KEY = Symbol("mc:handlerSymbolMap");
export const HEADER_KEY = Symbol("mc:header");
export const PATH_OVERRIDE_KEY = Symbol("mc:pathOverride");
export const REQUEST_OVERRIDE_KEY = Symbol("mc:requestOverride");

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

export function extractParamNames(fn: Function): string[] {
	const match = fn.toString().match(/^[^(]*\(([^)]*)\)/);
	if (!match?.[1]?.trim()) return [];
	return match[1]
		.split(",")
		.map((p) => p.trim().split(/[\s:=<>|&?]/)[0].trim())
		.filter(Boolean);
}

type MethodDec = (value: Function, context: ClassMethodDecoratorContext) => void;

const createDecorator = (method: string, path: string, type: new (res: unknown) => unknown): MethodDec =>
	(value, _ctx) => {
		setFnMeta(value, METHOD_META_KEY, { method, path });
		setFnMeta(value, RESPONSE_TYPE_KEY, type);
	};

const handlerDec = (metaKey: symbol) => (fn: Function | symbol): MethodDec =>
	(value, _ctx) => setFnMeta(value, metaKey, fn);

const symbolMapDec = () => (sym: symbol): MethodDec =>
	(value, _ctx) => setFnMeta(value, HANDLER_SYMBOL_MAP_KEY, sym);

const headerDec = (headerName: string, paramName: string): MethodDec =>
	(value, _ctx) => {
		const idx = extractParamNames(value).indexOf(paramName);
		const existing = (getFnMeta(value, HEADER_KEY) as Record<string, number>) ?? {};
		existing[headerName] = idx >= 0 ? idx : -1;
		setFnMeta(value, HEADER_KEY, existing);
	};

// @McAxios.PATH("urlKey", "paramName") — {urlKey}를 paramName 인자로 명시 치환
// 생략 시 URL 플레이스홀더명과 파라미터명이 일치하면 자동 감지
const pathDec = (urlKey: string, paramName: string): MethodDec =>
	(value, _ctx) => {
		const idx = extractParamNames(value).indexOf(paramName);
		const existing = (getFnMeta(value, PATH_OVERRIDE_KEY) as Record<string, number>) ?? {};
		existing[urlKey] = idx >= 0 ? idx : -1;
		setFnMeta(value, PATH_OVERRIDE_KEY, existing);
	};

// @McAxios.REQUEST("label", "paramName") — paramName 인자를 요청 바디로 명시 지정
// 생략 시 McRequest 서브클래스 인자를 자동 감지
const requestDec = (_label: string, paramName: string): MethodDec =>
	(value, _ctx) => {
		const idx = extractParamNames(value).indexOf(paramName);
		setFnMeta(value, REQUEST_OVERRIDE_KEY, idx >= 0 ? idx : -1);
	};

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
