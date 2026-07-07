import { AxiosHeaders, type AxiosInstance } from "axios";
import McRequest from "../McRequest";
import type { Executor } from "./McDispatchSentinel";

// axios 인스턴스에 실제 HTTP 요청을 보내는 바인딩된 엔드포인트 함수를 만든다.
// McAxiosCore 인스턴스마다 하나씩 생성되어, 그 인스턴스의 axios 클라이언트와 header()를 감싼다.
export default class McEndpointBuilder {
	constructor(
		private readonly axios: AxiosInstance,
		private readonly resolveHeaders: () => AxiosHeaders,
	) {}

	buildMultipartEndpoint(
		url: string,
		responseType: unknown,
		resolvedSuccess: ((...args: unknown[]) => Promise<unknown>) | undefined,
		resolvedError: ((...args: unknown[]) => Promise<unknown>) | undefined,
		customExecutor?: Executor<unknown>,
	): (...args: unknown[]) => Promise<unknown> {
		return async (...args: unknown[]) => {
			const data = args.find((a) => a instanceof FormData);
			const apiFunc = async () => this.axios.request({ method: "POST", url, data, headers: { "Content-Type": "multipart/form-data" } });
			try {
				const response = await apiFunc();
				if (customExecutor) {
					const result = await new Promise<unknown>((res, rej) => customExecutor(response, res, rej));
					return resolvedSuccess ? await resolvedSuccess(result, apiFunc) : result;
				}
				if (resolvedSuccess) {
					const entity = responseType ? new (responseType as new (res: unknown) => unknown)(response) : response.data;
					return await resolvedSuccess(entity, apiFunc);
				}
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

	buildRequestEndpoint(
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
				const headers: AxiosHeaders = this.resolveHeaders();
				for (const [key, index] of Object.entries(headerParam)) {
					headers.set(key, args[index] as string);
				}
				return this.axios.request({ method, url, data, headers });
			};

			try {
				const response = await apiFunc();
				if (customExecutor) {
					// 사용자의 executor가 resolve/reject를 결정한다.
					// resolve 이후에는 @SUCCESS_HANDLER가 결과에 체이닝된다(ResponseType 재래핑 없이).
					const result = await new Promise<unknown>((res, rej) => customExecutor(response, res, rej));
					return resolvedSuccess ? await resolvedSuccess(result, apiFunc) : result;
				}
				if (resolvedSuccess) {
					const entity = responseType ? new (responseType as new (res: unknown) => unknown)(response) : response.data;
					return await resolvedSuccess(entity, apiFunc);
				}
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
}
