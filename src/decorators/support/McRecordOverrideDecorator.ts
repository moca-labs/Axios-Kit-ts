import McDecoratorContext, { type DualDec } from "../../core/meta/McDecoratorContext";
import McMetaRegistry from "../../core/meta/McMetaRegistry";

// @HEADER/@PATH가 공유하는 구현: 데코레이터 인자로 받은 { entryKey: paramNameOrIndex } 한 쌍을
// metaKey 아래의 Record<string, string|number>에 누적한다. 두 데코레이터의 유일한 차이는
// 어떤 metaKey를 쓰느냐뿐이라 이 클래스로 로직을 공유한다.
//
// 이름/인덱스는 여기서는 미해결 상태로 저장된다 — @HEADER/@PATH는 항상 바깥쪽 @GET/@POST …가
// 적용되기 *전에* 적용되므로 (데코레이터는 아래에서 위로 적용됨) 실제 파라미터 이름(또는
// 명시적 `params` 배열)이 아직 알려지지 않았다. 소유자인 HTTP 동사 데코레이터가 나중에
// resolveFnNameRefs / resolvePendingNameRefs / resolveLegacyMeta를 통해 해결한다.
export default class McRecordOverrideDecorator {
	private constructor() {}

	static build(metaKey: symbol, entryKey: string, paramNameOrIndex: string | number): DualDec {
		return ((arg0: any, arg1: any, arg2?: any): any => {
			if (McDecoratorContext.isTC39Context(arg1)) {
				return arg1.kind === "method"
					? McRecordOverrideDecorator.applyToTC39Method(arg0, metaKey, entryKey, paramNameOrIndex)
					: McRecordOverrideDecorator.applyToTC39Field(arg1, metaKey, entryKey, paramNameOrIndex);
			}
			if (arg2 !== undefined) return McRecordOverrideDecorator.applyToLegacyMethod(arg2, metaKey, entryKey, paramNameOrIndex);
			return McRecordOverrideDecorator.applyToLegacyProperty(arg0, arg1, metaKey, entryKey, paramNameOrIndex);
		}) as DualDec;
	}

	private static applyToTC39Method(fn: Function, metaKey: symbol, entryKey: string, paramNameOrIndex: string | number): void {
		const existing = (McMetaRegistry.getFnMeta(fn, metaKey) as Record<string, string | number>) ?? {};
		existing[entryKey] = paramNameOrIndex;
		McMetaRegistry.setFnMeta(fn, metaKey, existing);
	}

	private static applyToTC39Field(ctx: { name: string | symbol }, metaKey: symbol, entryKey: string, paramNameOrIndex: string | number) {
		return function (this: object, initialFn: unknown) {
			const existing = (McMetaRegistry.peekPendingMeta(this, ctx.name)?.get(metaKey) as Record<string, string | number>) ?? {};
			existing[entryKey] = paramNameOrIndex;
			McMetaRegistry.setPendingMeta(this, ctx.name, metaKey, existing);
			return initialFn;
		};
	}

	// 레거시 메서드 데코레이터
	private static applyToLegacyMethod(descriptor: any, metaKey: symbol, entryKey: string, paramNameOrIndex: string | number) {
		const existing = (McMetaRegistry.getFnMeta(descriptor.value, metaKey) as Record<string, string | number>) ?? {};
		existing[entryKey] = paramNameOrIndex;
		McMetaRegistry.setFnMeta(descriptor.value, metaKey, existing);
		return descriptor;
	}

	// 레거시 프로퍼티 데코레이터: 미해결 상태로 저장 — @GET setter에서 해결된다
	private static applyToLegacyProperty(proto: object, propName: string | symbol, metaKey: symbol, entryKey: string, paramNameOrIndex: string | number): void {
		const existing = (McMetaRegistry.getLegacyProtoPending(proto, propName).get(metaKey) as Record<string, string | number>) ?? {};
		existing[entryKey] = paramNameOrIndex;
		McMetaRegistry.setLegacyProtoPending(proto, propName, metaKey, existing);
	}
}
