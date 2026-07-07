import { ERROR_HANDLER_KEY, HEADER_KEY, METHOD_META_KEY, PATH_OVERRIDE_KEY, REQUEST_OVERRIDE_KEY, RESPONSE_TYPE_KEY, SUCCESS_HANDLER_KEY } from "../meta/McMetaKeys";
import McMetaRegistry from "../meta/McMetaRegistry";
import McHandlerResolver from "./McHandlerResolver";

export default class McEndpointMetaReader {
	private constructor() {}

	static read(proto: object, name: string) {
		const fn = (proto as Record<string, unknown>)[name];
		if (typeof fn !== "function") return null;
		const meta = McMetaRegistry.getFnMeta(fn, METHOD_META_KEY) as { method: string; path: string; paramNames?: readonly string[] } | undefined;
		if (!meta) return null;
		return {
			method: meta.method,
			path: meta.path,
			paramNames: meta.paramNames,
			fn,
			successHandler: McMetaRegistry.getFnMeta(fn, SUCCESS_HANDLER_KEY) as Function | symbol | undefined,
			errorHandler: McMetaRegistry.getFnMeta(fn, ERROR_HANDLER_KEY) as Function | symbol | undefined,
			responseType: McMetaRegistry.getFnMeta(fn, RESPONSE_TYPE_KEY),
			headerParam: (McMetaRegistry.getFnMeta(fn, HEADER_KEY) ?? {}) as Record<string, number>,
			pathOverride: (McMetaRegistry.getFnMeta(fn, PATH_OVERRIDE_KEY) ?? {}) as Record<string, number>,
			requestOverride: McMetaRegistry.getFnMeta(fn, REQUEST_OVERRIDE_KEY) as number | undefined,
			symbolMap: McHandlerResolver.buildSymbolMap(proto),
		};
	}
}
