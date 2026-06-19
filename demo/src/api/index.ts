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
  getFirstPost(): Promise<PostEntity> {
    return this.stub();
  }

  // S02 - PATH param (파라미터 이름이 {id}와 자동 매핑됨)
  @McAxios.GET(`${BASE}/posts/{id}`, PostEntity)
  getPost(id: string): Promise<PostEntity> {
    return this.stub();
  }

  // S03 - POST + REQUEST body (McRequest 서브클래스를 자동 감지)
  @McAxios.POST(`${BASE}/posts`, PostEntity)
  createPost(req: CreatePostRequest): Promise<PostEntity> {
    return this.stub();
  }

  // S04 - HEADER injection (파라미터 이름 기반 바인딩)
  @McAxios.GET(`${BASE}/users/{id}`, UserEntity)
  @McAxios.HEADER("X-Custom-Token", "token")
  getUser(id: string, token: string): Promise<UserEntity> {
    return this.stub();
  }

  // S06 - PATH 명시: URL {id}와 파라미터명 postId가 달라 @PATH로 명시 매핑
  @McAxios.GET(`${BASE}/posts/{id}`, PostEntity)
  @McAxios.PATH("id", "postId")
  getPostByPostId(postId: string): Promise<PostEntity> {
    return this.stub();
  }

  // S07 - REQUEST 명시: 복수 파라미터에서 요청 바디를 @REQUEST로 명시 지정
  @McAxios.PUT(`${BASE}/posts/{id}`, PostEntity)
  @McAxios.PATH("id", "postId")
  @McAxios.REQUEST("body", "data")
  updatePost(postId: string, data: UpdatePostRequest): Promise<PostEntity> {
    return this.stub();
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
  getPost(id: string): Promise<PostEntity> {
    return this.stub();
  }

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
