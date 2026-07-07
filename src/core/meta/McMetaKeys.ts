// ─── 메타데이터 키 ─────────────────────────────────────────────────────────
// 데코레이터가 fnMeta/pendingFieldMeta 안에서 서로 다른 데이터를 구분하는 심볼.
export const METHOD_META_KEY = Symbol("mc:method");
export const RESPONSE_TYPE_KEY = Symbol("mc:responseType");
export const SUCCESS_HANDLER_KEY = Symbol("mc:successHandler");
export const ERROR_HANDLER_KEY = Symbol("mc:errorHandler");
export const HANDLER_SYMBOL_MAP_KEY = Symbol("mc:handlerSymbolMap");
export const HEADER_KEY = Symbol("mc:header");
export const PATH_OVERRIDE_KEY = Symbol("mc:pathOverride");
export const REQUEST_OVERRIDE_KEY = Symbol("mc:requestOverride");
export const PARAM_NAMES_KEY = Symbol("mc:paramNames");
// 필드에 화살표 함수 이니셜라이저가 있었으면 true, 빈 `!` 선언이면 false.
// path 파라미터를 이름으로 매핑할지 URL 순서로 매핑할지를 결정한다.
export const HAS_INITIALIZER_KEY = Symbol("mc:hasInitializer");
// 원본 화살표 함수 본문을 저장해 McAxios가 dispatch() 센티널을 탐지할 수 있게 한다.
export const BODY_FN_KEY = Symbol("mc:bodyFn");
