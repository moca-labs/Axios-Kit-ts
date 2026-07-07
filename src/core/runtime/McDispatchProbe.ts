import McDispatchSentinel, { type Executor } from "./McDispatchSentinel";

export default class McDispatchProbe {
	private constructor() {}

	// fn.call(instance)을 호출해 dispatch(executor) 센티널을 반환했는지 탐지한다.
	// 찾으면 executor를, 아니면 undefined를 반환한다(기본 흐름).
	static probe(fn: Function, instance: object): Executor<unknown> | undefined {
		try {
			const result = fn.call(instance);
			if (result && typeof result === "object" && McDispatchSentinel.CUSTOM in result) {
				return (result as Record<symbol, unknown>)[McDispatchSentinel.CUSTOM] as Executor<unknown>;
			}
		} catch {
			/* stub() 또는 throw하는 무엇이든 → 기본 흐름 */
		}
		return undefined;
	}
}
