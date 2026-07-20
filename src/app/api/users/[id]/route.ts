import { NextRequest } from "next/server";
import { In } from "typeorm";
import { getDataSource } from "@/lib/db/data-source";
import { AccessLevel, Department, User, UserStatus } from "@/lib/db/entities";
import { apiUser, assertCanAccessUser, requireAccess } from "@/lib/auth/authorize";
import { assertSameOrigin, fail, HttpError, ok, parseBody } from "@/lib/http";
import { updateUserSchema } from "@/lib/validation";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, context: Context) {
  try {
    const actor = await apiUser(request);
    const { id } = await context.params;
    await assertCanAccessUser(actor, id);
    const db = await getDataSource();
    const user = await db.getRepository(User).findOne({ where: { id }, relations: { role: true, department: true } });
    if (!user) throw new HttpError(404, "User not found");
    return ok({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      role: user.role,
      departmentId: user.departmentId,
      departmentName: user.department?.name ?? null,
      status: user.status,
      accessLevel: user.accessLevel,
    });
  } catch (error) {
    return fail(error);
  }
}
export async function PATCH(request: NextRequest, context: Context) {
  try {
    assertSameOrigin(request);
    const actor = await apiUser(request);
    const { id } = await context.params;
    const input = await parseBody(request, updateUserSchema);
    const db = await getDataSource();
    if (actor.accessLevel === AccessLevel.MANAGER) {
      await assertCanAccessUser(actor, id);
      if (id === actor.id || Object.keys(input).some((key) => key !== "roleId"))
        throw new HttpError(403, "Managers can only update roles for their employees");
      const target = await db.getRepository(User).findOneBy({ id });
      if (!target) throw new HttpError(404, "User not found");
      if (target.accessLevel !== AccessLevel.EMPLOYEE)
        throw new HttpError(403, "Managers can only update employee accounts");
      const result = await db.getRepository(User).update(id, { roleId: input.roleId });
      if (!result.affected) throw new HttpError(404, "User not found");
      return ok({ message: "User updated" });
    }
    requireAccess(actor, AccessLevel.ADMIN);
    if (input.accessLevel === AccessLevel.ADMIN) throw new HttpError(422, "Users cannot be made administrators here");
    if (input.departmentId) {
      const department = await db.getRepository(Department).findOneBy({ id: input.departmentId });
      if (!department) throw new HttpError(422, "Select a valid department");
    }
    const { departmentIds, ...userInput } = input;
    const update = {
      ...userInput,
      status: userInput.status as UserStatus | undefined,
      accessLevel: userInput.accessLevel as AccessLevel | undefined,
    };
    await db.transaction(async (tx) => {
      const current = await tx.getRepository(User).findOneBy({ id });
      if (!current) throw new HttpError(404, "User not found");
      const nextAccessLevel = (input.accessLevel as AccessLevel | undefined) ?? current.accessLevel;
      const managerDepartmentIds = departmentIds ? [...new Set(departmentIds)] : undefined;
      if (nextAccessLevel === AccessLevel.MANAGER && managerDepartmentIds && !managerDepartmentIds.length)
        throw new HttpError(422, "Select at least one managed department");
      if (
        nextAccessLevel === AccessLevel.MANAGER &&
        current.accessLevel !== AccessLevel.MANAGER &&
        !managerDepartmentIds
      )
        throw new HttpError(422, "Select at least one managed department");
      const nextDepartmentId = input.departmentId === undefined ? current.departmentId : input.departmentId;
      if (nextAccessLevel !== AccessLevel.MANAGER && !nextDepartmentId) throw new HttpError(422, "Select a department");
      if (managerDepartmentIds) {
        const departments = managerDepartmentIds.length
          ? await tx.getRepository(Department).findBy({ id: In(managerDepartmentIds) })
          : [];
        if (departments.length !== managerDepartmentIds.length) throw new HttpError(422, "Select valid departments");
      }
      await tx.getRepository(User).update(id, {
        ...update,
        departmentId: nextAccessLevel === AccessLevel.MANAGER ? null : nextDepartmentId,
      });
      if (nextAccessLevel !== AccessLevel.MANAGER) {
        await tx.query(`DELETE FROM "department_managers" WHERE "managerId" = $1`, [id]);
      } else if (managerDepartmentIds) {
        await tx.query(`DELETE FROM "department_managers" WHERE "managerId" = $1`, [id]);
        if (managerDepartmentIds.length) {
          await tx
            .createQueryBuilder()
            .insert()
            .into("department_managers")
            .values(managerDepartmentIds.map((departmentId) => ({ departmentId, managerId: id })))
            .execute();
        }
      }
    });
    return ok({ message: "User updated" });
  } catch (error) {
    return fail(error);
  }
}
