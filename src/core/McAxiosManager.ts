import type McAxiosCore from "./McAxiosCore";

export default class McAxiosManager {
	private static _axios: McAxiosCore[] = [];

	private constructor() {}

	public static createMcAxios<T extends McAxiosCore>(api: T): T {
		McAxiosManager.add(api);
		return api;
	}

	public static set(servers: McAxiosCore[]) {
		McAxiosManager.clear();
		for (const axios of servers) McAxiosManager.add(axios);
	}

	public static add(axios: McAxiosCore) {
		McAxiosManager._axios.push(axios);
	}

	public static get<T extends McAxiosCore>(type: abstract new (...args: any[]) => T): T {
		const result = McAxiosManager._axios.find((axios) => axios instanceof type);
		if (result) return result as T;
		throw new Error(`Axios is undefined : ${type.name}`);
	}

	// public static delete(type: object) {
	// 	return McAxiosManager._axios.splice(type);
	// }

	public static clear() {
		McAxiosManager._axios = [];
	}
}
