import McDecoratorContext, { type DualDec } from "../core/meta/McDecoratorContext";
import { PATH_OVERRIDE_KEY } from "../core/meta/McMetaKeys";
import McMetaRegistry from "../core/meta/McMetaRegistry";

// @PATH("urlKey", "paramName" | index) — 듀얼 모드
// 화살표 함수 본문 스타일을 쓸 때는 문자열(파라미터 이름)을 전달한다.
// 본문이 없는 `!` 선언 스타일을 쓸 때는 숫자(인자 인덱스)를 전달한다.
//
// 이름/인덱스는 여기서는 미해결 상태로 저장된다 — @PATH는 항상 바깥쪽 @GET/@POST …가
// 적용되기 *전에* 적용되므로 (데코레이터는 아래에서 위로 적용됨) 실제 파라미터 이름(또는
// 명시적 `params` 배열)이 아직 알려지지 않았다. 소유자인 HTTP 동사 데코레이터가 나중에
// resolveFnNameRefs / resolvePendingNameRefs / resolveLegacyMeta를 통해 해결한다.
export const PATH = (urlKey: string, paramNameOrIndex: string | number): DualDec =>
	((arg0: any, arg1: any, arg2?: any): any => {
		if (McDecoratorContext.isTC39Context(arg1)) {
			if (arg1.kind === "method") {
				const existing = (McMetaRegistry.getFnMeta(arg0, PATH_OVERRIDE_KEY) as Record<string, string | number>) ?? {};
				existing[urlKey] = paramNameOrIndex;
				McMetaRegistry.setFnMeta(arg0, PATH_OVERRIDE_KEY, existing);
			} else {
				return function (this: object, initialFn: unknown) {
					const existingPath = (McMetaRegistry.peekPendingMeta(this, arg1.name)?.get(PATH_OVERRIDE_KEY) as Record<string, string | number>) ?? {};
					existingPath[urlKey] = paramNameOrIndex;
					McMetaRegistry.setPendingMeta(this, arg1.name, PATH_OVERRIDE_KEY, existingPath);
					return initialFn;
				};
			}
		} else if (arg2 !== undefined) {
			// 레거시 메서드 데코레이터
			const existing = (McMetaRegistry.getFnMeta(arg2.value, PATH_OVERRIDE_KEY) as Record<string, string | number>) ?? {};
			existing[urlKey] = paramNameOrIndex;
			McMetaRegistry.setFnMeta(arg2.value, PATH_OVERRIDE_KEY, existing);
			return arg2;
		} else {
			// 레거시 프로퍼티 데코레이터: 미해결 상태로 저장 — @GET setter에서 해결된다
			const existing = (McMetaRegistry.getLegacyProtoPending(arg0, arg1).get(PATH_OVERRIDE_KEY) as Record<string, string | number>) ?? {};
			existing[urlKey] = paramNameOrIndex;
			McMetaRegistry.setLegacyProtoPending(arg0, arg1, PATH_OVERRIDE_KEY, existing);
		}
	}) as DualDec;
