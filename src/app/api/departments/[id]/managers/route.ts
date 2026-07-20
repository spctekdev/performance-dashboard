import { NextRequest } from "next/server";
import { apiUser, requireAccess } from "@/lib/auth/authorize";
import { getDataSource } from "@/lib/db/data-source";
import { AccessLevel, Department, User } from "@/lib/db/entities";
import { assertSameOrigin, fail, HttpError, ok, parseBody } from "@/lib/http";
import { departmentManagerSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

async function authorizeAndParse(request: NextRequest, context: Context) {
  assertSameOrigin(request);
  const actor = await apiUser(request);
  requireAccess(actor, AccessLevel.ADMIN);
  const { id } = await context.params;
  const input = await parseBody(request, departmentManagerSchema);
  const db = await getDataSource();
  if (!(await db.getRepository(Department).findOneBy({ id }))) throw new HttpError(404, "Department not found");
  const manager = await db.getRepository(User).findOneBy({ id: input.managerId, accessLevel: AccessLevel.MANAGER });
  if (!manager) throw new HttpError(422, "Select a user with manager access");
  return { db, id, managerId: manager.id };
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const { db, id, managerId } = await authorizeAndParse(request, context);
    await db
      .createQueryBuilder()
      .insert()
      .into("department_managers")
      .values({ departmentId: id, managerId })
      .orIgnore()
      .execute();
    return ok({ message: "Manager assigned to department" });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const { db, id, managerId } = await authorizeAndParse(request, context);
    await db
      .createQueryBuilder()
      .delete()
      .from("department_managers")
      .where('"departmentId" = :id AND "managerId" = :managerId', { id, managerId })
      .execute();
    return ok({ message: "Manager removed from department" });
  } catch (error) {
    return fail(error);
  }
}
