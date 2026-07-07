import McDecoratorContext, { type DualDec } from "../core/meta/McDecoratorContext";
import McEndpointMetaResolver from "../core/meta/McEndpointMetaResolver";
import { BODY_FN_KEY, HAS_INITIALIZER_KEY, METHOD_META_KEY, PARAM_NAMES_KEY, RESPONSE_TYPE_KEY } from "../core/meta/McMetaKeys";
import McMetaRegistry from "../core/meta/McMetaRegistry";
import McParamNameResolver from "../core/meta/McParamNameResolver";

// HTTP 동사 데코레이터 — TC39 메서드/필드 스타일과 레거시 메서드/프로퍼티 스타일을 모두 지원한다.
//
// TC39 메서드 스타일:        @GET(...)  getPost(): Promise<T> { return this.dispatch(); }
// TC39 필드 스타일:          @GET(...)  getPost = (_id: string): Promise<T> => this.dispatch();
// TC39 본문 없는 필드:       @GET(...)  getPost!: (id: string) => Promise<T>;
// 레거시 메서드 스타일:      @GET(...)  getPost(id: string): Promise<T> { return this.dispatch(); }
// 레거시 프로퍼티 스타일:    @GET(...)  getPost = (_id: string): Promise<T> => this.dispatch();
//
// `explicitParamNames`가 주어지면, @PATH/@HEADER/@REQUEST 이름 매칭과 {key} 자동 감지를 위한
// 인자 이름의 소스로서 `McParamNameResolver.extractParamNames(fn)`을 대체한다. 호출부에 박혀
// 있는 리터럴 배열이므로 — fn.toString() 파싱과 달리 — 식별자를 뭉개는 minifier를 거쳐도 그대로 살아남는다.
export default class McHttpMethodDecorator {
	private constructor() {}

	static create(method: string, path: string, type: new (res: unknown) => unknown, explicitParamNames?: readonly string[]): DualDec {
		return ((arg0: any, arg1: any, arg2?: any): any => {
			if (McDecoratorContext.isTC39Context(arg1)) {
				return arg1.kind === "method"
					? McHttpMethodDecorator.applyToTC39Method(arg0, method, path, type, explicitParamNames)
					: McHttpMethodDecorator.applyToTC39Field(arg1, method, path, type, explicitParamNames);
			}
			if (arg2 !== undefined) return McHttpMethodDecorator.applyToLegacyMethod(arg2, method, path, type, explicitParamNames);
			return McHttpMethodDecorator.applyToLegacyProperty(arg0, arg1, method, path, type, explicitParamNames);
		}) as DualDec;
	}

	private static applyToTC39Method(fn: Function, method: string, path: string, type: new (res: unknown) => unknown, explicitParamNames: readonly string[] | undefined): void {
		const paramNames = explicitParamNames ?? McParamNameResolver.extractParamNames(fn);
		McEndpointMetaResolver.resolveFnNameRefs(fn, paramNames);
		McMetaRegistry.setFnMeta(fn, METHOD_META_KEY, { method, path, paramNames });
		McMetaRegistry.setFnMeta(fn, RESPONSE_TYPE_KEY, type);
	}

