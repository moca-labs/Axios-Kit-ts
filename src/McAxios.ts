import axios, { AxiosHeaders, type AxiosInstance } from "axios";
import {
	FORMDATA_KEY,
	HANDLER_SYMBOL_MAP_KEY,
	HEADER_KEY,
	METHOD_META_KEY,
	PATH_PARAMS_KEY,
	REQUEST_KEY,
	RESPONSE_TYPE_KEY,
	SUCCESS_HANDLER_KEY,
	ERROR_HANDLER_KEY,
	getFnMeta,
} from "./McAxiosDecorators";
import McRequest from "./McRequest";
import { isFunction, isSymbol } from "@moca-labs/entity-kit-ts";

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
			successHandler: getFnMeta(fn, SUCCESS_HANDLER_KEY) as Function | symbol | undefined,
			errorHandler: getFnMeta(fn, ERROR_HANDLER_KEY) as Function | symbol | undefined,
			requestBody: getFnMeta(fn, REQUEST_KEY) as number | undefined,
			responseType: getFnMeta(fn, RESPONSE_TYPE_KEY),
			formData: getFnMeta(fn, FORMDATA_KEY) as number | undefined,
			pathParams: (getFnMeta(fn, PATH_PARAMS_KEY) ?? {}) as { [key: string]: number },
			headerParam: (getFnMeta(fn, HEADER_KEY) ?? {}) as { [key: string]: number },
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
		formDataIdx: number | undefined,
		responseType: unknown,
		resolvedSuccess: ((...args: unknown[]) => Promise<unknown>) | undefined,
		resolvedError: ((...args: unknown[]) => Promise<unknown>) | undefined,
	): (...args: unknown[]) => Promise<unknown> {
		return async (...args: unknown[]) => {
			const data = formDataIdx !== undefined ? args[formDataIdx] : undefined;
			const apiFunc = async () => this._axios.request({ method: "POST", url, data, headers: { "Content-Type": "multipart/form-data" } });
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
		pathParams: { [key: string]: number },
		headerParam: { [key: string]: number },
		requestBodyIdx: number | undefined,
		responseType: unknown,
		resolvedSuccess: ((...args: unknown[]) => Promise<unknown>) | undefined,
		resolvedError: ((...args: unknown[]) => Promise<unknown>) | undefined,
		name: string,
	): (...args: unknown[]) => Promise<unknown> {
		return async (...args: unknown[]) => {
			let url = path;
			for (const [key, index] of Object.entries(pathParams)) {
				url = url.replace(`{${key}}`, encodeURIComponent(String(args[index])));
			}

			const request = requestBodyIdx !== undefined ? args[requestBodyIdx] : undefined;
			if (request !== undefined && request instanceof McRequest === false) {
				const err = new Error("Invalid request format.");
				if (resolvedError) await resolvedError(err);
				throw err;
			}
			const data = request !== undefined ? (request as McRequest).toJson() : undefined;
			console.log(`param -> ${name} :: ${data}`);

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

			const { method, path, successHandler, errorHandler, requestBody, responseType, formData, pathParams, headerParam, symbolMap } = meta;
			const resolvedSuccess = this.resolveHandler(successHandler, symbolMap);
			const resolvedError = this.resolveHandler(errorHandler, symbolMap);

			const endpointFn =
				method === "MULTIPART"
					? this.buildMultipartEndpoint(path, formData, responseType, resolvedSuccess, resolvedError)
					: this.buildRequestEndpoint(method, path, pathParams, headerParam, requestBody, responseType, resolvedSuccess, resolvedError, name);

			Object.defineProperty(this, name, { value: endpointFn });
		}
	}
}
