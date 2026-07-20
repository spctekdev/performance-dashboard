import { NextRequest } from "next/server";
import { apiUser, assertCanManageDepartment } from "@/lib/auth/authorize";
import { getDataSource } from "@/lib/db/data-source";
import { Category, Knowledge, KnowledgeType } from "@/lib/db/entities";
import { assertSameOrigin, fail, HttpError, ok, parseBody } from "@/lib/http";
import { knowledgeSchema } from "@/lib/validation";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const actor = await apiUser(request);
    const input = await parseBody(request, knowledgeSchema);
    const db = await getDataSource();
    const existing = await db
      .getRepository(Knowledge)
      .findOne({ where: { id: (await params).id }, relations: { category: true } });
    if (!existing) throw new HttpError(404, "Knowledge entry not found");
    const category = await db.getRepository(Category).findOneBy({ id: input.categoryId });
    if (!category) throw new HttpError(404, "Category not found");
    await assertCanManageDepartment(actor, existing.category.departmentId);
    await assertCanManageDepartment(actor, category.departmentId);
    return ok(
      await db
        .getRepository(Knowledge)
        .save({ ...existing, type: input.type as KnowledgeType, categoryId: input.categoryId, content: input.content }),
    );
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const actor = await apiUser(request);
    const db = await getDataSource();
    const existing = await db
      .getRepository(Knowledge)
      .findOne({ where: { id: (await params).id }, relations: { category: true } });
    if (!existing) throw new HttpError(404, "Knowledge entry not found");
    await assertCanManageDepartment(actor, existing.category.departmentId);
    await db.getRepository(Knowledge).remove(existing);
    return ok({ message: "Knowledge entry deleted" });
  } catch (error) {
    return fail(error);
  }
}
