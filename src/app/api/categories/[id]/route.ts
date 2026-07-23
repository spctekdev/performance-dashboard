import { NextRequest } from "next/server";
import { apiUser, assertCanManageDepartment } from "@/lib/auth/authorize";
import { getDataSource } from "@/lib/db/data-source";
import { Category } from "@/lib/db/entities";
import { assertSameOrigin, fail, HttpError, ok, parseBody } from "@/lib/http";
import { updateCategorySchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    assertSameOrigin(request);
    const actor = await apiUser(request);
    const input = await parseBody(request, updateCategorySchema);
    if (!Object.keys(input).length) throw new HttpError(422, "Provide a category change");
    const db = await getDataSource();
    const category = await db.getRepository(Category).findOneBy({ id: (await params).id });
    if (!category) throw new HttpError(404, "Category not found");
    await assertCanManageDepartment(actor, category.departmentId);
    await db.getRepository(Category).update(category.id, input);
    return ok({ message: "Category updated" });
  } catch (error) {
    return fail(error);
  }
}
