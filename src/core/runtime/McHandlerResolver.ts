import { isFunction, isSymbol } from "@moca-labs/entity-kit-ts";
import { HANDLER_SYMBOL_MAP_KEY } from "../meta/McMetaKeys";
import McMetaRegistry from "../meta/McMetaRegistry";

export default class McHandlerResolver {
	private constructor() {}

	static buildSymbolMap(proto: object): Map<symbol, string> {
		const map = new Map<symbol, string>();
		for (const name of Object.getOwnPropertyNames(proto)) {
			const fn = (proto as Record<string, unknown>)[name];
			if (typeof fn !== "function") continue;
			const sym = McMetaRegistry.getFnMeta(fn, HANDLER_SYMBOL_MAP_KEY);
			if (isSymbol(sym)) map.set(sym, name);
		}
		return map;
	}

	static resolveHandler(instance: object, handler: Function | symbol | undefined, symbolMap: Map<symbol, string>): ((...args: unknown[]) => Promise<unknown>) | undefined {
		if (isSymbol(handler)) {
			const methodName = symbolMap.get(handler);
			if (methodName) return (...args: unknown[]) => (instance as unknown as Record<string, Function>)[methodName](...args);
			return undefined;
		}
		if (isFunction(handler)) return (...args: unknown[]) => (handler as Function).call(instance, ...args);
		return undefined;
	}
}
