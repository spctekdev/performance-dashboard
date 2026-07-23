import "server-only";
import { env } from "@/lib/env";

export type ProviderMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

class ProviderRequestError extends Error {
  constructor(
    public readonly status: number,
    detail: string,
  ) {
    super(`Pulse provider returned ${status}${detail ? `: ${detail}` : ""}`);
    this.name = "ProviderRequestError";
  }
}

async function providerFetch(body: Record<string, unknown>) {
  const config = env();
  if (!config.LLM_API_KEY) throw new Error("Pulse is not configured. Set LLM_API_KEY.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(`${config.LLM_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.LLM_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: config.LLM_MODEL, temperature: 0.2, max_tokens: 700, ...body }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      const detail = (await response.text()).replace(/\s+/g, " ").slice(0, 600);
      throw new ProviderRequestError(response.status, detail);
    }
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

export async function streamCompletion(messages: ProviderMessage[]) {
  const response = await providerFetch({ messages, stream: true });
  if (!response.body) throw new Error("Pulse provider returned no stream");
  return response.body;
}
