import McDecoratorContext, { type DualDec } from "../core/meta/McDecoratorContext";
import { ERROR_HANDLER_KEY, HANDLER_SYMBOL_MAP_KEY, SUCCESS_HANDLER_KEY } from "../core/meta/McMetaKeys";
import McMetaRegistry from "../core/meta/McMetaRegistry";

// SUCCESS/ERROR 핸들러 참조 데코레이터 (듀얼 모드)
const handlerDec =
	(metaKey: symbol) =>
	(fn: Function | symbol): DualDec =>
		((arg0: any, arg1: any, arg2?: any): any => {
			if (McDecoratorContext.isTC39Context(arg1)) {
				if (arg1.kind === "method") {
					McMetaRegistry.setFnMeta(arg0, metaKey, fn);
				} else {
					return function (this: object, initialFn: unknown) {
						McMetaRegistry.setPendingMeta(this, arg1.name, metaKey, fn);
						return initialFn;
					};
				}
			} else if (arg2 !== undefined) {
				// 레거시 메서드 데코레이터
				if (typeof arg2.value === "function") McMetaRegistry.setFnMeta(arg2.value, metaKey, fn);
				return arg2;
			} else {
				// 레거시 프로퍼티 데코레이터
				McMetaRegistry.setLegacyProtoPending(arg0, arg1, metaKey, fn);
			}
		}) as DualDec;

// SUCCESS_HANDLER / ERROR_HANDLER — 핸들러 메서드를 표시한다 (메서드 전용, 필드 엔드포인트는 아님)
const symbolMapDec =
	() =>
	(sym: symbol): ((value: any, context: any, descriptor?: any) => any) =>
	(arg0: any, arg1: any, arg2?: any): any => {
		// 1. TC39 표준 데코레이터 환경 처리
		if (McDecoratorContext.isTC39Context(arg1)) {
			if (arg1.kind === "method") {
				McMetaRegistry.setFnMeta(arg0, HANDLER_SYMBOL_MAP_KEY, sym);
				return arg0;
			}
			if (arg1.kind === "field") {
				return (val: any) => {
					if (typeof val === "function") {
						McMetaRegistry.setFnMeta(val, HANDLER_SYMBOL_MAP_KEY, sym);
					}
					return val;
				};
			}
		}

		// 2. Legacy(구버전) 메서드 데코레이터 처리
		if (arg2?.value) {
			McMetaRegistry.setFnMeta(arg2.value, HANDLER_SYMBOL_MAP_KEY, sym);
			return arg2;
		}

		// 3. Legacy(구버전) 화살표 함수 프로퍼티 처리
		const shadowKey = Symbol(arg1);
		Object.defineProperty(arg0, arg1, {
			configurable: true,
			enumerable: true,
			get() {
				return this[shadowKey];
			},
			set(val) {
				if (typeof val === "function") McMetaRegistry.setFnMeta(val, HANDLER_SYMBOL_MAP_KEY, sym);
				this[shadowKey] = val;
			},
		});
	};

export const SUCCESS = handlerDec(SUCCESS_HANDLER_KEY);
export const ERROR = handlerDec(ERROR_HANDLER_KEY);
export const SUCCESS_HANDLER = symbolMapDec();
export const ERROR_HANDLER = symbolMapDec();
