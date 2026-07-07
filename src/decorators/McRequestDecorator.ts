import McDecoratorContext, { type DualDec } from "../core/meta/McDecoratorContext";
import { REQUEST_OVERRIDE_KEY } from "../core/meta/McMetaKeys";
import McMetaRegistry from "../core/meta/McMetaRegistry";

// @REQUEST("label", "paramName" | index) — 듀얼 모드
// 화살표 함수 본문 스타일을 쓸 때는 문자열(파라미터 이름)을 전달한다.
// 본문이 없는 `!` 선언 스타일을 쓸 때는 숫자(인자 인덱스)를 전달한다.
//
// 이름/인덱스는 여기서는 미해결 상태로 저장된다 — @REQUEST는 항상 바깥쪽 @GET/@POST …가
// 적용되기 *전에* 적용되므로 (데코레이터는 아래에서 위로 적용됨) 실제 파라미터 이름(또는
// 명시적 `params` 배열)이 아직 알려지지 않았다. 소유자인 HTTP 동사 데코레이터가 나중에
// resolveFnNameRefs / resolvePendingNameRefs / resolveLegacyMeta를 통해 해결한다.
export default class McRequestDecorator {
	private constructor() {}

	static create(paramNameOrIndex: string | number): DualDec {
		return ((arg0: any, arg1: any, arg2?: any): any => {
			if (McDecoratorContext.isTC39Context(arg1)) {
				return arg1.kind === "method" ? McRequestDecorator.applyToTC39Method(arg0, paramNameOrIndex) : McRequestDecorator.applyToTC39Field(arg1, paramNameOrIndex);
			}
			if (arg2 !== undefined) return McRequestDecorator.applyToLegacyMethod(arg2, paramNameOrIndex);
			return McRequestDecorator.applyToLegacyProperty(arg0, arg1, paramNameOrIndex);
		}) as DualDec;
	}

	private static applyToTC39Method(fn: Function, paramNameOrIndex: string | number): void {
		McMetaRegistry.setFnMeta(fn, REQUEST_OVERRIDE_KEY, paramNameOrIndex);
	}

	private static applyToTC39Field(ctx: { name: string | symbol }, paramNameOrIndex: string | number) {
		return function (this: object, initialFn: unknown) {
			McMetaRegistry.setPendingMeta(this, ctx.name, REQUEST_OVERRIDE_KEY, paramNameOrIndex);
			return initialFn;
		};
	}

	// 레거시 메서드 데코레이터
	private static applyToLegacyMethod(descriptor: any, paramNameOrIndex: string | number) {
		McMetaRegistry.setFnMeta(descriptor.value, REQUEST_OVERRIDE_KEY, paramNameOrIndex);
		return descriptor;
	}

	// 레거시 프로퍼티 데코레이터: 미해결 상태로 저장 — @GET setter에서 해결된다
	private static applyToLegacyProperty(proto: object, propName: string | symbol, paramNameOrIndex: string | number): void {
		McMetaRegistry.setLegacyProtoPending(proto, propName, REQUEST_OVERRIDE_KEY, paramNameOrIndex);
	}
}

export const REQUEST = (_label: string, paramNameOrIndex: string | number): DualDec => McRequestDecorator.create(paramNameOrIndex);
