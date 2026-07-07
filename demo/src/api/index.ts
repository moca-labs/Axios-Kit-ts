import McAxios from "@moca-labs/axios-kit-ts";
import { AxiosHeaders } from "axios";
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

	// S04 - HEADER injection (이름 모드 + params로 minify-safe 하게 이름 고정)
	// `!` 선언 스타일은 실제 함수 값이 없어 fn.toString() 리플렉션 자체가 불가능하므로
	// 문자열 이름을 쓰려면 params 로 인자 이름을 명시해야 한다 (인덱스 모드였다면 params 불필요).
	@McAxios.GET(`${BASE}/users/{id}`, UserEntity, ["id", "token"])
	@McAxios.HEADER("X-Custom-Token", "token")
	getUser!: (id: string, token: string) => Promise<UserEntity>;

	// S06 - @PATH 명시: 인덱스로 {id} → arg 0 를 명시 지정
	@McAxios.GET(`${BASE}/posts/{id}`, PostEntity)
	// @McAxios.PATH("id", 0)
	getPostByPostId!: (postId: string) => Promise<PostEntity>;

	// S07 - REQUEST 명시 (인덱스): 선언 스타일에서 arg 1 을 바디로 지정
	@McAxios.PUT(`${BASE}/posts/{id}`, PostEntity)
	@McAxios.REQUEST("body", 1)
	updatePost!: (id: string, data: UpdatePostRequest) => Promise<PostEntity>;

	// S07 - REQUEST 명시 (이름 + params): dispatch 스타일에서 파라미터 이름으로 지정.
	// params 를 생략하면 fn.toString() 으로 "_id"/"_data" 를 리플렉션해서 알아내는데,
	// 이 방식은 프로덕션 minify(식별자 mangling) 시 조용히 깨질 수 있다 — params 로 고정하면 안전.
	@McAxios.PUT(`${BASE}/posts/{id}`, PostEntity, ["id", "data"])
	@McAxios.REQUEST("body", "data")
	updatePostByName(_id: string, _data: UpdatePostRequest): Promise<PostEntity> {
		return this.dispatch();
	}

	// S09 - minify 안전성: 인자 이름을 실제 minifier가 그렇게 하듯 의미 없는 이름(`_a`, 리플렉션엔
	// 선행 "_"가 제거되어 "a"로 읽힘)으로 지어서 "식별자가 mangling된 상태"를 흉내낸다.
	//
	// params 를 생략하면 {id} 매핑을 fn.toString() 리플렉션에 의존하는데, 리플렉션이 읽어내는
	// 이름은 "a"이지 "id"가 아니므로 매핑에 실패해서 URL이 `.../posts/{id}` 그대로 나간다.
	@McAxios.GET(`${BASE}/posts/{id}`, PostEntity)
	getPostMangledUnsafe(_a: string): Promise<PostEntity> {
		return this.dispatch();
	}

	// 반대로 params로 "id"를 명시하면, 실제 인자 이름이 무엇으로 mangling되든 상관없이
	// 항상 arg 0을 {id}에 매핑한다 — 리터럴 문자열 배열이라 minify와 무관하게 안전하다.
	@McAxios.GET(`${BASE}/posts/{id}`, PostEntity, ["id"])
	getPostMangledSafe(_a: string): Promise<PostEntity> {
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
		const r = response as PostEntity;
		this.logs.push(`✅ Post #${r.id} — 성공 핸들러 실행됨`);
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
	public getPostDefault(_id: string): Promise<PostEntity> {
		return this.dispatch();
	}

	// ② dispatch(executor) — AxiosResponse를 직접 처리 후 resolve/reject 호출
	@McAxios.GET(`${BASE}/posts/{id}`, PostEntity)
	public getPostCustom(_id: string): Promise<PostEntity> {
		return this.dispatch<PostEntity>((response, resolve, reject) => {
			response.data?.id ? resolve(response.data as PostEntity) : reject(new Error("응답 데이터가 비어 있습니다."));
		});
	}

	// ③ dispatch(executor) + @SUCCESS_HANDLER — executor 처리 후 핸들러 체인
	@McAxios.GET(`${BASE}/posts/{id}`, PostEntity)
	@McAxios.SUCCESS(ON_DISPATCH_SUCCESS)
	getPostWithHandler!: (_id: string) => Promise<PostEntity>;

	@McAxios.GET(`${BASE}/posts/{id}`, PostEntity)
	@McAxios.SUCCESS(ON_DISPATCH_SUCCESS)
	getPostCustomWithHandler: (_id: string) => Promise<PostEntity> = (_id) => {
		return this.dispatch();
	};

	// {
	// 	return this.dispatch<PostEntity>((response, resolve, reject) => {
	// 		response.data?.id ? resolve(this.onOtherDispatchSuccess(response.data as PostEntity)) : reject(new Error("응답 데이터가 비어 있습니다."));
	// 	});
	// }

	@McAxios.SUCCESS_HANDLER(ON_DISPATCH_SUCCESS)
	onDispatchSuccess(result: unknown): unknown {
		const post = result as PostEntity;
		this.logs.push(`✅ 핸들러 수행 — title: "${post.title}"`);
		return result;
	}

	onOtherDispatchSuccess(result: PostEntity): PostEntity {
		const post = result as PostEntity;
		this.logs.push(`✅ 핸들러 수행 — title: "${post.title}"`);
		return post;
	}
}

export const dispatchApi = new DispatchDemoApi();
