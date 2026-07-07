import McDecoratorContext, { type DualDec } from "../core/meta/McDecoratorContext";
import { ERROR_HANDLER_KEY, HANDLER_SYMBOL_MAP_KEY, SUCCESS_HANDLER_KEY } from "../core/meta/McMetaKeys";
import McMetaRegistry from "../core/meta/McMetaRegistry";

export default class McHandlerDecorator {
	private constructor() {}

	// SUCCESS/ERROR 핸들러 참조 데코레이터 (듀얼 모드): 엔드포인트 메서드/필드에
	// handler(Function 또는 Symbol) 참조를 metaKey 아래 저장한다.
	static reference(metaKey: symbol, handler: Function | symbol): DualDec {
		return ((arg0: any, arg1: any, arg2?: any): any => {
			if (McDecoratorContext.isTC39Context(arg1)) {
				return arg1.kind === "method" ? McHandlerDecorator.referenceOnTC39Method(arg0, metaKey, handler) : McHandlerDecorator.referenceOnTC39Field(arg1, metaKey, handler);
			}
			if (arg2 !== undefined) return McHandlerDecorator.referenceOnLegacyMethod(arg2, metaKey, handler);
			return McHandlerDecorator.referenceOnLegacyProperty(arg0, arg1, metaKey, handler);
		}) as DualDec;
	}

	private static referenceOnTC39Method(fn: Function, metaKey: symbol, handler: Function | symbol): void {
		McMetaRegistry.setFnMeta(fn, metaKey, handler);
	}

	private static referenceOnTC39Field(ctx: { name: string | symbol }, metaKey: symbol, handler: Function | symbol) {
		return function (this: object, initialFn: unknown) {
			McMetaRegistry.setPendingMeta(this, ctx.name, metaKey, handler);
			return initialFn;
		};
	}

	// 레거시 메서드 데코레이터
	private static referenceOnLegacyMethod(descriptor: any, metaKey: symbol, handler: Function | symbol) {
		if (typeof descriptor.value === "function") McMetaRegistry.setFnMeta(descriptor.value, metaKey, handler);
		return descriptor;
	}

	// 레거시 프로퍼티 데코레이터
	private static referenceOnLegacyProperty(proto: object, propName: string | symbol, metaKey: symbol, handler: Function | symbol): void {
		McMetaRegistry.setLegacyProtoPending(proto, propName, metaKey, handler);
	}

	// SUCCESS_HANDLER / ERROR_HANDLER — 핸들러 메서드를 표시한다 (메서드 전용, 필드 엔드포인트는 아님):
	// 이 메서드를 나중에 @SUCCESS(sym)/@ERROR(sym) 이 심볼로 찾아낼 수 있도록 등록한다.
	static register(sym: symbol) {
		return (arg0: any, arg1: any, arg2?: any): any => {
			// 1. TC39 표준 데코레이터 환경 처리
			if (McDecoratorContext.isTC39Context(arg1)) {
				if (arg1.kind === "method") return McHandlerDecorator.registerOnTC39Method(arg0, sym);
				if (arg1.kind === "field") return McHandlerDecorator.registerOnTC39Field(sym);
			}
			// 2. Legacy(구버전) 메서드 데코레이터 처리
			if (arg2?.value) return McHandlerDecorator.registerOnLegacyMethod(arg2, sym);
			// 3. Legacy(구버전) 화살표 함수 프로퍼티 처리
			return McHandlerDecorator.registerOnLegacyProperty(arg0, arg1, sym);
		};
	}

	private static registerOnTC39Method(fn: Function, sym: symbol): Function {
		McMetaRegistry.setFnMeta(fn, HANDLER_SYMBOL_MAP_KEY, sym);
		return fn;
	}

	private static registerOnTC39Field(sym: symbol) {
		return (val: any) => {
			if (typeof val === "function") {
				McMetaRegistry.setFnMeta(val, HANDLER_SYMBOL_MAP_KEY, sym);
			}
			return val;
		};
	}

	private static registerOnLegacyMethod(descriptor: any, sym: symbol) {
		McMetaRegistry.setFnMeta(descriptor.value, HANDLER_SYMBOL_MAP_KEY, sym);
		return descriptor;
	}

	private static registerOnLegacyProperty(proto: any, propName: string | symbol, sym: symbol): void {
		const shadowKey = Symbol(propName as string);
		Object.defineProperty(proto, propName, {
			configurable: true,
			enumerable: true,
			get() {
				return this[shadowKey];
			},
			set(val: unknown) {
				if (typeof val === "function") McMetaRegistry.setFnMeta(val as Function, HANDLER_SYMBOL_MAP_KEY, sym);
				this[shadowKey] = val;
			},
		});
	}
}

export const SUCCESS = (fn: Function | symbol): DualDec => McHandlerDecorator.reference(SUCCESS_HANDLER_KEY, fn);
export const ERROR = (fn: Function | symbol): DualDec => McHandlerDecorator.reference(ERROR_HANDLER_KEY, fn);
export const SUCCESS_HANDLER = (sym: symbol) => McHandlerDecorator.register(sym);
export const ERROR_HANDLER = (sym: symbol) => McHandlerDecorator.register(sym);
