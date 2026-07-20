import { NextRequest } from "next/server";
import { In } from "typeorm";
import { apiUser, getManagedDepartmentIds, requireAccess } from "@/lib/auth/authorize";
import { getDataSource } from "@/lib/db/data-source";
import { AccessLevel, Department } from "@/lib/db/entities";
import { assertSameOrigin, fail, HttpError, ok, parseBody } from "@/lib/http";
import { departmentSchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const actor = await apiUser(request);
    requireAccess(actor, AccessLevel.ADMIN, AccessLevel.MANAGER);
    const db = await getDataSource();
    const ids = actor.accessLevel === AccessLevel.MANAGER ? await getManagedDepartmentIds(actor.id) : [];
    const departments =
      actor.accessLevel === AccessLevel.ADMIN
        ? await db.getRepository(Department).find({ relations: { managers: true }, order: { name: "ASC" } })
        : ids.length
          ? await db
              .getRepository(Department)
              .find({ where: { id: In(ids) }, relations: { managers: true }, order: { name: "ASC" } })
          : [];
    return ok(
      departments.map((department) => ({
        id: department.id,
        name: department.name,
        managers: department.managers.map((manager) => ({ id: manager.id, name: manager.name })),
      })),
    );
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const actor = await apiUser(request);
    requireAccess(actor, AccessLevel.ADMIN);
    const input = await parseBody(request, departmentSchema);
    const db = await getDataSource();
    const existing = await db.getRepository(Department).findOneBy({ name: input.name });
    if (existing) throw new HttpError(409, "A department with this name already exists");
    const department = await db.getRepository(Department).save(input);
    return ok({ id: department.id, name: department.name, message: "Department created" }, 201);
  } catch (error) {
    return fail(error);
  }
}
