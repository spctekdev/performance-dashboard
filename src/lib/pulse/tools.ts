import "server-only";
import { z } from "zod";
import { In } from "typeorm";
import { getDataSource } from "@/lib/db/data-source";
import { Category, Goal, RoleKpiAssignment, User, UserKpiPerformance } from "@/lib/db/entities";
import { HttpError } from "@/lib/http";
import type { SessionUser } from "@/types/domain";
import { parsePulseToolArguments } from "./tool-arguments";

const empty = z.object({}).strict();

export async function executePulseTool(actor: SessionUser, name: string, rawArguments: string) {
  const args = parsePulseToolArguments(name, rawArguments);
  const db = await getDataSource();
  if (name === "get_my_dashboard_context") {
    empty.parse(args);
    const user = await db
      .getRepository(User)
      .findOne({ where: { id: actor.id }, relations: { role: { nextRole: true } } });
    if (!user) throw new HttpError(404, "User not found");
    const roleIds = [user.roleId, user.role.nextRoleId].filter(Boolean) as string[];
    const [assignments, performance, goals] = await Promise.all([
      db
        .getRepository(RoleKpiAssignment)
        .find({ where: { roleId: In(roleIds) }, relations: { kpi: true }, order: { createdAt: "ASC" } }),
      db
        .getRepository(UserKpiPerformance)
        .find({ where: { userId: actor.id }, relations: { kpi: true }, order: { period: "DESC" }, take: 24 }),
      db.getRepository(Goal).find({ where: { userId: actor.id }, order: { deadline: "ASC" }, take: 20 }),
    ]);
    return {
      role: user.role.title,
      kpiTargets: assignments
        .filter((row) => row.roleId === user.roleId)
        .map((row) => ({ name: row.kpi.name, unit: row.kpi.unit, target: row.target })),
      recentPerformance: performance.map((row) => ({
        name: row.kpi.name,
        period: row.period,
        current: row.current,
        target: row.target,
        unit: row.kpi.unit,
      })),
      goals: goals.map((goal) => ({
        description: goal.description,
        deadline: goal.deadline,
        status: goal.status,
        remarks: goal.remarks,
      })),
      nextRole: user.role.nextRole
        ? {
            title: user.role.nextRole.title,
            kpis: assignments
              .filter((row) => row.roleId === user.role.nextRoleId)
              .map((row) => ({ name: row.kpi.name, unit: row.kpi.unit, target: row.target })),
          }
        : null,
    };
  }
  if (name === "list_my_department_categories") {
    empty.parse(args);
    if (!actor.departmentId) return [];
    return db.getRepository(Category).find({
      select: { id: true, name: true, description: true },
      where: { departmentId: actor.departmentId },
      order: { name: "ASC" },
    });
  }
  throw new HttpError(422, "Unknown Pulse tool");
}
