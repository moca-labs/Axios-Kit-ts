// ─── 메타데이터 저장소 ───────────────────────────────────────────────────────
// fnMeta/pendingFieldMeta/legacyProtoPendingMeta 3개의 WeakMap을 캡슐화해서
// 데코레이터들이 원시 WeakMap을 직접 만지지 않고 이 클래스의 정적 메서드로만 접근하게 한다.
export default class McMetaRegistry {
	private constructor() {}

	// 메서드 단위 메타데이터 (메서드 데코레이터 스타일)
	private static readonly fnMeta = new WeakMap<Function, Map<symbol, unknown>>();

	// 필드 단위 대기 메타데이터: 필드 초기화 중 인스턴스별로 누적된다
	// (TC39 모드: 바깥쪽 @GET이 읽기 전에 @HEADER, @PATH 같은 안쪽 데코레이터가 사용)
	private static readonly pendingFieldMeta = new WeakMap<object, Map<string | symbol, Map<symbol, unknown>>>();

	// 레거시 프로퍼티 데코레이터 모드: 클래스 정의 중 프로토타입 단위로 메타데이터를 누적한다.
	// HEADER_KEY / PATH_OVERRIDE_KEY 값은 Record<string, string|number>
	// (미해결 파라미터 이름) 형태로 저장되고, 화살표 함수가 대입될 때 setter에서 해결된다.
	private static readonly legacyProtoPendingMeta = new WeakMap<object, Map<string | symbol, Map<symbol, unknown>>>();

	static setFnMeta(fn: Function, key: symbol, value: unknown): void {
		let m = McMetaRegistry.fnMeta.get(fn);
		if (!m) {
			m = new Map();
			McMetaRegistry.fnMeta.set(fn, m);
		}
		m.set(key, value);
	}

	static getFnMeta(fn: Function, key: symbol): unknown {
		return McMetaRegistry.fnMeta.get(fn)?.get(key);
	}

	static setPendingMeta(instance: object, name: string | symbol, key: symbol, value: unknown): void {
		let fields = McMetaRegistry.pendingFieldMeta.get(instance);
		if (!fields) {
			fields = new Map();
			McMetaRegistry.pendingFieldMeta.set(instance, fields);
		}
		let meta = fields.get(name);
		if (!meta) {
			meta = new Map();
			fields.set(name, meta);
		}
		meta.set(key, value);
	}

	static consumePendingMeta(instance: object, name: string | symbol): Map<symbol, unknown> {
		const fields = McMetaRegistry.pendingFieldMeta.get(instance);
		const meta = fields?.get(name) ?? new Map<symbol, unknown>();
		fields?.delete(name);
		return meta;
	}

	// 소비하지 않고 대기 중인 필드 메타를 읽기 전용으로 들여다본다 — 바깥쪽 @GET/@POST …가
	// 소비하기 전에 이미 대기 중인 맵에 병합하기 위해 @HEADER/@PATH가 사용한다.
	static peekPendingMeta(instance: object, name: string | symbol): Map<symbol, unknown> | undefined {
		return McMetaRegistry.pendingFieldMeta.get(instance)?.get(name);
	}

	static setLegacyProtoPending(proto: object, propName: string | symbol, key: symbol, value: unknown): void {
		let fields = McMetaRegistry.legacyProtoPendingMeta.get(proto);
		if (!fields) {
			fields = new Map();
			McMetaRegistry.legacyProtoPendingMeta.set(proto, fields);
		}
		let meta = fields.get(propName);
		if (!meta) {
			meta = new Map();
			fields.set(propName, meta);
		}
		meta.set(key, value);
	}

	static getLegacyProtoPending(proto: object, propName: string | symbol): Map<symbol, unknown> {
		return McMetaRegistry.legacyProtoPendingMeta.get(proto)?.get(propName) ?? new Map<symbol, unknown>();
	}
}
