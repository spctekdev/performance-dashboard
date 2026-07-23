import "server-only";
import { Between, LessThan, MoreThan, type FindOperator } from "typeorm";
import { getDataSource } from "@/lib/db/data-source";
import {
  AccessLevel,
  Goal,
  Inquiry,
  InquiryDeliveryStatus,
  InquiryMessage,
  InquiryRecipient,
  InquiryReferenceType,
  InquiryStatus,
  Journal,
  Knowledge,
  RoleKpiAssignment,
  User,
  UserKpiPerformance,
  UserStatus,
} from "@/lib/db/entities";
import { sendInquiryNotification } from "@/lib/email";
import { HttpError } from "@/lib/http";
import { logError } from "@/lib/logger";
import type { SessionUser } from "@/types/domain";

type ReferenceInput = { type: Exclude<keyof typeof InquiryReferenceType, "NONE">; id: string } | null | undefined;

async function referenceSnapshot(actor: SessionUser, reference: ReferenceInput) {
  if (!reference) return { referenceType: InquiryReferenceType.NONE, referenceId: null, referenceLabel: null };
  const db = await getDataSource();
  let label: string | null = null;
  if (reference.type === "GOAL") {
    const goal = await db.getRepository(Goal).findOneBy({ id: reference.id, userId: actor.id });
    label = goal ? `Goal · ${goal.description}` : null;
  }
  if (reference.type === "JOURNAL_ENTRY") {
    const journal = await db.getRepository(Journal).findOneBy({ id: reference.id, userId: actor.id });
    const kind =
      journal?.category === "GOOD"
        ? "Journal achievement"
        : journal?.category === "BAD"
          ? "Journal challenge"
          : "Journal note";
    label = journal ? `${kind} · ${journal.description}` : null;
  }
  if (reference.type === "KPI_PERFORMANCE") {
    const row = await db
      .getRepository(UserKpiPerformance)
      .findOne({ where: { id: reference.id, userId: actor.id }, relations: { kpi: true } });
    label = row ? `KPI result · ${row.kpi.name} — ${row.period}` : null;
  }
  if (reference.type === "KPI_DEFINITION") {
    const assignment = await db
      .getRepository(RoleKpiAssignment)
      .findOne({ where: { roleId: actor.role.id, kpiId: reference.id }, relations: { kpi: true } });
    label = assignment ? `KPI definition · ${assignment.kpi.name}` : null;
  }
  if (reference.type === "KNOWLEDGE" && actor.departmentId) {
    const row = await db.getRepository(Knowledge).findOne({
      where: { id: reference.id, category: { departmentId: actor.departmentId } },
      relations: { category: true },
    });
    label = row ? `Knowledge · ${row.category.name}: ${(row.content as { title: string }).title}` : null;
  }
  if (!label) throw new HttpError(422, "The selected reference is not accessible");
  return {
    referenceType: InquiryReferenceType[reference.type],
    referenceId: reference.id,
    referenceLabel: label.slice(0, 240),
  };
}

export async function createInquiry(
  actor: SessionUser,
  input: { subject: string; message: string; reference?: ReferenceInput; managerIds?: string[] },
) {
  if (actor.accessLevel !== AccessLevel.EMPLOYEE) throw new HttpError(403, "Only employees can create inquiries");
  if (!actor.departmentId) throw new HttpError(422, "An assigned department is required to create an inquiry");
  const db = await getDataSource();
  const departmentManagers = await db
    .getRepository(User)
    .createQueryBuilder("manager")
    .innerJoin("department_managers", "mapping", 'mapping."managerId" = manager.id')
    .where('mapping."departmentId" = :departmentId', { departmentId: actor.departmentId })
    .andWhere("manager.status = :status", { status: UserStatus.ACTIVE })
    .andWhere("manager.accessLevel = :accessLevel", { accessLevel: AccessLevel.MANAGER })
    .getMany();
  if (!departmentManagers.length) throw new HttpError(422, "This department has no active manager recipients");
  const requestedManagerIds = input.managerIds ? new Set(input.managerIds) : null;
  const managers = requestedManagerIds
    ? departmentManagers.filter((manager) => requestedManagerIds.has(manager.id))
    : departmentManagers;
  if (requestedManagerIds && managers.length !== requestedManagerIds.size)
    throw new HttpError(422, "One or more selected managers are not active managers of your department");
  const reference = await referenceSnapshot(actor, input.reference);
  const inquiry = await db.transaction(async (tx) => {
    const row = await tx.getRepository(Inquiry).save({
      employeeId: actor.id,
      departmentId: actor.departmentId!,
      subject: input.subject,
      status: InquiryStatus.OPEN,
      ...reference,
      lastMessageAt: new Date(),
    });
    await tx.getRepository(InquiryMessage).save({ inquiryId: row.id, authorId: actor.id, body: input.message });
    await tx.getRepository(InquiryRecipient).save(
      managers.map((manager) => ({
        inquiryId: row.id,
        managerId: manager.id,
        deliveryStatus: InquiryDeliveryStatus.PENDING,
        deliveryError: null,
        notifiedAt: null,
        readAt: null,
      })),
    );
    return row;
  });
  await Promise.all(
    managers.map(async (manager) => {
      try {
        await sendInquiryNotification(manager.email, {
          subject: input.subject,
          senderName: actor.name,
          preview: input.message,
          inquiryId: inquiry.id,
          referenceLabel: reference.referenceLabel,
          heading: "New inquiry from",
        });
        await db
          .getRepository(InquiryRecipient)
          .update(
            { inquiryId: inquiry.id, managerId: manager.id },
            { deliveryStatus: InquiryDeliveryStatus.SENT, notifiedAt: new Date(), deliveryError: null },
          );
      } catch (error) {
        logError("Inquiry manager notification failed", error, { inquiryId: inquiry.id, managerId: manager.id });
        await db
          .getRepository(InquiryRecipient)
          .update(
            { inquiryId: inquiry.id, managerId: manager.id },
            { deliveryStatus: InquiryDeliveryStatus.FAILED, deliveryError: "Delivery failed" },
          );
      }
    }),
  );
  return inquiry;
}

