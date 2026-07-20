import { z } from "zod";

export const uuid = z.string().uuid();
export const dateOnly = z.string().regex(/^\d{4}-\d{2}-01$/, "Period must be the first day of a month");
const password = z
  .string()
  .min(10)
  .max(72)
  .regex(/[a-z]/, "Add a lowercase letter")
  .regex(/[A-Z]/, "Add an uppercase letter")
  .regex(/\d/, "Add a number");

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(320),
  password,
});
export const loginSchema = z.object({ email: z.string().trim().email().max(320), password: z.string().min(1).max(72) });
export const forgotSchema = z.object({ email: z.string().trim().email().max(320) });
export const tokenSchema = z.object({ token: z.string().min(32).max(256) });
export const resetSchema = tokenSchema.extend({ password });
export const createRoleSchema = z.object({ title: z.string().trim().min(2).max(120) });
export const updateRoleSchema = createRoleSchema.partial().extend({ nextRoleId: uuid.nullable().optional() });
export const createKpiSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).nullable().optional(),
  unit: z.string().trim().max(40).nullable().optional(),
});
export const updateKpiSchema = createKpiSchema.partial();
export const assignKpiSchema = z.object({ kpiId: uuid, target: z.coerce.number().finite().nonnegative() });
export const performanceSchema = z.object({
  userId: uuid,
  kpiId: uuid,
  period: dateOnly,
  current: z.coerce.number().finite().nonnegative(),
  target: z.coerce.number().finite().positive(),
});
export const journalSchema = z.object({
  userId: uuid,
  description: z.string().trim().min(3).max(5000),
  category: z.enum(["GOOD", "BAD", "NOTE"]),
  impact: z.coerce.number().finite().min(0).max(100),
  period: dateOnly,
});
export const updateJournalSchema = journalSchema.omit({ userId: true });
export const goalSchema = z.object({
  userId: uuid,
  description: z.string().trim().min(3).max(5000),
  deadline: z.coerce.date(),
  status: z.enum(["BACKLOG", "IN_PROGRESS", "BLOCKED", "UNDER_REVIEW", "FINISHED"]),
  remarks: z.string().trim().max(5000).default(""),
});
export const updateGoalSchema = goalSchema.omit({ userId: true });
export const createUserSchema = registerSchema
  .extend({
    roleId: uuid,
    departmentId: uuid.optional(),
    departmentIds: z.array(uuid).min(1).max(50).optional(),
    accessLevel: z.enum(["EMPLOYEE", "MANAGER", "ADMIN"]).default("EMPLOYEE"),
    status: z.enum(["active", "inactive"]).default("active"),
  })
  .superRefine((input, context) => {
    if (input.accessLevel === "MANAGER") {
      if (!input.departmentIds?.length)
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["departmentIds"],
          message: "Select at least one department",
        });
    } else if (!input.departmentId) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["departmentId"], message: "Select a department" });
    }
  });
export const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  roleId: uuid.optional(),
  departmentId: uuid.nullable().optional(),
  departmentIds: z.array(uuid).max(100).optional(),
  accessLevel: z.enum(["EMPLOYEE", "MANAGER", "ADMIN"]).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});
export const departmentSchema = z.object({ name: z.string().trim().min(2).max(120) });
export const updateDepartmentSchema = departmentSchema.extend({ managerIds: z.array(uuid).max(100).optional() });
export const departmentManagerSchema = z.object({ managerId: uuid });
export const categorySchema = z.object({ name: z.string().trim().min(2).max(120), departmentId: uuid });
const knowledgeBase = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().min(3).max(10000),
});
export const knowledgeSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("SOP"),
    categoryId: uuid,
    content: knowledgeBase.extend({
      steps: z.array(
        z.object({
          step_title: z.string().trim().min(1).max(160),
          step_description: z.string().trim().min(1).max(5000),
        }),
      ),
      tags: z.array(z.string().trim().min(1).max(80)).max(50),
    }),
  }),
  z.object({
    type: z.literal("BEST_PRACTICE"),
    categoryId: uuid,
    content: knowledgeBase.extend({ priority: z.enum(["low", "medium", "high"]) }),
  }),
  z.object({
    type: z.literal("KPI"),
    categoryId: uuid,
    content: knowledgeBase.extend({
      target_label: z.union([z.coerce.number().finite(), z.string().trim().min(1).max(120)]),
      metadata: z.array(z.record(z.string(), z.string())).max(50),
    }),
  }),
]);

export function firstZodError(error: z.ZodError) {
  return error.issues[0]?.message ?? "Invalid request";
}
