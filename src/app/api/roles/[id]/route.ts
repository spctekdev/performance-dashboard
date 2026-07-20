import { NextRequest } from "next/server";
import { AccessLevel, Role } from "@/lib/db/entities";
import { getDataSource } from "@/lib/db/data-source";
import { apiUser, requireAccess } from "@/lib/auth/authorize";
import { assertSameOrigin, fail, HttpError, ok, parseBody } from "@/lib/http";
import { updateRoleSchema } from "@/lib/validation";
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const actor = await apiUser(request);
    requireAccess(actor, AccessLevel.ADMIN);
    const input = await parseBody(request, updateRoleSchema);
    const { id } = await params;
    const db = await getDataSource();
    if (input.title) {
      const duplicate = await db
        .getRepository(Role)
        .createQueryBuilder("role")
        .where("LOWER(role.title) = LOWER(:title)", { title: input.title })
        .andWhere("role.id <> :id", { id })
        .getOne();
      if (duplicate) throw new HttpError(409, "A role with this title already exists");
    }
    if (input.nextRoleId === id) throw new HttpError(422, "A role cannot point to itself");
    if (input.nextRoleId) {
      let nextRoleId: string | null = input.nextRoleId;
      const visited = new Set<string>([id]);
      while (nextRoleId) {
        if (visited.has(nextRoleId)) throw new HttpError(422, "A role progression cannot contain a cycle");
        visited.add(nextRoleId);
        const nextRole = await db.getRepository(Role).findOneBy({ id: nextRoleId });
        if (!nextRole) throw new HttpError(422, "Select a valid subsequent role");
        nextRoleId = nextRole.nextRoleId;
      }
    }
    const result = await db.getRepository(Role).update(id, input);
    if (!result.affected) throw new HttpError(404, "Role not found");
    return ok({ message: "Role updated" });
  } catch (error) {
    return fail(error);
  }
}
