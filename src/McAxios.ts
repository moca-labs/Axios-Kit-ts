import { isFunction, isSymbol } from "@moca-labs/entity-kit-ts";
import axios, { AxiosHeaders, type AxiosInstance, type AxiosResponse } from "axios";
import {
	BODY_FN_KEY,
	ERROR_HANDLER_KEY,
	extractParamNames,
	getFnMeta,
	HANDLER_SYMBOL_MAP_KEY,
	HAS_INITIALIZER_KEY,
	HEADER_KEY,
	METHOD_META_KEY,
	PARAM_NAMES_KEY,
	PATH_OVERRIDE_KEY,
	REQUEST_OVERRIDE_KEY,
	RESPONSE_TYPE_KEY,
	SUCCESS_HANDLER_KEY,
} from "./McAxiosDecorators";
import McRequest from "./McRequest";

type Executor<T> = (response: AxiosResponse, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void;

function buildAutoPathParams(url: string, paramNames: string[]): Record<string, number> {
	const result: Record<string, number> = {};
	for (const [, key] of url.matchAll(/\{(\w+)\}/g)) {
		const idx = paramNames.indexOf(key);
		if (idx >= 0) result[key] = idx;
	}
	return result;
}

// Used for body-free `!` declarations: URL placeholders map to args in the order they appear.
function buildOrderedPathParams(url: string): Record<string, number> {
	const result: Record<string, number> = {};
	let idx = 0;
	for (const [, key] of url.matchAll(/\{(\w+)\}/g)) {
		result[key] = idx++;
	}
	return result;
}

export default abstract class McAxios {
	// Sentinels returned by dispatch() — detected at construction time from the method body.
	private static readonly _DEFAULT_SENTINEL = Symbol("mc:default");
	private static readonly _CUSTOM_SENTINEL = Symbol("mc:custom");

	private _axios: AxiosInstance;

	public constructor() {
		this._axios = axios.create();
		this.bindEndpoints();
	}

	// ─── Public API ────────────────────────────────────────────────────────────

	// Use in a method body to signal "run the default HTTP flow":
	//   getPost(id: string): Promise<PostEntity> { return this.dispatch(); }
	protected dispatch(): never;

	// Use in a method body to handle the AxiosResponse directly.
	// resolve() → the value flows into @SUCCESS_HANDLER (if present) and is returned.
	// reject()  → goes to @ERROR_HANDLER (if present), then re-throws.
	//   getPost(id: string): Promise<PostEntity> {
	//     return this.dispatch((response, resolve, reject) => {
	//       response.data.active ? resolve(new PostEntity(response.data))
	//                            : reject(new Error('inactive'));
	//     });
	//   }
	protected dispatch<T>(executor: Executor<T>): Promise<T>;

	protected dispatch<T>(executor?: Executor<T>): never | Promise<T> {
		if (executor) {
			return { [McAxios._CUSTOM_SENTINEL]: executor } as unknown as Promise<T>;
		}
		return { [McAxios._DEFAULT_SENTINEL]: true } as unknown as never;
	}

	/** @deprecated Use dispatch() instead */
	protected stub(): never {
		const stack = new Error().stack?.split("\n");
		const callerLine = stack?.[2] ?? "";
		const methodName = callerLine.match(/at (?:\w+\.)?(\w+)\s/)?.[1] ?? "unknown";
		throw new Error(`[McAxios] '${methodName}' is not bound. Make sure your class properly extends McAxios.`);
	}

	// ─── Field-decorator endpoint builder ─────────────────────────────────────

	// Called by field decorators' init functions to create the endpoint at construction time.
	protected __buildFieldEndpoint(method: string, path: string, responseType: unknown, meta: Map<symbol, unknown>): (...args: unknown[]) => Promise<unknown> {
		const paramNames = (meta.get(PARAM_NAMES_KEY) as string[]) ?? [];
		const hasInitializer = (meta.get(HAS_INITIALIZER_KEY) as boolean) ?? false;
		const successHandler = meta.get(SUCCESS_HANDLER_KEY) as Function | symbol | undefined;
		const errorHandler = meta.get(ERROR_HANDLER_KEY) as Function | symbol | undefined;
		const headerParam = (meta.get(HEADER_KEY) ?? {}) as Record<string, number>;
		const pathOverride = (meta.get(PATH_OVERRIDE_KEY) ?? {}) as Record<string, number>;
		const requestOverride = meta.get(REQUEST_OVERRIDE_KEY) as number | undefined;

		const proto = Object.getPrototypeOf(this) as object;
		const symbolMap = this.buildSymbolMap(proto);
		const resolvedSuccess = this.resolveHandler(successHandler, symbolMap);
		const resolvedError = this.resolveHandler(errorHandler, symbolMap);

		const autoPath = hasInitializer ? buildAutoPathParams(path, paramNames) : buildOrderedPathParams(path);
		const pathParams = { ...autoPath, ...pathOverride };

		// Probe the body function for a dispatch() sentinel.
		const bodyFn = meta.get(BODY_FN_KEY) as Function | undefined;
		const customExecutor = bodyFn ? this.probeExecutor(bodyFn) : undefined;

		return method === "MULTIPART"
			? this.buildMultipartEndpoint(path, responseType, resolvedSuccess, resolvedError, customExecutor)
			: this.buildRequestEndpoint(method, path, pathParams, headerParam, requestOverride, responseType, resolvedSuccess, resolvedError, customExecutor);
	}

	protected abstract header(): AxiosHeaders | undefined;

	// ─── Internals ─────────────────────────────────────────────────────────────

	// Calls fn() to detect whether it returned a dispatch(executor) sentinel.
	// Returns the executor if found, undefined otherwise (default flow).
	private probeExecutor(fn: Function): Executor<unknown> | undefined {
		try {
			const result = fn.call(this);
			if (result && typeof result === "object" && McAxios._CUSTOM_SENTINEL in result) {
				return (result as Record<symbol, unknown>)[McAxios._CUSTOM_SENTINEL] as Executor<unknown>;
			}
		} catch {
			/* stub() or anything that throws → default flow */
		}
		return undefined;
	}

	private buildSymbolMap(proto: object): Map<symbol, string> {
		const map = new Map<symbol, string>();
		for (const name of Object.getOwnPropertyNames(proto)) {
			const fn = (proto as Record<string, unknown>)[name];
			if (typeof fn !== "function") continue;
			const sym = getFnMeta(fn, HANDLER_SYMBOL_MAP_KEY);
			if (isSymbol(sym)) map.set(sym, name);
		}
		return map;
	}

	private readEndpointMeta(proto: object, name: string) {
		const fn = (proto as Record<string, unknown>)[name];
		if (typeof fn !== "function") return null;
		const meta = getFnMeta(fn, METHOD_META_KEY) as { method: string; path: string } | undefined;
		if (!meta) return null;
		return {
			method: meta.method,
			path: meta.path,
			fn,
			successHandler: getFnMeta(fn, SUCCESS_HANDLER_KEY) as Function | symbol | undefined,
			errorHandler: getFnMeta(fn, ERROR_HANDLER_KEY) as Function | symbol | undefined,
			responseType: getFnMeta(fn, RESPONSE_TYPE_KEY),
			headerParam: (getFnMeta(fn, HEADER_KEY) ?? {}) as Record<string, number>,
			pathOverride: (getFnMeta(fn, PATH_OVERRIDE_KEY) ?? {}) as Record<string, number>,
			requestOverride: getFnMeta(fn, REQUEST_OVERRIDE_KEY) as number | undefined,
			symbolMap: this.buildSymbolMap(proto),
		};
	}

	private resolveHandler(handler: Function | symbol | undefined, symbolMap: Map<symbol, string>): ((...args: unknown[]) => Promise<unknown>) | undefined {
		if (isSymbol(handler)) {
			const methodName = symbolMap.get(handler);
			if (methodName) return (...args: unknown[]) => (this as unknown as Record<string, Function>)[methodName](...args);
			return undefined;
		}
		if (isFunction(handler)) return (...args: unknown[]) => (handler as Function).call(this, ...args);
		return undefined;
	}

	private buildMultipartEndpoint(
		url: string,
		responseType: unknown,
		resolvedSuccess: ((...args: unknown[]) => Promise<unknown>) | undefined,
		resolvedError: ((...args: unknown[]) => Promise<unknown>) | undefined,
		customExecutor?: Executor<unknown>,
	): (...args: unknown[]) => Promise<unknown> {
		return async (...args: unknown[]) => {
			const data = args.find((a) => a instanceof FormData);
			const apiFunc = async () => this._axios.request({ method: "POST", url, data, headers: { "Content-Type": "multipart/form-data" } });
			try {
				const response = await apiFunc();
				if (customExecutor) {
					const result = await new Promise<unknown>((res, rej) => customExecutor(response, res, rej));
					return resolvedSuccess ? await resolvedSuccess(result, apiFunc) : result;
				}
				if (resolvedSuccess) return new (responseType as new (res: unknown) => unknown)(await resolvedSuccess(response, apiFunc));
				if (responseType) return new (responseType as new (res: unknown) => unknown)(response);
				return response.data;
			} catch (reqErr) {
				if (resolvedError) {
					const result = await resolvedError(reqErr, apiFunc);
					if (result !== undefined) return result;
				}
				throw reqErr;
			}
		};
	}

	private buildRequestEndpoint(
		method: string,
		path: string,
		pathParams: Record<string, number>,
		headerParam: Record<string, number>,
		requestOverride: number | undefined,
		responseType: unknown,
		resolvedSuccess: ((...args: unknown[]) => Promise<unknown>) | undefined,
		resolvedError: ((...args: unknown[]) => Promise<unknown>) | undefined,
		customExecutor?: Executor<unknown>,
	): (...args: unknown[]) => Promise<unknown> {
		return async (...args: unknown[]) => {
			let url = path;
			for (const [key, index] of Object.entries(pathParams)) {
				url = url.replace(`{${key}}`, encodeURIComponent(String(args[index])));
			}

			const request = requestOverride !== undefined && requestOverride >= 0 ? args[requestOverride] : args.find((a) => a instanceof McRequest);
			const data = request !== undefined ? (request as McRequest).toJson() : undefined;

			const apiFunc = async () => {
				const headers: AxiosHeaders = this.header() ?? new AxiosHeaders();
				for (const [key, index] of Object.entries(headerParam)) {
					headers.set(key, args[index] as string);
				}
				return this._axios.request({ method, url, data, headers });
			};

			try {
				const response = await apiFunc();
				if (customExecutor) {
					// User's executor decides resolve/reject.
					// After resolve, @SUCCESS_HANDLER chains on the result (without ResponseType re-wrap).
					const result = await new Promise<unknown>((res, rej) => customExecutor(response, res, rej));
					return resolvedSuccess ? await resolvedSuccess(result, apiFunc) : result;
				}
				if (resolvedSuccess) return new (responseType as new (res: unknown) => unknown)(await resolvedSuccess(response, apiFunc));
				if (responseType) return new (responseType as new (res: unknown) => unknown)(response);
				return response.data;
			} catch (reqErr) {
				if (resolvedError) {
					const result = await resolvedError(reqErr, apiFunc);
					if (result !== undefined) return result;
				}
				throw reqErr;
			}
		};
	}

	private bindEndpoints() {
		const proto = Object.getPrototypeOf(this) as object;
		for (const name of Object.getOwnPropertyNames(proto)) {
			const descriptor = Object.getOwnPropertyDescriptor(proto, name);
			if (!descriptor || !isFunction(descriptor.value)) continue;

			const meta = this.readEndpointMeta(proto, name);
			if (!meta) continue;

			const { method, path, fn, successHandler, errorHandler, responseType, headerParam, pathOverride, requestOverride, symbolMap } = meta;
			const resolvedSuccess = this.resolveHandler(successHandler, symbolMap);
			const resolvedError = this.resolveHandler(errorHandler, symbolMap);
			const pathParams = { ...buildAutoPathParams(path, extractParamNames(fn as Function)), ...pathOverride };

			// Probe the method body for a dispatch(executor) sentinel.
			const customExecutor = this.probeExecutor(fn as Function);

			const endpointFn =
				method === "MULTIPART"
					? this.buildMultipartEndpoint(path, responseType, resolvedSuccess, resolvedError, customExecutor)
					: this.buildRequestEndpoint(method, path, pathParams, headerParam, requestOverride, responseType, resolvedSuccess, resolvedError, customExecutor);

			Object.defineProperty(this, name, { value: endpointFn });
		}
	}
}
