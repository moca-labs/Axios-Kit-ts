# @moca-labs/axios-kit-ts

Axios 기반 TypeScript API 클라이언트 라이브러리입니다.  
TC39 Stage 3 데코레이터로 HTTP 요청을 선언적으로 정의합니다.

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

  // 선언 스타일 — 가장 간결한 형태
  @McAxios.GET("https://api.example.com/posts/{id}", PostEntity)
  getPost!: (id: string) => Promise<PostEntity>;

  // McRequest 서브클래스 인자가 하나 → @REQUEST 생략 가능
  @McAxios.POST("https://api.example.com/posts", PostEntity)
  createPost!: (req: CreatePostRequest) => Promise<PostEntity>;
}

const api = new PostApi();
const post    = await api.getPost("1");
const created = await api.createPost(new CreatePostRequest("Hello", "World"));
```

---

## 선언 스타일

메서드 하나에 세 가지 스타일을 혼용할 수 있습니다. 기능은 동일하며 표현 방식만 다릅니다.

### ① 선언 스타일 (`!`)

바디 없이 타입만 선언합니다. 가장 간결하며 **권장하는 스타일**입니다.

```ts
@McAxios.GET("https://api.example.com/posts/{id}", PostEntity)
getPost!: (id: string) => Promise<PostEntity>;
```

- 경로 파라미터는 **URL 순서 기준** (첫 번째 `{…}` → 첫 번째 인자, 순서대로)으로 자동 매핑됩니다.
- `@PATH`, `@REQUEST`, `@HEADER` 데코레이터에서 파라미터 지정 시 **인덱스(숫자)** 를 사용합니다.

### ② dispatch() — 기본 흐름

메서드 바디가 필요하지만 HTTP 흐름은 라이브러리에 위임합니다.

```ts
@McAxios.GET("https://api.example.com/posts/{id}", PostEntity)
getPost(id: string): Promise<PostEntity> {
  return this.dispatch();
}
```

- 경로 파라미터는 **파라미터 이름 기준**으로 자동 매핑됩니다 (`id` → `{id}`).
- `@PATH`, `@REQUEST`, `@HEADER` 에서 파라미터 지정 시 **이름(문자열)** 도 사용 가능합니다.
- `return this.stub()` 의 대체 문법입니다.

### ③ dispatch(executor) — 응답 직접 처리

`AxiosResponse` 를 받아 `resolve` / `reject` 를 직접 호출합니다.

```ts
@McAxios.GET("https://api.example.com/posts/{id}", PostEntity)
getPost(id: string): Promise<PostEntity> {
  return this.dispatch<PostEntity>((response, resolve, reject) => {
    response.data?.id
      ? resolve(new PostEntity(response))
      : reject(new Error("데이터 없음"));
  });
}
```

- `resolve(value)` 로 전달한 값이 `@SUCCESS_HANDLER` 체인으로 이어집니다.
- `reject(reason)` 는 `@ERROR_HANDLER` 로 전달된 후 재전파됩니다.
- `ResponseType` 으로 자동 래핑하지 않으므로, 필요하면 executor 안에서 직접 생성하세요.

### 스타일별 파라미터 지정 방식 요약

| 스타일 | @PATH / @REQUEST / @HEADER 인자 지정 |
|--------|--------------------------------------|
| `!` 선언 | 인덱스(숫자) `0`, `1`, `2` … |
| `dispatch()` / `dispatch(executor)` | 이름(문자열) `"id"`, `"data"` … 또는 인덱스 |

---

## API 레퍼런스

### `extends McAxios` — 베이스 클래스

모든 API 클라이언트는 `McAxios` 를 상속합니다.  
`header()` 로 공통 헤더를 반환하고, 생성자에서 자동으로 데코레이터 메타데이터를 읽어  
메서드·필드를 실제 HTTP 요청 함수로 교체합니다.

```ts
class MyApi extends McAxios {
  protected header(): AxiosHeaders | undefined {
    return new AxiosHeaders({ Authorization: `Bearer ${getToken()}` });
  }

