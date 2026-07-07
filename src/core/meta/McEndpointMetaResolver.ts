import { BODY_FN_KEY, HAS_INITIALIZER_KEY, HEADER_KEY, PARAM_NAMES_KEY, PATH_OVERRIDE_KEY, REQUEST_OVERRIDE_KEY } from "./McMetaKeys";
import McMetaRegistry from "./McMetaRegistry";
import McParamNameResolver from "./McParamNameResolver";

export default class McEndpointMetaResolver {
	private constructor() {}

	// 레거시 프로퍼티 데코레이터 모드에서 프로토타입 단위 대기 메타로부터 해결된 메타 Map을 만든다.
	// 파라미터 이름은 방금 대입된 화살표 함수(initialFn)에서 가져온다.
	static resolveLegacyMeta(proto: object, propName: string | symbol, paramNames: readonly string[], initialFn: unknown): Map<symbol, unknown> {
		const protoMeta = McMetaRegistry.getLegacyProtoPending(proto, propName);
		const meta = new Map<symbol, unknown>();
		for (const [k, v] of protoMeta) {
			if (k === HEADER_KEY || k === PATH_OVERRIDE_KEY) {
				meta.set(k, McParamNameResolver.resolveRecord(v as Record<string, string | number>, paramNames));
			} else if (k === REQUEST_OVERRIDE_KEY) {
				meta.set(k, McParamNameResolver.resolveParamIdx(v as string | number, paramNames));
			} else {
				meta.set(k, v);
			}
		}
		meta.set(PARAM_NAMES_KEY, paramNames);
		meta.set(HAS_INITIALIZER_KEY, initialFn != null);
		if (initialFn != null) meta.set(BODY_FN_KEY, initialFn);
		return meta;
	}

	// @HEADER/@PATH/@REQUEST (TC39 메서드/필드 모드)는 바깥쪽 @GET/@POST …가 적용되기 *전에*
	// 실행되므로 (데코레이터는 아래에서 위로 적용됨) 문자열 이름을 인덱스로 스스로 해결할 수
	// 없다 — 대신 원본 이름/인덱스를 미해결 상태로 저장한다. 이 두 메서드는 paramNames가 마침내
	// 알려졌을 때 그 해결을 수행하며, 레거시 프로퍼티 모드에서 resolveLegacyMeta가 하는 일과 같다.
	static resolveFnNameRefs(fn: Function, paramNames: readonly string[]): void {
		const header = McMetaRegistry.getFnMeta(fn, HEADER_KEY) as Record<string, string | number> | undefined;
		if (header) McMetaRegistry.setFnMeta(fn, HEADER_KEY, McParamNameResolver.resolveRecord(header, paramNames));
		const path = McMetaRegistry.getFnMeta(fn, PATH_OVERRIDE_KEY) as Record<string, string | number> | undefined;
		if (path) McMetaRegistry.setFnMeta(fn, PATH_OVERRIDE_KEY, McParamNameResolver.resolveRecord(path, paramNames));
		const request = McMetaRegistry.getFnMeta(fn, REQUEST_OVERRIDE_KEY) as string | number | undefined;
		if (request !== undefined) McMetaRegistry.setFnMeta(fn, REQUEST_OVERRIDE_KEY, McParamNameResolver.resolveParamIdx(request, paramNames));
	}

	static resolvePendingNameRefs(meta: Map<symbol, unknown>, paramNames: readonly string[]): void {
		const header = meta.get(HEADER_KEY) as Record<string, string | number> | undefined;
		if (header) meta.set(HEADER_KEY, McParamNameResolver.resolveRecord(header, paramNames));
		const path = meta.get(PATH_OVERRIDE_KEY) as Record<string, string | number> | undefined;
		if (path) meta.set(PATH_OVERRIDE_KEY, McParamNameResolver.resolveRecord(path, paramNames));
		const request = meta.get(REQUEST_OVERRIDE_KEY) as string | number | undefined;
		if (request !== undefined) meta.set(REQUEST_OVERRIDE_KEY, McParamNameResolver.resolveParamIdx(request, paramNames));
	}
}
