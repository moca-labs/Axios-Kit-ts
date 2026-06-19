# @moca-labs/axios-kit-ts

Axios 기반 TypeScript API 클라이언트 라이브러리입니다.  
TC39 Stage 3 메서드 데코레이터로 HTTP 요청을 선언적으로 정의합니다.

## 설치

```bash
npm install @moca-labs/axios-kit-ts @moca-labs/entity-kit-ts axios
```

---

## tsconfig.json

TC39 Stage 3 데코레이터를 사용합니다. `target: ES2022` 이상만 설정하면 됩니다.

```json
{
  "compilerOptions": {
    "target": "ES2022"
  }
}
```

> `experimentalDecorators: true` 또는 `emitDecoratorMetadata: true` 는 **설정하지 마세요.**  
> 레거시 데코레이터 모드로 전환되어 충돌합니다.

---

## Vite 설정

Vite 8은 OXC를 기본 TypeScript 변환기로 사용하며 TC39 데코레이터 lowering을 지원하지 않습니다.  
`vite.config.ts` 에 아래 플러그인을 **다른 플러그인보다 먼저** 추가하세요.

```ts
import { defineConfig, transformWithEsbuild } from "vite";

export default defineConfig({
  plugins: [
    {
      name: "lower-tc39-decorators",
      enforce: "pre",
      async transform(code, id) {
        if (!/\.(ts|tsx)$/.test(id)) return null;
        return transformWithEsbuild(code, id, {
          target: "es2022",
          supported: { decorators: false },
          loader: id.endsWith(".tsx") ? "tsx" : "ts",
        });
      },
    },
    // ... 나머지 플러그인
  ],
});
```

---

## 빠른 시작

```ts
import McAxios from "@moca-labs/axios-kit-ts";
import McEntity from "@moca-labs/entity-kit-ts";
import { AxiosHeaders } from "axios";

// 응답 엔티티
@McEntity.ENTITY
class PostEntity {
  @McEntity.FIELD(Number) id!: number;
  @McEntity.FIELD(String) title!: string;
  @McEntity.FIELD(String) body!: string;
}

// 요청 클래스
class CreatePostRequest extends McAxios.Request {
  @McEntity.SERIALIZE title!: string;
  @McEntity.SERIALIZE body!: string;

  constructor(title: string, body: string) {
    super();
    this.title = title;
    this.body = body;
  }
}

// API 클라이언트
class PostApi extends McAxios {
  protected header(): AxiosHeaders | undefined {
    return new AxiosHeaders({ Authorization: "Bearer my-token" });
  }

  // 파라미터명 id 가 {id} 와 일치 → @PATH 생략 가능
  @McAxios.GET("https://api.example.com/posts/{id}", PostEntity)
  getPost(id: string): Promise<PostEntity> { return this.stub(); }

  // McRequest 서브클래스 인자가 하나 → @REQUEST 생략 가능
  @McAxios.POST("https://api.example.com/posts", PostEntity)
  createPost(req: CreatePostRequest): Promise<PostEntity> { return this.stub(); }
}

const api = new PostApi();
const post    = await api.getPost("1");
const created = await api.createPost(new CreatePostRequest("Hello", "World"));
```

---

## API 레퍼런스

### `extends McAxios` — 베이스 클래스

모든 API 클라이언트는 `McAxios` 를 상속합니다.  
`header()` 로 공통 헤더를 반환하고, `stub()` 을 메서드 바디 플레이스홀더로 사용합니다.  
생성자에서 자동으로 데코레이터 메타데이터를 읽어 메서드를 실제 HTTP 요청 함수로 교체합니다.

```ts
class MyApi extends McAxios {
  protected header(): AxiosHeaders | undefined {
    return new AxiosHeaders({ Authorization: `Bearer ${getToken()}` });
  }

  @McAxios.GET("https://api.example.com/resource/{id}", ResourceEntity)
  getResource(id: string): Promise<ResourceEntity> { return this.stub(); }
}
```

---

### HTTP 메서드 데코레이터

```
@McAxios.GET(url, ResponseType)
@McAxios.POST(url, ResponseType)
@McAxios.PUT(url, ResponseType)
@McAxios.DELETE(url, ResponseType)
@McAxios.PATCH(url, ResponseType)
@McAxios.MULTIPART(url, ResponseType)   // multipart/form-data — FormData 인자 자동 감지
```

| 인자 | 타입 | 설명 |
|------|------|------|
| `url` | `string` | 요청 URL. `{key}` 형식의 경로 파라미터 포함 가능 |
| `ResponseType` | `class` | 응답을 매핑할 클래스. `new ResponseType(axiosResponse)` 로 인스턴스화됨 |

---

### `@McAxios.PATH("urlKey", "paramName")` — 경로 파라미터

URL 플레이스홀더 `{urlKey}` 와 함수 인자 `paramName` 을 매핑합니다.

**파라미터명이 플레이스홀더명과 같으면 자동 감지되므로 생략 가능합니다.**  
이름이 다를 때만 명시가 필요합니다.

```ts
// ✅ 자동 감지 — id 파라미터가 {id} 에 바인딩됨
@McAxios.GET("https://api.example.com/posts/{id}", PostEntity)
getPost(id: string): Promise<PostEntity> { return this.stub(); }

// ✅ 명시 필요 — postId 와 {id} 이름 불일치
@McAxios.GET("https://api.example.com/posts/{id}", PostEntity)
@McAxios.PATH("id", "postId")
getPostByPostId(postId: string): Promise<PostEntity> { return this.stub(); }

// ✅ 복수 경로 파라미터
@McAxios.GET("https://api.example.com/users/{userId}/posts/{postId}", PostEntity)
@McAxios.PATH("userId", "uid")
@McAxios.PATH("postId", "pid")
getPost(uid: string, pid: string): Promise<PostEntity> { return this.stub(); }
```