export async function assertInquiryAccess(actor: SessionUser, inquiryId: string) {
  const db = await getDataSource();
  const inquiry = await db.getRepository(Inquiry).findOne({
    where: { id: inquiryId },
    relations: { employee: true, department: true, recipients: { manager: true }, messages: { author: true } },
    order: { messages: { createdAt: "ASC" } },
  });
  if (!inquiry) throw new HttpError(404, "Inquiry not found");
  const allowed =
    actor.accessLevel === AccessLevel.ADMIN ||
    inquiry.employeeId === actor.id ||
    inquiry.recipients.some((recipient) => recipient.managerId === actor.id);
  if (!allowed) throw new HttpError(403, "You cannot access this inquiry");
  return inquiry;
}

export function serializeInquiry(inquiry: Inquiry) {
  return {
    id: inquiry.id,
    subject: inquiry.subject,
    status: inquiry.status,
    employeeId: inquiry.employeeId,
    employeeName: inquiry.employee?.name,
    departmentId: inquiry.departmentId,
    departmentName: inquiry.department?.name,
    referenceType: inquiry.referenceType,
    referenceId: inquiry.referenceId,
    referenceLabel: inquiry.referenceLabel,
    lastMessageAt: inquiry.lastMessageAt.toISOString(),
    createdAt: inquiry.createdAt.toISOString(),
    recipients:
      inquiry.recipients?.map((row) => ({
        id: row.id,
        managerId: row.managerId,
        managerName: row.manager?.name,
        deliveryStatus: row.deliveryStatus,
        notifiedAt: row.notifiedAt?.toISOString() ?? null,
        readAt: row.readAt?.toISOString() ?? null,
      })) ?? [],
    messages:
      inquiry.messages?.map((row) => ({
        id: row.id,
        authorId: row.authorId,
        authorName: row.author?.name,
        body: row.body,
        createdAt: row.createdAt.toISOString(),
      })) ?? [],
  };
}

export async function listInquiries(actor: SessionUser, status?: InquiryStatus, before?: Date, after?: Date) {
  const db = await getDataSource();
  const repo = db.getRepository(Inquiry);
  let activity: FindOperator<Date> | undefined;
  if (before && after) activity = Between(after, before);
  else if (before) activity = LessThan(before);
  else if (after) activity = MoreThan(after);
  const where =
    actor.accessLevel === AccessLevel.ADMIN
      ? { ...(status ? { status } : {}), ...(activity ? { lastMessageAt: activity } : {}) }
      : actor.accessLevel === AccessLevel.MANAGER
        ? {
            recipients: { managerId: actor.id },
            ...(status ? { status } : {}),
            ...(activity ? { lastMessageAt: activity } : {}),
          }
        : { employeeId: actor.id, ...(status ? { status } : {}), ...(activity ? { lastMessageAt: activity } : {}) };
  return repo.find({
    where,
    relations: { employee: true, department: true, recipients: { manager: true }, messages: { author: true } },
    order: { lastMessageAt: "DESC", messages: { createdAt: "ASC" } },
    take: 100,
  });
}

export async function replyToInquiry(actor: SessionUser, inquiryId: string, body: string) {
  const inquiry = await assertInquiryAccess(actor, inquiryId);
  if (inquiry.status === InquiryStatus.CLOSED) throw new HttpError(409, "Reopen the inquiry before replying");
  const db = await getDataSource();
  const message = await db.transaction(async (tx) => {
    const row = await tx.getRepository(InquiryMessage).save({ inquiryId, authorId: actor.id, body });
    await tx.getRepository(Inquiry).update(inquiryId, { lastMessageAt: new Date() });
    return row;
  });
  if (actor.id !== inquiry.employeeId) {
    try {
      await sendInquiryNotification(inquiry.employee.email, {
        subject: inquiry.subject,
        senderName: actor.name,
        preview: body,
        inquiryId: inquiry.id,
        referenceLabel: inquiry.referenceLabel,
        heading: "Reply from",
      });
    } catch (error) {
      logError("Inquiry employee notification failed", error, { inquiryId, employeeId: inquiry.employeeId });
    }
  }
  return message;
}

export async function updateInquiry(
  actor: SessionUser,
  inquiryId: string,
  input: { status?: "OPEN" | "ANSWERED" | "CLOSED"; read?: boolean },
) {
  await assertInquiryAccess(actor, inquiryId);
  const db = await getDataSource();
  if (input.status) {
    if (actor.accessLevel === AccessLevel.EMPLOYEE)
      throw new HttpError(403, "Only managers and administrators can change inquiry status");
    await db.getRepository(Inquiry).update(inquiryId, { status: input.status as InquiryStatus });
  }
  if (input.read !== undefined && actor.accessLevel !== AccessLevel.EMPLOYEE) {
    await db
      .getRepository(InquiryRecipient)
      .update({ inquiryId, managerId: actor.id }, { readAt: input.read ? new Date() : null });
  }
}
