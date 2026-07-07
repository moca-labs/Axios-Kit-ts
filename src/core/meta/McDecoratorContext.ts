// ─── 데코레이터 모드 판별 ──────────────────────────────────────────────────
export default class McDecoratorContext {
	private constructor() {}

	// 두 번째 데코레이터 인자가 TC39 Stage 3 컨텍스트 객체이면 true를 반환한다.
	// 레거시 데코레이터는 대신 두 번째 인자로 문자열/심볼 키를 전달한다.
	static isTC39Context(ctx: unknown): ctx is { kind: string; name: string | symbol; addInitializer?: (fn: () => void) => void } {
		return ctx !== null && typeof ctx === "object" && "kind" in (ctx as object);
	}
}

// ─── Shared decorator type ─────────────────────────────────────────────────
// 듀얼 모드 데코레이터 타입: 메서드 데코레이터 또는 필드 데코레이터(TC39)로 동작하며,
// 런타임에는 레거시 메서드/프로퍼티 데코레이터 호출 규약도 받아들인다.
// init이 `any`를 반환하도록 해서 TypeScript가 각 사용처에서 필드의 구체 타입으로 받아들이게 한다.
export type DualDec = ((value: Function, ctx: ClassMethodDecoratorContext) => void) & ((value: undefined, ctx: ClassFieldDecoratorContext) => (this: object, init: any) => any);
