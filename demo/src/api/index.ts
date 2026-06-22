import McAxios from "@moca-labs/axios-kit-ts";
import { AxiosHeaders, type AxiosResponse } from "axios";
import { PostEntity } from "./entities/PostEntity";
import { UserEntity } from "./entities/UserEntity";
import { CreatePostRequest } from "./requests/CreatePostRequest";
import { UpdatePostRequest } from "./requests/UpdatePostRequest";

const BASE = "https://jsonplaceholder.typicode.com";

// ─── 시나리오 01~04 공용 API ──────────────────────────────────────────────────

class JsonPlaceholderApi extends McAxios {
	protected header(): AxiosHeaders | undefined {
		return undefined;
	}

	// S01 - GET (고정 URL)
	@McAxios.GET(`${BASE}/posts/1`, PostEntity)
	getFirstPost!: () => Promise<PostEntity>;

	// S02 - PATH param ({id} → arg 0, URL 순서 자동 매핑)
	@McAxios.GET(`${BASE}/posts/{id}`, PostEntity)
	getPost!: (id: string) => Promise<PostEntity>;

	// S03 - POST + REQUEST body (McRequest 서브클래스 호출 시 자동 감지)
	@McAxios.POST(`${BASE}/posts`, PostEntity)
	createPost!: (req: CreatePostRequest) => Promise<PostEntity>;

	// S04 - HEADER injection (인덱스로 직접 지정: arg 1)
	@McAxios.GET(`${BASE}/users/{id}`, UserEntity)
	@McAxios.HEADER("X-Custom-Token", 1)
	getUser!: (id: string, token: string) => Promise<UserEntity>;

	// S06 - @PATH 명시: 인덱스로 {id} → arg 0 를 명시 지정
	@McAxios.GET(`${BASE}/posts/{id}`, PostEntity)
	@McAxios.PATH("id", 0)
	getPostByPostId!: (postId: string) => Promise<PostEntity>;

	// S07 - REQUEST 명시 (인덱스): 선언 스타일에서 arg 1 을 바디로 지정
	@McAxios.PUT(`${BASE}/posts/{id}`, PostEntity)
	@McAxios.REQUEST("body", 1)
	updatePost!: (id: string, data: UpdatePostRequest) => Promise<PostEntity>;

	// S07 - REQUEST 명시 (이름): dispatch 스타일에서 파라미터 이름으로 지정
	@McAxios.PUT(`${BASE}/posts/{id}`, PostEntity)
	@McAxios.REQUEST("body", "data")
	updatePostByName(_id: string, _data: UpdatePostRequest): Promise<PostEntity> {
		return this.dispatch();
	}
}

export const api = new JsonPlaceholderApi();
export { CreatePostRequest, UpdatePostRequest };

// ─── 시나리오 05 - SUCCESS / ERROR 핸들러 ─────────────────────────────────────

const ON_SUCCESS = Symbol("onSuccess");
const ON_ERROR = Symbol("onError");

class HandlerDemoApi extends McAxios {
	readonly logs: string[] = [];

	protected header(): AxiosHeaders | undefined {
		return undefined;
	}

	@McAxios.GET(`${BASE}/posts/{id}`, PostEntity)
	@McAxios.SUCCESS(ON_SUCCESS)
	@McAxios.ERROR(ON_ERROR)
	getPost!: (id: string) => Promise<PostEntity>;

	@McAxios.SUCCESS_HANDLER(ON_SUCCESS)
	onSuccess(response: unknown): unknown {
		const r = response as AxiosResponse;
		this.logs.push(`✅ HTTP ${r.status} — 성공 핸들러 실행됨`);
		return response;
	}

	@McAxios.ERROR_HANDLER(ON_ERROR)
	onError(err: unknown): undefined {
		this.logs.push(`❌ ${(err as Error).message} — 에러 핸들러 실행됨`);
		return undefined;
	}
}

export const handlerApi = new HandlerDemoApi();

// ─── 시나리오 08 - dispatch() 응답 직접 처리 ────────────────────────────────────

const ON_DISPATCH_SUCCESS = Symbol("onDispatchSuccess");

class DispatchDemoApi extends McAxios {
	readonly logs: string[] = [];

	protected header(): AxiosHeaders | undefined {
		return undefined;
	}

	// ① dispatch() — 기본 동작 (field `!` 스타일과 동일한 결과)
	@McAxios.GET(`${BASE}/posts/{id}`, PostEntity)
	getPostDefault(_id: string): Promise<PostEntity> {
		return this.dispatch();
	}

	// ② dispatch(executor) — AxiosResponse를 직접 처리 후 resolve/reject 호출
	@McAxios.GET(`${BASE}/posts/{id}`, PostEntity)
	getPostCustom(_id: string): Promise<PostEntity> {
		return this.dispatch<PostEntity>((response, resolve, reject) => {
			response.data?.id
				? resolve(response.data as PostEntity)
				: reject(new Error("응답 데이터가 비어 있습니다."));
		});
	}

	// ③ dispatch(executor) + @SUCCESS_HANDLER — executor 처리 후 핸들러 체인
	@McAxios.GET(`${BASE}/posts/{id}`, PostEntity)
	@McAxios.SUCCESS(ON_DISPATCH_SUCCESS)
	getPostWithHandler(_id: string): Promise<PostEntity> {
		return this.dispatch<PostEntity>((response, resolve, reject) => {
			response.data?.id
				? resolve(response.data as PostEntity)
				: reject(new Error("응답 데이터가 비어 있습니다."));
		});
	}

	@McAxios.SUCCESS_HANDLER(ON_DISPATCH_SUCCESS)
	onDispatchSuccess(result: unknown): unknown {
		const post = result as PostEntity;
		this.logs.push(`✅ 핸들러 수행 — title: "${post.title}"`);
		return result;
	}
}

export const dispatchApi = new DispatchDemoApi();
