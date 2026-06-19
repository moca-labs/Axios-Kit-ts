import McAxios from "@moca-labs/axios-kit-ts";
import McEntity from "@moca-labs/entity-kit-ts";

export class UpdatePostRequest extends McAxios.Request {
  @McEntity.SERIALIZE title!: string;
  @McEntity.SERIALIZE body!: string;
  @McEntity.SERIALIZE userId!: number;

  constructor(title: string, body: string, userId: number) {
    super();
    this.title = title;
    this.body = body;
    this.userId = userId;
  }
}