---

### `@McAxios.REQUEST("label", "paramName")` — 요청 바디

`paramName` 인자를 HTTP 요청 바디로 사용합니다. `toJson()` 을 호출하여 직렬화합니다.

**`McAxios.Request` 서브클래스 인자가 하나뿐이면 자동 감지되므로 생략 가능합니다.**  
경로 파라미터 등 다른 인자와 함께 있을 때 명시하면 의도가 명확해집니다.

```ts
// ✅ 자동 감지 — McRequest 서브클래스가 하나
@McAxios.POST("https://api.example.com/posts", PostEntity)
createPost(req: CreatePostRequest): Promise<PostEntity> { return this.stub(); }

// ✅ 명시 — 경로 파라미터와 요청 바디가 혼재할 때
@McAxios.PUT("https://api.example.com/posts/{id}", PostEntity)
@McAxios.PATH("id", "postId")
@McAxios.REQUEST("body", "data")
updatePost(postId: string, data: UpdatePostRequest): Promise<PostEntity> { return this.stub(); }
```

---

### `@McAxios.HEADER("headerName", "paramName")` — 헤더 파라미터

`paramName` 인자를 HTTP 헤더 `headerName` 값으로 추가합니다.  
`header()` 의 공통 헤더에 병합되어 전송됩니다.

```ts
@McAxios.GET("https://api.example.com/users/{id}", UserEntity)
@McAxios.HEADER("X-Custom-Token", "token")
getUser(id: string, token: string): Promise<UserEntity> { return this.stub(); }
```

---

### `@McAxios.SUCCESS` / `@McAxios.ERROR` — 응답 핸들러

Symbol 기반으로 응답 핸들러와 에러 핸들러를 지정합니다.  
핸들러 메서드는 같은 클래스 내에 `@McAxios.SUCCESS_HANDLER` / `@McAxios.ERROR_HANDLER` 로 등록합니다.

```ts
const ON_SUCCESS = Symbol("onSuccess");
const ON_ERROR   = Symbol("onError");

class PostApi extends McAxios {
  protected header() { return undefined; }

  @McAxios.GET("https://api.example.com/posts/{id}", PostEntity)
  @McAxios.SUCCESS(ON_SUCCESS)
  @McAxios.ERROR(ON_ERROR)
  getPost(id: string): Promise<PostEntity> { return this.stub(); }

  @McAxios.SUCCESS_HANDLER(ON_SUCCESS)
  onSuccess(response: AxiosResponse): AxiosResponse {
    console.log(`HTTP ${response.status}`);
    return response; // 반환값이 ResponseType 생성자에 전달됨
  }

  @McAxios.ERROR_HANDLER(ON_ERROR)
  onError(err: unknown): undefined {
    console.error((err as Error).message);
    return undefined; // undefined 반환 시 에러 재전파, 값 반환 시 해당 값으로 복구
  }
}
```

| 데코레이터 | 적용 위치 | 설명 |
|-----------|----------|------|
| `@McAxios.SUCCESS(sym)` | 요청 메서드 | 성공 시 실행할 핸들러를 Symbol로 지정 |
| `@McAxios.ERROR(sym)` | 요청 메서드 | 실패 시 실행할 핸들러를 Symbol로 지정 |
| `@McAxios.SUCCESS_HANDLER(sym)` | 핸들러 메서드 | Symbol에 매핑되는 성공 핸들러 등록 |
| `@McAxios.ERROR_HANDLER(sym)` | 핸들러 메서드 | Symbol에 매핑되는 에러 핸들러 등록 |

---

### `extends McAxios.Request` — 요청 바디 클래스

HTTP 요청 바디로 전달할 객체는 `McAxios.Request` 를 상속합니다.  
`@McEntity.SERIALIZE` 로 마킹된 필드만 직렬화되어 전송됩니다.

```ts
class UpdatePostRequest extends McAxios.Request {
  @McEntity.SERIALIZE title!: string;
  @McEntity.SERIALIZE body!: string;
  @McEntity.SERIALIZE("user_id") userId!: number; // 직렬화 키 커스텀

  constructor(title: string, body: string, userId: number) {
    super();
    this.title = title;
    this.body = body;
    this.userId = userId;
  }
}
```

---

### `McAxios.Manager` — 인스턴스 관리

전역 인스턴스 레지스트리입니다. 여러 API 클라이언트를 한 곳에서 등록하고 조회할 수 있습니다.

```ts
// 등록
McAxios.Manager.add(new PostApi());
McAxios.Manager.add(new UserApi());

// 또는 한 번에 교체
McAxios.Manager.set([new PostApi(), new UserApi()]);

// 타입으로 조회
const postApi = McAxios.Manager.get(PostApi);
await postApi.getPost("1");
```

| 메서드 | 설명 |
|--------|------|
| `add(instance)` | 인스턴스 등록 |
| `set(instances[])` | 전체 교체 (기존 목록 초기화 후 등록) |
| `get(Type)` | 타입으로 인스턴스 조회. 미등록 시 에러 |
| `createMcAxios(instance)` | 생성과 동시에 등록 후 반환 |
| `clear()` | 전체 초기화 |

---

## 데모

```bash
npm run demo
```

[JSONPlaceholder](https://jsonplaceholder.typicode.com) 를 대상으로 각 기능을 직접 실행해볼 수 있습니다.
