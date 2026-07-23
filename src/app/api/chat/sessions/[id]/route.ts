import { NextRequest } from "next/server";
import { apiUser } from "@/lib/auth/authorize";
import { getDataSource } from "@/lib/db/data-source";
import { ChatSession } from "@/lib/db/entities";
import { assertSameOrigin, fail, ok, parseBody } from "@/lib/http";
import { updateChatSessionSchema } from "@/lib/validation";
import { assertOwnedChatSession } from "@/lib/pulse/service";

type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    assertSameOrigin(request);
    const actor = await apiUser(request);
    const id = (await params).id;
    await assertOwnedChatSession(actor.id, id);
    const input = await parseBody(request, updateChatSessionSchema);
    await (await getDataSource()).getRepository(ChatSession).update(id, input);
    return ok({ message: "Chat session updated" });
  } catch (error) {
    return fail(error);
  }
}
export async function DELETE(request: NextRequest, { params }: Context) {
  try {
    assertSameOrigin(request);
    const actor = await apiUser(request);
    const id = (await params).id;
    await assertOwnedChatSession(actor.id, id);
    await (await getDataSource()).getRepository(ChatSession).delete(id);
    return ok({ message: "Chat session deleted" });
  } catch (error) {
    return fail(error);
  }
}
