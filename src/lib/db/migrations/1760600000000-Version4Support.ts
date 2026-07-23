import { MigrationInterface, QueryRunner } from "typeorm";

export class Version4Support1760600000000 implements MigrationInterface {
  name = "Version4Support1760600000000";
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "categories" ADD "description" varchar(500) NOT NULL DEFAULT 'Place Holder'`);
    await queryRunner.query(`CREATE TYPE "chat_message_role_enum" AS ENUM ('USER','ASSISTANT','TOOL')`);
    await queryRunner.query(`CREATE TYPE "chat_message_status_enum" AS ENUM ('PENDING','COMPLETED','FAILED')`);
    await queryRunner.query(`CREATE TYPE "inquiry_status_enum" AS ENUM ('OPEN','ANSWERED','CLOSED')`);
    await queryRunner.query(
      `CREATE TYPE "inquiry_reference_type_enum" AS ENUM ('GOAL','JOURNAL_ENTRY','KPI_DEFINITION','KPI_PERFORMANCE','KNOWLEDGE','NONE')`,
    );
    await queryRunner.query(`CREATE TYPE "inquiry_delivery_status_enum" AS ENUM ('PENDING','SENT','FAILED')`);
    await queryRunner.query(
      `CREATE TABLE "chat_sessions" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "userId" uuid NOT NULL, "title" varchar(120) NOT NULL, "archived" boolean NOT NULL DEFAULT false, "lastMessageAt" timestamptz NOT NULL DEFAULT now(), "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(), CONSTRAINT "PK_chat_sessions" PRIMARY KEY ("id"), CONSTRAINT "FK_chat_sessions_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_chat_sessions_user_last" ON "chat_sessions" ("userId", "lastMessageAt")`,
    );
    await queryRunner.query(
      `CREATE TABLE "chat_messages" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "sessionId" uuid NOT NULL, "role" "chat_message_role_enum" NOT NULL, "status" "chat_message_status_enum" NOT NULL DEFAULT 'COMPLETED', "content" text NOT NULL DEFAULT '', "toolCalls" jsonb, "toolResults" jsonb, "createdAt" timestamptz NOT NULL DEFAULT now(), CONSTRAINT "PK_chat_messages" PRIMARY KEY ("id"), CONSTRAINT "FK_chat_messages_session" FOREIGN KEY ("sessionId") REFERENCES "chat_sessions"("id") ON DELETE CASCADE)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_chat_messages_session_created" ON "chat_messages" ("sessionId", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE TABLE "inquiries" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "employeeId" uuid NOT NULL, "departmentId" uuid NOT NULL, "subject" varchar(180) NOT NULL, "status" "inquiry_status_enum" NOT NULL DEFAULT 'OPEN', "referenceType" "inquiry_reference_type_enum" NOT NULL DEFAULT 'NONE', "referenceId" uuid, "referenceLabel" varchar(240), "lastMessageAt" timestamptz NOT NULL DEFAULT now(), "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(), CONSTRAINT "PK_inquiries" PRIMARY KEY ("id"), CONSTRAINT "FK_inquiries_employee" FOREIGN KEY ("employeeId") REFERENCES "users"("id") ON DELETE RESTRICT, CONSTRAINT "FK_inquiries_department" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT, CONSTRAINT "CHK_inquiries_subject" CHECK (length(trim("subject")) > 0))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_inquiries_employee_last" ON "inquiries" ("employeeId", "lastMessageAt")`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_inquiries_department_status" ON "inquiries" ("departmentId", "status")`);
    await queryRunner.query(
      `CREATE TABLE "inquiry_recipients" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "inquiryId" uuid NOT NULL, "managerId" uuid NOT NULL, "deliveryStatus" "inquiry_delivery_status_enum" NOT NULL DEFAULT 'PENDING', "deliveryError" varchar(500), "notifiedAt" timestamptz, "readAt" timestamptz, CONSTRAINT "PK_inquiry_recipients" PRIMARY KEY ("id"), CONSTRAINT "UQ_inquiry_recipients_pair" UNIQUE ("inquiryId", "managerId"), CONSTRAINT "FK_inquiry_recipients_inquiry" FOREIGN KEY ("inquiryId") REFERENCES "inquiries"("id") ON DELETE CASCADE, CONSTRAINT "FK_inquiry_recipients_manager" FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE RESTRICT)`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_inquiry_recipients_manager" ON "inquiry_recipients" ("managerId")`);
    await queryRunner.query(
      `CREATE TABLE "inquiry_messages" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "inquiryId" uuid NOT NULL, "authorId" uuid NOT NULL, "body" text NOT NULL, "createdAt" timestamptz NOT NULL DEFAULT now(), CONSTRAINT "PK_inquiry_messages" PRIMARY KEY ("id"), CONSTRAINT "FK_inquiry_messages_inquiry" FOREIGN KEY ("inquiryId") REFERENCES "inquiries"("id") ON DELETE CASCADE, CONSTRAINT "FK_inquiry_messages_author" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT, CONSTRAINT "CHK_inquiry_messages_body" CHECK (length(trim("body")) > 0))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_inquiry_messages_inquiry_created" ON "inquiry_messages" ("inquiryId", "createdAt")`,
    );
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "inquiry_messages"`);
    await queryRunner.query(`DROP TABLE "inquiry_recipients"`);
    await queryRunner.query(`DROP TABLE "inquiries"`);
    await queryRunner.query(`DROP TABLE "chat_messages"`);
    await queryRunner.query(`DROP TABLE "chat_sessions"`);
    await queryRunner.query(`DROP TYPE "inquiry_delivery_status_enum"`);
    await queryRunner.query(`DROP TYPE "inquiry_reference_type_enum"`);
    await queryRunner.query(`DROP TYPE "inquiry_status_enum"`);
    await queryRunner.query(`DROP TYPE "chat_message_status_enum"`);
    await queryRunner.query(`DROP TYPE "chat_message_role_enum"`);
    await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN "description"`);
  }
}
