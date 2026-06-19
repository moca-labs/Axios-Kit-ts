import McEntity from "@moca-labs/entity-kit-ts";

@McEntity.ENTITY
export class PostEntity {
  @McEntity.FIELD(Number) id!: number;
  @McEntity.FIELD(Number) userId!: number;
  @McEntity.FIELD(String) title!: string;
  @McEntity.FIELD(String) body!: string;
}