	// TC39 필드 데코레이터: addInitializer를 사용해서 형제 데코레이터 이니셜라이저(@SUCCESS,
	// @ERROR, @HEADER …)가 모두 실행된 뒤에 엔드포인트가 만들어지도록 한다. 트랜스파일된 TC39
	// 런타임(esbuild 등)은 필드 이니셜라이저를 바깥쪽부터 먼저 호출하므로, 반환된 이니셜라이저
	// 안에서 pendingMeta를 소비하면 빈 맵을 보게 된다.
	private static applyToTC39Field(ctx: any, method: string, path: string, type: new (res: unknown) => unknown, explicitParamNames: readonly string[] | undefined) {
		const fieldName = ctx.name;
		let capturedInitFn: unknown;
		if (typeof ctx.addInitializer === "function") {
			ctx.addInitializer(function (this: object) {
				const paramNames = explicitParamNames ?? (capturedInitFn ? McParamNameResolver.extractParamNames(capturedInitFn as Function) : []);
				const meta = McMetaRegistry.consumePendingMeta(this, fieldName);
				McEndpointMetaResolver.resolvePendingNameRefs(meta, paramNames);
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
		// addInitializer를 지원하지 않는 환경을 위한 폴백
		return function (this: object, initialFn: unknown) {
			const paramNames = explicitParamNames ?? (initialFn ? McParamNameResolver.extractParamNames(initialFn as Function) : []);
			const meta = McMetaRegistry.consumePendingMeta(this, fieldName);
			McEndpointMetaResolver.resolvePendingNameRefs(meta, paramNames);
			meta.set(PARAM_NAMES_KEY, paramNames);
			meta.set(HAS_INITIALIZER_KEY, initialFn != null);
			if (initialFn != null) meta.set(BODY_FN_KEY, initialFn);
			return (this as any).__buildFieldEndpoint(method, path, type, meta);
		};
	}

	// 레거시 메서드 데코레이터: (target, propertyKey, descriptor)
	private static applyToLegacyMethod(descriptor: any, method: string, path: string, type: new (res: unknown) => unknown, explicitParamNames: readonly string[] | undefined) {
		if (typeof descriptor.value === "function") {
			const paramNames = explicitParamNames ?? McParamNameResolver.extractParamNames(descriptor.value);
			McEndpointMetaResolver.resolveFnNameRefs(descriptor.value, paramNames);
			McMetaRegistry.setFnMeta(descriptor.value, METHOD_META_KEY, { method, path, paramNames });
			McMetaRegistry.setFnMeta(descriptor.value, RESPONSE_TYPE_KEY, type);
		}
		return descriptor;
	}

	// 레거시 프로퍼티 데코레이터: (target, propertyKey)
	// 프로토타입에 setter를 정의한다; 생성 중 화살표 함수 이니셜라이저가 대입되면
	// 이 setter가 실행되어 그 자리에 엔드포인트를 만든다.
	private static applyToLegacyProperty(
		proto: object,
		propName: string | symbol,
		method: string,
		path: string,
		type: new (res: unknown) => unknown,
		explicitParamNames: readonly string[] | undefined,
	): void {
		Object.defineProperty(proto, propName, {
			configurable: true,
			enumerable: true,
			set(this: any, initialFn: unknown) {
				const paramNames = explicitParamNames ?? (initialFn ? McParamNameResolver.extractParamNames(initialFn as Function) : []);
				const meta = McEndpointMetaResolver.resolveLegacyMeta(proto, propName, paramNames, initialFn);
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
}

// `params`가 주어지면, 각 위치 인자의 이름을 호출 순서대로 지정한다 (예: ["id", "data"]).
// 이는 fn.toString()으로 메서드/필드 자신의 소스를 리플렉션하는 대신 @PATH/@HEADER/@REQUEST/{key}
// 자동 감지가 이름을 해결할 소스가 된다 — 이 리플렉션이야말로 이 라이브러리에서 식별자를
// 뭉개는 minifier에 유일하게 깨지는 부분이다. 소비하는 앱의 빌드가 이 클래스들을 minify
// 대상에서 제외한다고 보장할 때만 생략해도 된다.
export const GET = (url: string, response: new (res: unknown) => unknown, params?: readonly string[]) => McHttpMethodDecorator.create("GET", url, response, params);
export const POST = (url: string, response: new (res: unknown) => unknown, params?: readonly string[]) => McHttpMethodDecorator.create("POST", url, response, params);
export const PUT = (url: string, response: new (res: unknown) => unknown, params?: readonly string[]) => McHttpMethodDecorator.create("PUT", url, response, params);
export const DELETE = (url: string, response: new (res: unknown) => unknown, params?: readonly string[]) => McHttpMethodDecorator.create("DELETE", url, response, params);
export const MULTIPART = (url: string, response: new (res: unknown) => unknown, params?: readonly string[]) => McHttpMethodDecorator.create("MULTIPART", url, response, params);
export const PATCH = (url: string, response: new (res: unknown) => unknown, params?: readonly string[]) => McHttpMethodDecorator.create("PATCH", url, response, params);
