import "reflect-metadata";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { AppDataSource } from "./data-source";
import { Category, Department, Knowledge, KnowledgeType } from "./entities";

type SourceEntry = {
  global: { category: string; subcategory: string };
  SOP?: { title: string; description: string; steps: { step_title: string; step_description: string }[]; tags: string[] }[];
  "Best Practice"?: { title: string; description: string; priority: "low" | "medium" | "high" }[];
  KPI?: { title: string; description: string; target_label: string | number; metadata: Record<string, string>[] }[];
};

async function importKnowledge() {
  const db = await AppDataSource.initialize();
  const departmentRepo = db.getRepository(Department);
  const categoryRepo = db.getRepository(Category);
  const knowledgeRepo = db.getRepository(Knowledge);
  const directory = path.join(process.cwd(), "sop-import");
  const files = (await readdir(directory)).filter((file) => file.endsWith(".json"));
  if (!files.length) throw new Error("No JSON files were found in sop-import.");

  const source = (await Promise.all(files.map(async (file) => JSON.parse(await readFile(path.join(directory, file), "utf8")) as SourceEntry[]))).flat();
  const categories = new Map<string, Category>();

  for (const group of source) {
    const departmentName = group.global.category.trim();
    const department = await departmentRepo.createQueryBuilder("department")
      .where("LOWER(department.name) = LOWER(:name)", { name: departmentName }).getOne();
    if (!department) throw new Error(`No department found for import category: ${departmentName}`);
    const categoryName = group.global.subcategory.trim();
    const key = `${department.id}:${categoryName.toLowerCase()}`;
    let category = categories.get(key) ?? await categoryRepo.findOneBy({ departmentId: department.id, name: categoryName });
    if (!category) category = await categoryRepo.save({ departmentId: department.id, name: categoryName });
    categories.set(key, category);
  }

  let imported = 0;
  for (const group of source) {
    const department = await departmentRepo.createQueryBuilder("department")
      .where("LOWER(department.name) = LOWER(:name)", { name: group.global.category.trim() }).getOneOrFail();
    const category = categories.get(`${department.id}:${group.global.subcategory.trim().toLowerCase()}`)!;
    const rows = [
      ...(group.SOP ?? []).map((content) => ({ type: KnowledgeType.SOP, content })),
      ...(group["Best Practice"] ?? []).map((content) => ({ type: KnowledgeType.BEST_PRACTICE, content })),
      ...(group.KPI ?? []).map((content) => ({ type: KnowledgeType.KPI, content })),
    ];
    for (const row of rows) {
      const existing = await knowledgeRepo.createQueryBuilder("knowledge")
        .where('knowledge."categoryId" = :categoryId', { categoryId: category.id })
        .andWhere('knowledge."type" = :type', { type: row.type })
        .andWhere("knowledge.content ->> 'title' = :title", { title: row.content.title })
        .getOne();
      if (existing) await knowledgeRepo.update(existing.id, { content: row.content });
      else await knowledgeRepo.save({ categoryId: category.id, type: row.type, content: row.content });
      imported++;
    }
  }

  console.log(`Knowledge import complete: ${imported} entries across ${categories.size} categories.`);
  await db.destroy();
}

importKnowledge().catch(async (error) => {
  console.error("Knowledge import failed:", error);
  if (AppDataSource.isInitialized) await AppDataSource.destroy();
  process.exit(1);
});
