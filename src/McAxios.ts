import axios, { AxiosHeaders, type AxiosInstance } from "axios";
import {
	HANDLER_SYMBOL_MAP_KEY,
	HEADER_KEY,
	METHOD_META_KEY,
	PATH_OVERRIDE_KEY,
	REQUEST_OVERRIDE_KEY,
	RESPONSE_TYPE_KEY,
	SUCCESS_HANDLER_KEY,
	ERROR_HANDLER_KEY,
	extractParamNames,
	getFnMeta,
} from "./McAxiosDecorators";
import McRequest from "./McRequest";
import { isFunction, isSymbol } from "@moca-labs/entity-kit-ts";

function buildAutoPathParams(url: string, paramNames: string[]): Record<string, number> {
	const result: Record<string, number> = {};
	for (const [, key] of url.matchAll(/\{(\w+)\}/g)) {
		const idx = paramNames.indexOf(key);
		if (idx >= 0) result[key] = idx;
	}
	return result;
}

export default abstract class McAxios {
	private _axios: AxiosInstance;

	public constructor() {
		this._axios = axios.create();
		this.bindEndpoints();
	}

	protected stub(): never {
		const stack = new Error().stack?.split("\n");
		const callerLine = stack?.[2] ?? "";
		const methodName = callerLine.match(/at (?:\w+\.)?(\w+)\s/)?.[1] ?? "unknown";
		throw new Error(`[McAxios] '${methodName}' is not bound. Make sure your class properly extends McAxios.`);
	}

	protected abstract header(): AxiosHeaders | undefined;

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

	private resolveHandler(
		handler: Function | symbol | undefined,
		symbolMap: Map<symbol, string>,
	): ((...args: unknown[]) => Promise<unknown>) | undefined {
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
	): (...args: unknown[]) => Promise<unknown> {
		return async (...args: unknown[]) => {
			const data = args.find((a) => a instanceof FormData);
			const apiFunc = async () =>
				this._axios.request({ method: "POST", url, data, headers: { "Content-Type": "multipart/form-data" } });
			try {
				const response = await apiFunc();
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
	): (...args: unknown[]) => Promise<unknown> {
		return async (...args: unknown[]) => {
			let url = path;
			for (const [key, index] of Object.entries(pathParams)) {
				url = url.replace(`{${key}}`, encodeURIComponent(String(args[index])));
			}

			// @REQUEST 명시 시 해당 인덱스 사용, 생략 시 instanceof McRequest 자동 감지
			const request =
				requestOverride !== undefined && requestOverride >= 0
					? args[requestOverride]
					: args.find((a) => a instanceof McRequest);
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
			// 자동 감지 후 명시적 @PATH 오버라이드 병합 (명시가 우선)
			const pathParams = { ...buildAutoPathParams(path, extractParamNames(fn as Function)), ...pathOverride };

			const endpointFn =
				method === "MULTIPART"
					? this.buildMultipartEndpoint(path, responseType, resolvedSuccess, resolvedError)
					: this.buildRequestEndpoint(method, path, pathParams, headerParam, requestOverride, responseType, resolvedSuccess, resolvedError);

			Object.defineProperty(this, name, { value: endpointFn });
		}
	}
}
