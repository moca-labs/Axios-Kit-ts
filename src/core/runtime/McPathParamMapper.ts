export default class McPathParamMapper {
	private constructor() {}

	static buildAutoPathParams(url: string, paramNames: readonly string[]): Record<string, number> {
		const result: Record<string, number> = {};
		for (const [, key] of url.matchAll(/\{(\w+)\}/g)) {
			const idx = paramNames.indexOf(key);
			if (idx >= 0) result[key] = idx;
		}
		return result;
	}

	// 본문이 없는 `!` 선언에 사용: URL 플레이스홀더를 등장 순서대로 인자에 매핑한다.
	static buildOrderedPathParams(url: string): Record<string, number> {
		const result: Record<string, number> = {};
		let idx = 0;
		for (const [, key] of url.matchAll(/\{(\w+)\}/g)) {
			result[key] = idx++;
		}
		return result;
	}
}
