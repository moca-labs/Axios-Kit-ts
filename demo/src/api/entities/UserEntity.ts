import McEntity from "@moca-labs/entity-kit-ts";

@McEntity.ENTITY
export class UserEntity {
  @McEntity.FIELD(Number) id!: number;
  @McEntity.FIELD(String) name!: string;
  @McEntity.FIELD(String) username!: string;
  @McEntity.FIELD(String) email!: string;
  @McEntity.FIELD(String) phone!: string;
  @McEntity.FIELD(String) website!: string;
  @McEntity.FIELD(String, "address.city") city!: string;
  @McEntity.FIELD(String, "company.name") company!: string;
}
