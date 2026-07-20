import { NextRequest } from "next/server";
import { In } from "typeorm";
import { apiUser, requireAccess } from "@/lib/auth/authorize";
import { getDataSource } from "@/lib/db/data-source";
import { AccessLevel, Department, Knowledge, User } from "@/lib/db/entities";
import { assertSameOrigin, fail, HttpError, ok, parseBody } from "@/lib/http";
import { updateDepartmentSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  try {
    assertSameOrigin(request);
    const actor = await apiUser(request);
    requireAccess(actor, AccessLevel.ADMIN);
    const { id } = await context.params;
    const input = await parseBody(request, updateDepartmentSchema);
    const db = await getDataSource();
    const duplicate = await db
      .getRepository(Department)
      .createQueryBuilder("department")
      .where("LOWER(department.name) = LOWER(:name)", { name: input.name })
      .andWhere("department.id <> :id", { id })
      .getOne();
    if (duplicate) throw new HttpError(409, "A department with this name already exists");
    const managerIds = input.managerIds ? [...new Set(input.managerIds)] : undefined;
    if (managerIds) {
      const managers = managerIds.length
        ? await db.getRepository(User).findBy({ id: In(managerIds), accessLevel: AccessLevel.MANAGER })
        : [];
      if (managers.length !== managerIds.length) throw new HttpError(422, "Select valid managers");
    }
    await db.transaction(async (tx) => {
      const result = await tx.getRepository(Department).update(id, { name: input.name });
      if (!result.affected) throw new HttpError(404, "Department not found");
      if (managerIds) {
        await tx.query(`DELETE FROM "department_managers" WHERE "departmentId" = $1`, [id]);
        if (managerIds.length) {
          await tx
            .createQueryBuilder()
            .insert()
            .into("department_managers")
            .values(managerIds.map((managerId) => ({ departmentId: id, managerId })))
            .execute();
        }
      }
    });
    return ok({ message: "Department updated" });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    assertSameOrigin(request);
    const actor = await apiUser(request);
    requireAccess(actor, AccessLevel.ADMIN);
    const { id } = await context.params;
    const db = await getDataSource();
    if (!(await db.getRepository(Department).findOneBy({ id }))) throw new HttpError(404, "Department not found");
    const [memberCount, knowledgeCount] = await Promise.all([
      db.getRepository(User).countBy({ departmentId: id }),
      db
        .getRepository(Knowledge)
        .createQueryBuilder("knowledge")
        .innerJoin("knowledge.category", "category")
        .where('category."departmentId" = :id', { id })
        .getCount(),
    ]);
    if (memberCount || knowledgeCount)
      throw new HttpError(
        409,
        "Reassign all department members and remove its knowledge entries before deleting this department",
      );
    await db.getRepository(Department).delete(id);
    return ok({ message: "Department deleted" });
  } catch (error) {
    return fail(error);
  }
}
