import axios, { AxiosHeaders, type AxiosInstance } from "axios";
import McDispatchSentinel, { type Executor } from "./runtime/McDispatchSentinel";
import McEndpointBinder from "./runtime/McEndpointBinder";
import McEndpointBuilder from "./runtime/McEndpointBuilder";

// ─── 엔드포인트 런타임 ──────────────────────────────────────────────────────
// 사용하는 모든 클래스가 extends하는 추상 베이스. 실제 바인딩 작업은 McEndpointBinder/
// McEndpointBuilder에 위임하고, 이 클래스는 공개 API(dispatch/stub/header)만 노출한다.
export default abstract class McAxiosCore {
	private readonly _axios: AxiosInstance;
	private readonly _endpointBuilder: McEndpointBuilder;

	public constructor() {
		this._axios = axios.create();
		this._endpointBuilder = new McEndpointBuilder(this._axios, () => this.header() ?? new AxiosHeaders());
		McEndpointBinder.bindAll(this, this._endpointBuilder);
	}

	// ─── 공개 API ────────────────────────────────────────────────────────────

	// 메서드 본문에서 "기본 HTTP 흐름을 실행하라"는 신호를 보낼 때 사용:
	//   getPost(id: string): Promise<PostEntity> { return this.dispatch(); }
	protected dispatch(): never;

	// 메서드 본문에서 AxiosResponse를 직접 다룰 때 사용.
	// resolve() → 값이 @SUCCESS_HANDLER로 흘러가고(있다면) 반환된다.
	// reject()  → @ERROR_HANDLER로 흘러간 뒤(있다면) 다시 throw된다.
	//   getPost(id: string): Promise<PostEntity> {
	//     return this.dispatch((response, resolve, reject) => {
	//       response.data.active ? resolve(new PostEntity(response.data))
	//                            : reject(new Error('inactive'));
	//     });
	//   }
	protected dispatch<T>(executor: Executor<T>): Promise<T>;

	protected dispatch<T>(executor?: Executor<T>): never | Promise<T> {
		if (executor) {
			return { [McDispatchSentinel.CUSTOM]: executor } as unknown as Promise<T>;
		}
		return { [McDispatchSentinel.DEFAULT]: true } as unknown as never;
	}

	/** @deprecated dispatch()를 사용할 것 */
	protected stub(): never {
		const stack = new Error().stack?.split("\n");
		const callerLine = stack?.[2] ?? "";
		const methodName = callerLine.match(/at (?:\w+\.)?(\w+)\s/)?.[1] ?? "unknown";
		throw new Error(`[McAxios] '${methodName}' is not bound. Make sure your class properly extends McAxios.`);
	}

	// 필드 데코레이터의 init 함수가 생성 시점에 엔드포인트를 만들기 위해 호출한다.
	protected __buildFieldEndpoint(method: string, path: string, responseType: unknown, meta: Map<symbol, unknown>): (...args: unknown[]) => Promise<unknown> {
		return McEndpointBinder.buildFieldEndpoint(this, this._endpointBuilder, method, path, responseType, meta);
	}

	protected abstract header(): AxiosHeaders | undefined;
}
