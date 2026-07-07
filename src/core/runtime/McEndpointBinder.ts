import { isFunction } from "@moca-labs/entity-kit-ts";
import { BODY_FN_KEY, ERROR_HANDLER_KEY, HAS_INITIALIZER_KEY, HEADER_KEY, PARAM_NAMES_KEY, PATH_OVERRIDE_KEY, REQUEST_OVERRIDE_KEY, SUCCESS_HANDLER_KEY } from "../meta/McMetaKeys";
import McParamNameResolver from "../meta/McParamNameResolver";
import McDispatchProbe from "./McDispatchProbe";
import McEndpointBuilder from "./McEndpointBuilder";
import McEndpointMetaReader from "./McEndpointMetaReader";
import McHandlerResolver from "./McHandlerResolver";
import McPathParamMapper from "./McPathParamMapper";

// 사용하는 모든 클래스가 extends하는 McAxiosCore를 대신해, 데코레이터가 붙여둔 메타데이터를
// 읽어서 생성 시점에 바인딩된 HTTP 호출로 변환하는 오케스트레이션을 담당한다.
export default class McEndpointBinder {
	private constructor() {}

	// 필드 데코레이터의 init 함수가 생성 시점에 엔드포인트를 만들기 위해 호출한다.
	static buildFieldEndpoint(
		instance: object,
		endpointBuilder: McEndpointBuilder,
		method: string,
		path: string,
		responseType: unknown,
		meta: Map<symbol, unknown>,
	): (...args: unknown[]) => Promise<unknown> {
		const paramNames = (meta.get(PARAM_NAMES_KEY) as string[]) ?? [];
		const hasInitializer = (meta.get(HAS_INITIALIZER_KEY) as boolean) ?? false;
		const successHandler = meta.get(SUCCESS_HANDLER_KEY) as Function | symbol | undefined;
		const errorHandler = meta.get(ERROR_HANDLER_KEY) as Function | symbol | undefined;
		const headerParam = (meta.get(HEADER_KEY) ?? {}) as Record<string, number>;
		const pathOverride = (meta.get(PATH_OVERRIDE_KEY) ?? {}) as Record<string, number>;
		const requestOverride = meta.get(REQUEST_OVERRIDE_KEY) as number | undefined;

		const proto = Object.getPrototypeOf(instance) as object;
		const symbolMap = McHandlerResolver.buildSymbolMap(proto);
		const resolvedSuccess = McHandlerResolver.resolveHandler(instance, successHandler, symbolMap);
		const resolvedError = McHandlerResolver.resolveHandler(instance, errorHandler, symbolMap);

		const autoPath = hasInitializer ? McPathParamMapper.buildAutoPathParams(path, paramNames) : McPathParamMapper.buildOrderedPathParams(path);
		const pathParams = { ...autoPath, ...pathOverride };

		// 본문 함수에서 dispatch() 센티널을 탐지한다.
		const bodyFn = meta.get(BODY_FN_KEY) as Function | undefined;
		const customExecutor = bodyFn ? McDispatchProbe.probe(bodyFn, instance) : undefined;

		return method === "MULTIPART"
			? endpointBuilder.buildMultipartEndpoint(path, responseType, resolvedSuccess, resolvedError, customExecutor)
			: endpointBuilder.buildRequestEndpoint(method, path, pathParams, headerParam, requestOverride, responseType, resolvedSuccess, resolvedError, customExecutor);
	}

	static bindAll(instance: object, endpointBuilder: McEndpointBuilder): void {
		const proto = Object.getPrototypeOf(instance) as object;
		for (const name of Object.getOwnPropertyNames(proto)) {
			const descriptor = Object.getOwnPropertyDescriptor(proto, name);
			if (!descriptor || !isFunction(descriptor.value)) continue;

			const meta = McEndpointMetaReader.read(proto, name);
			if (!meta) continue;

			const { method, path, paramNames, fn, successHandler, errorHandler, responseType, headerParam, pathOverride, requestOverride, symbolMap } = meta;
			const resolvedSuccess = McHandlerResolver.resolveHandler(instance, successHandler, symbolMap);
			const resolvedError = McHandlerResolver.resolveHandler(instance, errorHandler, symbolMap);
			const pathParams = { ...McPathParamMapper.buildAutoPathParams(path, paramNames ?? McParamNameResolver.extractParamNames(fn as Function)), ...pathOverride };

			// 메서드 본문에서 dispatch(executor) 센티널을 탐지한다.
			const customExecutor = McDispatchProbe.probe(fn as Function, instance);

			const endpointFn =
				method === "MULTIPART"
					? endpointBuilder.buildMultipartEndpoint(path, responseType, resolvedSuccess, resolvedError, customExecutor)
					: endpointBuilder.buildRequestEndpoint(method, path, pathParams, headerParam, requestOverride, responseType, resolvedSuccess, resolvedError, customExecutor);

			Object.defineProperty(instance, name, { value: endpointFn });
		}
	}
}
