import type { AxiosResponse } from "axios";

export type Executor<T> = (response: AxiosResponse, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void;

// dispatch()가 반환하는 센티널 — McAxiosCore.dispatch()가 만들고 McDispatchProbe가 탐지한다.
export default class McDispatchSentinel {
	private constructor() {}

	static readonly DEFAULT = Symbol("mc:default");
	static readonly CUSTOM = Symbol("mc:custom");
}
