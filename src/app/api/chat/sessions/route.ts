import { NextRequest } from "next/server";
import { apiUser } from "@/lib/auth/authorize";
import { getDataSource } from "@/lib/db/data-source";
import { ChatSession } from "@/lib/db/entities";
import { assertSameOrigin, fail, ok, parseBody } from "@/lib/http";
import { createChatSessionSchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const actor = await apiUser(request);
    const rows = await (
      await getDataSource()
    )
      .getRepository(ChatSession)
      .find({ where: { userId: actor.id, archived: false }, order: { lastMessageAt: "DESC" }, take: 100 });
    return ok(
      rows.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        lastMessageAt: row.lastMessageAt.toISOString(),
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
    const input = await parseBody(request, createChatSessionSchema);
    const row = await (
      await getDataSource()
    )
      .getRepository(ChatSession)
      .save({ userId: actor.id, title: input.title ?? "New conversation", archived: false, lastMessageAt: new Date() });
    return ok({ id: row.id, title: row.title, lastMessageAt: row.lastMessageAt.toISOString() }, 201);
  } catch (error) {
    return fail(error);
  }
}
