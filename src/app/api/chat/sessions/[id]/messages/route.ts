import { NextRequest } from "next/server";
import { LessThan } from "typeorm";
import { apiUser } from "@/lib/auth/authorize";
import { getDataSource } from "@/lib/db/data-source";
import { ChatMessage } from "@/lib/db/entities";
import { assertSameOrigin, fail, HttpError, ok, parseBody } from "@/lib/http";
import { chatMessageSchema } from "@/lib/validation";
import { assertOwnedChatSession, createPulseStream } from "@/lib/pulse/service";

type Context = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, { params }: Context) {
  try {
    const actor = await apiUser(request);
    const id = (await params).id;
    await assertOwnedChatSession(actor.id, id);
    const before = request.nextUrl.searchParams.get("before");
    if (before && Number.isNaN(new Date(before).getTime())) throw new HttpError(422, "Invalid pagination cursor");
    const rows = await (await getDataSource()).getRepository(ChatMessage).find({
      where: { sessionId: id, ...(before ? { createdAt: LessThan(new Date(before)) } : {}) },
      order: { createdAt: "DESC" },
      take: 50,
    });
    return ok(
      rows.reverse().map((row) => ({
        id: row.id,
        role: row.role,
        status: row.status,
        content: row.content,
        createdAt: row.createdAt.toISOString(),
      })),
    );
  } catch (error) {
    return fail(error);
  }
}
export async function POST(request: NextRequest, { params }: Context) {
  try {
    assertSameOrigin(request);
    const actor = await apiUser(request);
    const input = await parseBody(request, chatMessageSchema);
    const stream = await createPulseStream(actor, (await params).id, input.message);
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return fail(error);
  }
}
