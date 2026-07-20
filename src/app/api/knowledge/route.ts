import { NextRequest } from "next/server";
import { apiUser, assertCanManageDepartment } from "@/lib/auth/authorize";
import { getDataSource } from "@/lib/db/data-source";
import { Category, Knowledge, KnowledgeType } from "@/lib/db/entities";
import { assertSameOrigin, fail, HttpError, ok, parseBody } from "@/lib/http";
import { knowledgeSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const actor = await apiUser(request);
    const input = await parseBody(request, knowledgeSchema);
    const db = await getDataSource();
    const category = await db.getRepository(Category).findOneBy({ id: input.categoryId });
    if (!category) throw new HttpError(404, "Category not found");
    await assertCanManageDepartment(actor, category.departmentId);
    return ok(
      await db
        .getRepository(Knowledge)
        .save({ type: input.type as KnowledgeType, categoryId: input.categoryId, content: input.content }),
      201,
    );
  } catch (error) {
    return fail(error);
  }
}
