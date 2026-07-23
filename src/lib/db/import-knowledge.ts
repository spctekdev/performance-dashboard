import "reflect-metadata";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { DataSource } from "typeorm";
import { AppDataSource } from "./data-source";
import { Category, Department, Knowledge, KnowledgeType, type KnowledgeContent } from "./entities";

type OperationsEntry = {
  global: { category: string; department: string };
  SOP?: Extract<KnowledgeContent, { steps: unknown }>;
  "Best Practice"?: Extract<KnowledgeContent, { priority: unknown }>;
  KPI?: Extract<KnowledgeContent, { target_label: unknown }>;
};

const operationsDataPath = path.join(process.cwd(), "generated", "operations-data.transformed.json");
const operationsDepartmentId = "86926934-0e47-4919-8133-f906bc24964c";

export async function importOperationsKnowledge(db: DataSource): Promise<{ imported: number; categories: number }> {
  const source = JSON.parse(await readFile(operationsDataPath, "utf8")) as OperationsEntry[];
  if (!Array.isArray(source)) throw new Error("Transformed operations data must contain an array.");

  const categoryRepo = db.getRepository(Category);
  const knowledgeRepo = db.getRepository(Knowledge);
  const categories = new Map<string, Category>();
  let imported = 0;

  const departmentExists = await db.getRepository(Department).exist({ where: { id: operationsDepartmentId } });
  if (!departmentExists) throw new Error(`Operations department was not found: ${operationsDepartmentId}`);

  for (const group of source) {
    const categoryName = group.global.category.trim();
    if (!categoryName) throw new Error("Each operations entry requires a category.");

    const key = `${operationsDepartmentId}:${categoryName.toLowerCase()}`;
    let category =
      categories.get(key) ??
      (await categoryRepo.findOneBy({ departmentId: operationsDepartmentId, name: categoryName }));
    if (!category) {
      category = await categoryRepo.save({ departmentId: operationsDepartmentId, name: categoryName });
      console.log(`[category] added ${categoryName}`);
    }
    categories.set(key, category);

    const rows: Array<{ type: KnowledgeType; content: KnowledgeContent }> = [];
    if (group.SOP) rows.push({ type: KnowledgeType.SOP, content: group.SOP });
    if (group["Best Practice"]) rows.push({ type: KnowledgeType.BEST_PRACTICE, content: group["Best Practice"] });
    if (group.KPI) rows.push({ type: KnowledgeType.KPI, content: group.KPI });

    for (const row of rows) {
      const existing = await knowledgeRepo
        .createQueryBuilder("knowledge")
        .where('knowledge."categoryId" = :categoryId', { categoryId: category.id })
        .andWhere('knowledge."type" = :type', { type: row.type })
        .andWhere("knowledge.content ->> 'title' = :title", { title: row.content.title })
        .getOne();
      if (existing) await knowledgeRepo.update(existing.id, { content: row.content });
      else {
        await knowledgeRepo.save({ categoryId: category.id, type: row.type, content: row.content });
        console.log(`[knowledge] added ${row.type}: ${row.content.title}`);
      }
      imported++;
    }
  }

  return { imported, categories: categories.size };
}

async function runImport() {
  const db = await AppDataSource.initialize();
  const result = await importOperationsKnowledge(db);
  console.log(
    `Operations knowledge import complete: ${result.imported} entries across ${result.categories} categories.`,
  );
  await db.destroy();
}

const invokedAsScript = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedAsScript) {
  runImport().catch(async (error) => {
    console.error("Operations knowledge import failed:", error);
    if (AppDataSource.isInitialized) await AppDataSource.destroy();
    process.exit(1);
  });
}
