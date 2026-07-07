import type { DualDec } from "../core/meta/McDecoratorContext";
import { HEADER_KEY } from "../core/meta/McMetaKeys";
import McRecordOverrideDecorator from "./support/McRecordOverrideDecorator";

// @HEADER("X-Header", "paramName" | index) — 듀얼 모드
// 화살표 함수 본문 스타일을 쓸 때는 문자열(파라미터 이름)을 전달한다.
// 본문이 없는 `!` 선언 스타일을 쓸 때는 숫자(인자 인덱스)를 전달한다.
export default class McHeaderDecorator {
	private constructor() {}

	static create(headerName: string, paramNameOrIndex: string | number): DualDec {
		return McRecordOverrideDecorator.build(HEADER_KEY, headerName, paramNameOrIndex);
	}
}

export const HEADER = McHeaderDecorator.create;
