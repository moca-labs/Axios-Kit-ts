import type { DualDec } from "../core/meta/McDecoratorContext";
import { PATH_OVERRIDE_KEY } from "../core/meta/McMetaKeys";
import McRecordOverrideDecorator from "./support/McRecordOverrideDecorator";

// @PATH("urlKey", "paramName" | index) — 듀얼 모드
// 화살표 함수 본문 스타일을 쓸 때는 문자열(파라미터 이름)을 전달한다.
// 본문이 없는 `!` 선언 스타일을 쓸 때는 숫자(인자 인덱스)를 전달한다.
export default class McPathDecorator {
	private constructor() {}

	static create(urlKey: string, paramNameOrIndex: string | number): DualDec {
		return McRecordOverrideDecorator.build(PATH_OVERRIDE_KEY, urlKey, paramNameOrIndex);
	}
}

export const PATH = McPathDecorator.create;
