import { NextRequest } from "next/server";
import { In } from "typeorm";
import { getDataSource } from "@/lib/db/data-source";
import { AccessLevel, Department, User, UserStatus } from "@/lib/db/entities";
import { apiUser, getManagedDepartmentIds, requireAccess } from "@/lib/auth/authorize";
import { assertSameOrigin, fail, HttpError, ok, parseBody } from "@/lib/http";
import { createUserSchema } from "@/lib/validation";
import { hashPassword } from "@/lib/auth/crypto";
import { sendDashboardInvitationEmail } from "@/lib/email";
export async function GET(request: NextRequest) {
  try {
    const actor = await apiUser(request);
    const db = await getDataSource();
    const repo = db.getRepository(User);
    const departmentIds = actor.accessLevel === AccessLevel.MANAGER ? await getManagedDepartmentIds(actor.id) : [];
    const where =
      actor.accessLevel === AccessLevel.ADMIN
        ? {}
        : actor.accessLevel === AccessLevel.MANAGER && departmentIds.length
          ? [{ id: actor.id }, { departmentId: In(departmentIds) }]
          : { id: actor.id };
    const users = await repo.find({ where, relations: { role: true, department: true }, order: { name: "ASC" } });
    return ok(
      users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        emailVerified: u.emailVerified,
        departmentId: u.departmentId,
        departmentName: u.department?.name ?? null,
        role: { id: u.role.id, title: u.role.title },
        status: u.status,
        accessLevel: u.accessLevel,
        createdAt: u.createdAt,
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
    requireAccess(actor, AccessLevel.ADMIN, AccessLevel.MANAGER);
    const input = await parseBody(request, createUserSchema);
    const db = await getDataSource();
    const email = input.email.toLowerCase();
    if (await db.getRepository(User).findOneBy({ email })) throw new HttpError(409, "Email is already in use");
    const isAdmin = actor.accessLevel === AccessLevel.ADMIN;
    if (isAdmin && input.accessLevel === AccessLevel.ADMIN)
      throw new HttpError(422, "New users can only be employees or managers");
    if (!isAdmin && input.accessLevel !== AccessLevel.EMPLOYEE)
      throw new HttpError(403, "Managers can only create employee accounts");
    const accessLevel = isAdmin ? (input.accessLevel as AccessLevel) : AccessLevel.EMPLOYEE;
    const departmentIds = accessLevel === AccessLevel.MANAGER ? (input.departmentIds ?? []) : [input.departmentId!];
    const departments = await db.getRepository(Department).findBy({ id: In(departmentIds) });
    if (departments.length !== departmentIds.length) throw new HttpError(422, "Select valid departments");
    if (!isAdmin) {
      const managedDepartmentIds = await getManagedDepartmentIds(actor.id);
      if (!departmentIds.every((departmentId) => managedDepartmentIds.includes(departmentId)))
        throw new HttpError(403, "You can only add employees to departments you manage");
    }
    const user = await db.transaction(async (tx) => {
      const created = await tx.getRepository(User).save({
        name: input.name,
        email,
        password: await hashPassword(input.password),
        emailVerified: true,
        roleId: input.roleId,
        departmentId: accessLevel === AccessLevel.MANAGER ? null : departmentIds[0],
        accessLevel,
        status: input.status as UserStatus,
      });
      if (accessLevel === AccessLevel.MANAGER)
        await tx
          .createQueryBuilder()
          .insert()
          .into("department_managers")
          .values(departmentIds.map((departmentId) => ({ departmentId, managerId: created.id })))
          .execute();
      return created;
    });
    await sendDashboardInvitationEmail(user.email);
    return ok(
      { id: user.id, name: user.name, email: user.email, message: "Employee created and login invitation sent." },
      201,
    );
  } catch (error) {
    return fail(error);
  }
}
