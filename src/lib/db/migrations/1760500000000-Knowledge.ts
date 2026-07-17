import { MigrationInterface, QueryRunner } from "typeorm";

export class Knowledge1760500000000 implements MigrationInterface {
  name = "Knowledge1760500000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "sops"`);
    await queryRunner.query(`CREATE TABLE "categories" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" varchar(120) NOT NULL, "departmentId" uuid NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_categories" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_categories_department_name" UNIQUE ("departmentId", "name"),
      CONSTRAINT "FK_categories_department" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE
    )`);
    await queryRunner.query(`CREATE TYPE "knowledge_type_enum" AS ENUM ('SOP', 'BEST_PRACTICE', 'KPI')`);
    await queryRunner.query(`CREATE TABLE "knowledge" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(), "type" "knowledge_type_enum" NOT NULL,
      "categoryId" uuid NOT NULL, "content" jsonb NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_knowledge" PRIMARY KEY ("id"),
      CONSTRAINT "FK_knowledge_category" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE
    )`);
    await queryRunner.query(`CREATE INDEX "IDX_categories_department" ON "categories" ("departmentId")`);
    await queryRunner.query(`CREATE INDEX "IDX_knowledge_category" ON "knowledge" ("categoryId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "knowledge"`);
    await queryRunner.query(`DROP TABLE "categories"`);
    await queryRunner.query(`DROP TYPE "knowledge_type_enum"`);
    await queryRunner.query(`CREATE TABLE "sops" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" varchar(160) NOT NULL, "description" text NOT NULL, "departmentId" uuid NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_sops" PRIMARY KEY ("id"), CONSTRAINT "UQ_sops_department_name" UNIQUE ("departmentId", "name"),
      CONSTRAINT "FK_sops_department" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE
    )`);
    await queryRunner.query(`CREATE INDEX "IDX_sops_department" ON "sops" ("departmentId")`);
  }
}
