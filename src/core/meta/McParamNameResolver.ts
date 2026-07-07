// ─── 파라미터 이름 리플렉션 (minify에 안전하지 않음 — 명시적 `params` 배열을 우선 사용) ─
export default class McParamNameResolver {
	private constructor() {}

	// 함수의 소스 텍스트에서 선언된 파라미터 이름을 파싱한다. 데코레이터의 `params` 인자가
	// 생략됐을 때의 폴백으로만 사용되며, 식별자를 뭉개는 minifier를 거치면 반환되는 이름이
	// 소스 코드에 적힌 것과 더 이상 일치하지 않아 깨진다.
	static extractParamNames(fn: Function): string[] {
		const match = fn.toString().match(/^[^(]*\(([^)]*)\)/);
		if (!match?.[1]?.trim()) return [];
		return match[1]
			.split(",")
			.map((p) =>
				p
					.trim()
					.split(/[\s:=<>|&?]/)[0]
					.trim()
					.replace(/^_/, ""),
			)
			.filter(Boolean);
	}

	static resolveParamIdx(nameOrIdx: string | number, paramNames: readonly string[]): number {
		return typeof nameOrIdx === "number" ? nameOrIdx : paramNames.indexOf(nameOrIdx);
	}

	static resolveRecord(raw: Record<string, string | number>, paramNames: readonly string[]): Record<string, number> {
		const resolved: Record<string, number> = {};
		for (const [name, nameOrIdx] of Object.entries(raw)) resolved[name] = McParamNameResolver.resolveParamIdx(nameOrIdx, paramNames);
		return resolved;
	}
}
