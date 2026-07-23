import "server-only";
import { getDataSource } from "@/lib/db/data-source";
import { AuthRateLimit, ChatMessage, ChatMessageRole, ChatMessageStatus, ChatSession } from "@/lib/db/entities";
import { HttpError } from "@/lib/http";
import { logError } from "@/lib/logger";
import type { SessionUser } from "@/types/domain";
import { buildPulseGrounding } from "./grounding-context";
import { finalizePulseKnowledgeLinks } from "./grounding";
import { pulseSystemPrompt } from "./prompt";
import { streamCompletion, type ProviderMessage } from "./provider";

const encoder = new TextEncoder();
const event = (name: string, data: unknown) => encoder.encode(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);

export async function assertOwnedChatSession(userId: string, sessionId: string) {
  const session = await (await getDataSource()).getRepository(ChatSession).findOneBy({ id: sessionId, userId });
  if (!session) throw new HttpError(404, "Chat session not found");
  return session;
}

async function enforcePulseRateLimit(userId: string) {
  const db = await getDataSource();
  const repo = db.getRepository(AuthRateLimit);
  const key = `pulse:${userId}`;
  const now = new Date();
  const row = await repo.findOneBy({ key });
  if (!row || now.getTime() - row.windowStartedAt.getTime() >= 60_000) {
    await repo.save({ key, attempts: 1, windowStartedAt: now, blockedUntil: null });
    return;
  }
  if (row.attempts >= 10) throw new HttpError(429, "Pulse request limit reached. Try again shortly.");
  await repo.increment({ key }, "attempts", 1);
}

export async function createPulseStream(actor: SessionUser, sessionId: string, text: string) {
  const session = await assertOwnedChatSession(actor.id, sessionId);
  await enforcePulseRateLimit(actor.id);
  const db = await getDataSource();
  const repo = db.getRepository(ChatMessage);
  const prior = (await repo.find({ where: { sessionId }, order: { createdAt: "DESC" }, take: 30 }))
    .filter((row) => row.role !== ChatMessageRole.TOOL && row.status === ChatMessageStatus.COMPLETED)
    .slice(0, 10);
  const userMessage = await repo.save({
    sessionId,
    role: ChatMessageRole.USER,
    status: ChatMessageStatus.COMPLETED,
    content: text,
    toolCalls: null,
    toolResults: null,
  });
  if (session.title === "New conversation")
    await db.getRepository(ChatSession).update(sessionId, { title: text.slice(0, 120), lastMessageAt: new Date() });
  else await db.getRepository(ChatSession).update(sessionId, { lastMessageAt: new Date() });

  const messages: ProviderMessage[] = [
    { role: "system", content: pulseSystemPrompt() },
    ...prior
      .reverse()
      .filter((row) => row.role !== ChatMessageRole.TOOL)
      .map((row) => ({
        role: row.role === ChatMessageRole.USER ? ("user" as const) : ("assistant" as const),
        content: row.content,
      })),
    { role: "user", content: userMessage.content },
  ];

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let output = "";
      try {
        controller.enqueue(event("status", { state: "grounding" }));
        const grounding = await buildPulseGrounding(actor, text);
        messages.splice(1, 0, { role: "system", content: grounding.message });
        messages.splice(messages.length - 1, 0, {
          role: "system",
          content:
            "CURRENT_REQUEST_BOUNDARY: Answer only the next user message. Do not continue, repeat, or complete an earlier topic unless the current message explicitly asks you to.",
        });
        const checkedSources = new Set(grounding.sources);

        controller.enqueue(event("status", { state: "thinking" }));
        controller.enqueue(event("status", { state: "answering" }));
        const stream = await streamCompletion(messages);
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (!data || data === "[DONE]") continue;
            const json = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
            const token = json.choices?.[0]?.delta?.content;
            if (token) {
              output += token;
              controller.enqueue(event("token", { text: token }));
            }
          }
        }
        if (!output.trim()) {
          output =
            "I couldn't complete that response. Please try again, and I can provide either relevant department resources or clearly labeled general guidance.";
          controller.enqueue(event("token", { text: output }));
        }
        output = finalizePulseKnowledgeLinks(output, grounding.references);
        const sourceFooter = `\n\n**Sources checked:** ${[...checkedSources].join(", ")}.`;
        output += sourceFooter;
        controller.enqueue(event("token", { text: sourceFooter }));
        await repo.save({
          sessionId,
          role: ChatMessageRole.ASSISTANT,
          status: ChatMessageStatus.COMPLETED,
          content: output,
          toolCalls: null,
          toolResults: null,
        });
        await db.getRepository(ChatSession).update(sessionId, { lastMessageAt: new Date() });
        controller.enqueue(event("done", { message: output }));
      } catch (error) {
        logError("Pulse response failed", error, { userId: actor.id, sessionId });
        await repo.save({
          sessionId,
          role: ChatMessageRole.ASSISTANT,
          status: ChatMessageStatus.FAILED,
          content: output || "Pulse could not complete this response. Please try again.",
          toolCalls: null,
          toolResults: null,
        });
        controller.enqueue(event("error", { message: "Pulse could not complete this response. Please try again." }));
      } finally {
        controller.close();
      }
    },
  });
}
