import { NextRequest } from "next/server";
import { In } from "typeorm";
import { apiUser, assertCanManageDepartment, getManagedDepartmentIds } from "@/lib/auth/authorize";
import { getDataSource } from "@/lib/db/data-source";
import { AccessLevel, Category } from "@/lib/db/entities";
import { assertSameOrigin, fail, HttpError, ok, parseBody } from "@/lib/http";
import { categorySchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const actor = await apiUser(request);
    const ids =
      actor.accessLevel === AccessLevel.ADMIN
        ? undefined
        : actor.accessLevel === AccessLevel.MANAGER
          ? await getManagedDepartmentIds(actor.id)
          : actor.departmentId
            ? [actor.departmentId]
            : [];
    const rows =
      ids === undefined
        ? await (await getDataSource()).getRepository(Category).find({ order: { name: "ASC" } })
        : ids.length
          ? await (
              await getDataSource()
            )
              .getRepository(Category)
              .find({ where: { departmentId: In(ids) }, order: { name: "ASC" } })
          : [];
    return ok(rows.map(({ id, name, description, departmentId }) => ({ id, name, description, departmentId })));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const actor = await apiUser(request);
    const input = await parseBody(request, categorySchema);
    await assertCanManageDepartment(actor, input.departmentId);
    const repo = (await getDataSource()).getRepository(Category);
    if (await repo.findOneBy({ departmentId: input.departmentId, name: input.name }))
      throw new HttpError(409, "Category already exists");
    return ok(await repo.save(input), 201);
  } catch (error) {
    return fail(error);
  }
}
