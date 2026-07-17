import "dotenv/config";
import { timingSafeEqual } from "crypto";
import { createInterface } from "readline/promises";
import { stdin as input, stdout as output } from "process";
import { AppDataSource } from "./data-source";

const TABLES = [
  '"sessions"',
  '"auth_tokens"',
  '"auth_rate_limits"',
  '"user_kpi_performance"',
  '"journals"',
  '"goals"',
  '"knowledge"',
  '"categories"',
  '"department_managers"',
  '"role_kpi_assignments"',
  '"users"',
  '"departments"',
  '"kpi_definitions"',
  '"roles"',
].join(", ");

function passwordsMatch(provided: string, expected: string) {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);
}

async function clearDatabase() {
  const expectedPassword = process.env.ADMIN_PASSWORD;
  if (!expectedPassword) {
    throw new Error("ADMIN_PASSWORD is required in .env before data can be cleared.");
  }
  if (!input.isTTY) {
    throw new Error("db:clear must run in an interactive terminal so it can request ADMIN_PASSWORD.");
  }

  const readline = createInterface({ input, output });
  try {
    output.write(
      "\nWARNING: This permanently removes all application data while preserving tables and migration history.\n",
    );
    const password = await readline.question("Enter ADMIN_PASSWORD to continue: ");
    if (!passwordsMatch(password, expectedPassword)) {
      throw new Error("Password did not match. No data was changed.");
    }

    await AppDataSource.initialize();
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await queryRunner.query(`TRUNCATE TABLE ${TABLES} RESTART IDENTITY CASCADE`);
      await queryRunner.commitTransaction();
      console.log("Application data cleared. Tables and migration history were preserved.");
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  } finally {
    readline.close();
    if (AppDataSource.isInitialized) await AppDataSource.destroy();
  }
}

clearDatabase().catch((error) => {
  console.error("Database clear aborted:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
