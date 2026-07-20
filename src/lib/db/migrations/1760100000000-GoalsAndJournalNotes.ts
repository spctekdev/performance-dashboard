import { MigrationInterface, QueryRunner } from "typeorm";

export class GoalsAndJournalNotes1760100000000 implements MigrationInterface {
  name = "GoalsAndJournalNotes1760100000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "journal_category_enum" ADD VALUE IF NOT EXISTS 'NOTE'`);
    await queryRunner.query(
      `CREATE TYPE "goal_status_enum" AS ENUM ('BACKLOG', 'IN_PROGRESS', 'BLOCKED', 'UNDER_REVIEW', 'FINISHED')`,
    );
    await queryRunner.query(`CREATE TABLE "goals" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(), "userId" uuid NOT NULL, "description" text NOT NULL,
      "deadline" timestamptz NOT NULL, "status" "goal_status_enum" NOT NULL DEFAULT 'BACKLOG', "remarks" text NOT NULL DEFAULT '',
      "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_goals" PRIMARY KEY ("id"),
      CONSTRAINT "FK_goals_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    )`);
    await queryRunner.query(`CREATE INDEX "IDX_goals_user_deadline" ON "goals" ("userId", "deadline")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "goals"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "goal_status_enum"`);
    // PostgreSQL cannot remove an enum value safely; NOTE remains available after a rollback.
  }
}
