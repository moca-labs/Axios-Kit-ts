// 공개 진입점 — 이 라이브러리를 사용하려면 앱이 import 해야 하는 모든 것.
import McAxiosCore from "./core/McAxiosCore";
import McAxiosManager from "./core/McAxiosManager";
import McRequest from "./core/McRequest";
import McResponse from "./core/McResponse";
import { ERROR, ERROR_HANDLER, SUCCESS, SUCCESS_HANDLER } from "./decorators/McHandlerDecorator";
import { HEADER } from "./decorators/McHeaderDecorator";
import { DELETE, GET, MULTIPART, PATCH, POST, PUT } from "./decorators/McHttpMethodDecorator";
import { PATH } from "./decorators/McPathDecorator";
import { REQUEST } from "./decorators/McRequestDecorator";

const McAxios = Object.assign(McAxiosCore, {
	Manager: McAxiosManager,
	Request: McRequest,
	Response: McResponse,
	GET,
	POST,
	PUT,
	DELETE,
	MULTIPART,
	PATCH,
	PATH,
	REQUEST,
	HEADER,
	SUCCESS,
	ERROR,
	SUCCESS_HANDLER,
	ERROR_HANDLER,
});

export default McAxios;
export { McAxios, McAxiosManager, McRequest, McResponse };