  @McAxios.GET("https://api.example.com/resource/{id}", ResourceEntity)
  getResource!: (id: string) => Promise<ResourceEntity>;
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

### `@McAxios.PATH` — 경로 파라미터

URL 플레이스홀더 `{urlKey}` 에 인자를 매핑합니다.

**파라미터명이 플레이스홀더명과 같으면(또는 선언 스타일에서 URL 순서가 일치하면) 자동 감지됩니다.  
이름이 다를 때만 명시가 필요합니다.**

```ts
// ✅ 자동 감지 — 이름 일치 (dispatch 스타일)
@McAxios.GET("https://api.example.com/posts/{id}", PostEntity)
getPost(id: string): Promise<PostEntity> { return this.dispatch(); }

// ✅ 자동 감지 — URL 순서 일치 (선언 스타일, 이름 달라도 OK)
@McAxios.GET("https://api.example.com/posts/{id}", PostEntity)
getPostByPostId!: (postId: string) => Promise<PostEntity>;

// ✅ 명시 필요 — dispatch 스타일에서 이름 불일치
@McAxios.GET("https://api.example.com/posts/{id}", PostEntity)
@McAxios.PATH("id", "postId")               // 문자열: 파라미터 이름
getPostByPostId(postId: string): Promise<PostEntity> { return this.dispatch(); }

// ✅ 명시 필요 — 선언 스타일에서 인덱스로 지정
@McAxios.GET("https://api.example.com/posts/{id}", PostEntity)
@McAxios.PATH("id", 0)                       // 숫자: 인수 인덱스
getPostByPostId!: (postId: string) => Promise<PostEntity>;
```

| 두 번째 인자 | 사용 스타일 | 설명 |
|-------------|------------|------|
| 문자열 `"paramName"` | dispatch 스타일 | 해당 이름의 파라미터를 찾아 매핑 |
| 숫자 `index` | 선언(`!`) · dispatch 모두 가능 | 해당 인덱스의 인수를 직접 매핑 |

---

### `@McAxios.REQUEST` — 요청 바디

지정한 인자를 HTTP 요청 바디로 사용합니다. `toJson()` 을 호출하여 직렬화합니다.

**`McAxios.Request` 서브클래스 인자가 하나뿐이면 자동 감지됩니다.**  
경로 파라미터 등 다른 인자와 함께 있을 때 명시하면 의도가 명확해집니다.

```ts
// ✅ 자동 감지 — McRequest 서브클래스가 하나
@McAxios.POST("https://api.example.com/posts", PostEntity)
createPost!: (req: CreatePostRequest) => Promise<PostEntity>;

// ✅ 명시 — 선언 스타일, 인덱스로 지정
@McAxios.PUT("https://api.example.com/posts/{id}", PostEntity)
@McAxios.REQUEST("body", 1)                  // arg 1 → 요청 바디
updatePost!: (id: string, data: UpdatePostRequest) => Promise<PostEntity>;

// ✅ 명시 — dispatch 스타일, 파라미터 이름으로 지정
@McAxios.PUT("https://api.example.com/posts/{id}", PostEntity)
@McAxios.REQUEST("body", "data")             // "data" 파라미터 → 요청 바디
updatePost(_id: string, _data: UpdatePostRequest): Promise<PostEntity> {
  return this.dispatch();
}
```

---

### `@McAxios.HEADER` — 헤더 파라미터

지정한 인자를 HTTP 헤더에 추가합니다. `header()` 의 공통 헤더에 병합되어 전송됩니다.

```ts
// 선언 스타일 — 인덱스로 지정
@McAxios.GET("https://api.example.com/users/{id}", UserEntity)
@McAxios.HEADER("X-Custom-Token", 1)         // arg 1 → X-Custom-Token 헤더
getUser!: (id: string, token: string) => Promise<UserEntity>;

// dispatch 스타일 — 파라미터 이름으로 지정
@McAxios.GET("https://api.example.com/users/{id}", UserEntity)
@McAxios.HEADER("X-Custom-Token", "token")   // "token" 파라미터 → X-Custom-Token 헤더
getUser(_id: string, _token: string): Promise<UserEntity> {
  return this.dispatch();
}
```

---

### `dispatch()` — 메서드 바디에서 HTTP 흐름 제어

메서드 바디가 있을 때 HTTP 요청 흐름을 제어하는 두 가지 방식을 제공합니다.

#### `this.dispatch()` — 기본 흐름 위임

`!` 선언 스타일과 동일하게 동작합니다. 메서드 바디가 필요한 경우의 대체 문법입니다.

```ts
@McAxios.GET("https://api.example.com/posts/{id}", PostEntity)
getPost(id: string): Promise<PostEntity> {
  return this.dispatch();
}
```

#### `this.dispatch(executor)` — 응답 직접 처리

`AxiosResponse` 를 받아 `resolve` / `reject` 를 직접 호출합니다.  
`resolve(value)` 한 값은 `@SUCCESS_HANDLER` 로 이어지고, `reject(reason)` 은 `@ERROR_HANDLER` 로 전달됩니다.

```ts
@McAxios.GET("https://api.example.com/posts/{id}", PostEntity)
getPost(id: string): Promise<PostEntity> {
  return this.dispatch<PostEntity>((response, resolve, reject) => {
    response.data?.id
      ? resolve(new PostEntity(response))
      : reject(new Error("데이터 없음"));
  });
}
```

#### `dispatch(executor)` + `@SUCCESS_HANDLER` 체인

executor 가 `resolve` 한 값이 `@SUCCESS_HANDLER` 메서드의 첫 번째 인자로 전달됩니다.  
이 때 값은 이미 executor 안에서 가공된 결과물이며, raw `AxiosResponse` 가 아닙니다.

```ts
const ON_SUCCESS = Symbol("onSuccess");

class PostApi extends McAxios {
  protected header() { return undefined; }

  @McAxios.GET("https://api.example.com/posts/{id}", PostEntity)
  @McAxios.SUCCESS(ON_SUCCESS)
  getPost(id: string): Promise<PostEntity> {
    return this.dispatch<PostEntity>((response, resolve, reject) => {
      response.data?.id
        ? resolve(response.data as PostEntity)
        : reject(new Error("데이터 없음"));
    });
  }

  @McAxios.SUCCESS_HANDLER(ON_SUCCESS)
  onSuccess(result: PostEntity): PostEntity {
    console.log(`title: ${result.title}`); // resolve 한 값이 그대로 전달됨
    return result;
  }
}
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
  getPost!: (id: string) => Promise<PostEntity>;

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

**기본 흐름에서의 핸들러 인자:**
- `@SUCCESS_HANDLER` 의 첫 번째 인자: `AxiosResponse`
- `dispatch(executor)` 사용 시의 `@SUCCESS_HANDLER` 첫 번째 인자: executor 가 `resolve` 한 값

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

## 데코레이터 전체 목록

| 데코레이터 | 인자 | 설명 |
|-----------|------|------|
| `@GET(url, Type)` | — | GET 요청 |
| `@POST(url, Type)` | — | POST 요청 |
| `@PUT(url, Type)` | — | PUT 요청 |
| `@DELETE(url, Type)` | — | DELETE 요청 |
| `@PATCH(url, Type)` | — | PATCH 요청 |
| `@MULTIPART(url, Type)` | — | multipart/form-data POST |
| `@PATH(urlKey, param)` | `param`: 이름(string) 또는 인덱스(number) | 경로 파라미터 매핑 |
| `@REQUEST(label, param)` | `param`: 이름(string) 또는 인덱스(number) | 요청 바디 지정 |
| `@HEADER(name, param)` | `param`: 이름(string) 또는 인덱스(number) | 요청 헤더 추가 |
| `@SUCCESS(sym)` | Symbol | 성공 핸들러 지정 |
| `@ERROR(sym)` | Symbol | 에러 핸들러 지정 |
| `@SUCCESS_HANDLER(sym)` | Symbol | 성공 핸들러 메서드 등록 |
| `@ERROR_HANDLER(sym)` | Symbol | 에러 핸들러 메서드 등록 |

---

## 데모

```bash
npm run demo
```

[JSONPlaceholder](https://jsonplaceholder.typicode.com) 를 대상으로 각 기능을 직접 실행해볼 수 있습니다.

| 시나리오 | 내용 |
|----------|------|
| 01 — GET | 고정 URL GET 요청, `!` 선언 스타일 |
| 02 — PATH | `{id}` 자동 매핑, URL 순서 기준 |
| 03 — POST | `McRequest` 자동 감지, 요청 바디 전송 |
| 04 — HEADER | `@HEADER` 로 인자를 HTTP 헤더에 주입 |
| 05 — 핸들러 | `@SUCCESS_HANDLER` / `@ERROR_HANDLER` |
| 06 — @PATH 명시 | 이름 불일치 시 인덱스로 경로 파라미터 명시 |
| 07 — @REQUEST 명시 | 인덱스(선언 스타일) vs 이름(dispatch 스타일) 비교 |
| 08 — 응답 직접 처리 | `dispatch()` / `dispatch(executor)` / executor + 핸들러 체인 |
