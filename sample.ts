import { NextResponse } from "next/server";

import { axonSystemPrompt } from "@/data/agentKnowledgeBase";
import { contactsApi } from "@/lib/api";

type ClientMessage = {
  role: "user" | "assistant";
  content: string;
};

type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: "create_contact" | "book_meeting";
    arguments: string;
  };
};

type ToolResult = {
  toolCallId: string;
  name: ToolCall["function"]["name"];
  content: Record<string, unknown>;
  clientEvent?: Record<string, unknown>;
};

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";
const meetingIntentPattern = /\b(book|schedule|set up|setup|arrange|reserve|meeting|call|demo|calendar|calendly)\b/i;

const tools = [
  {
    type: "function",
    function: {
      name: "create_contact",
      description:
        "Create or update a lead contact in the SPCTEK.AI database when the visitor provides an email address.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Visitor name, if known." },
          email: { type: "string", description: "Visitor email address. Required." },
          phone: { type: "string", description: "Visitor phone number, if known." },
          company: { type: "string", description: "Company or organization name, if known." },
          message: { type: "string", description: "Short lead note summarizing what the visitor needs." },
          interest: { type: "string", description: "The service or problem the visitor is interested in." },
        },
        required: ["email"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "book_meeting",
      description: "Open the Calendly booking flow when the visitor wants or agrees to schedule a meeting.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string", description: "Short reason for the meeting." },
          email: { type: "string", description: "Visitor email, if already known." },
        },
      },
    },
  },
];

const hasMeetingIntent = (message: string) => meetingIntentPattern.test(message);

const cleanMessages = (messages: unknown): ClientMessage[] => {
  if (!Array.isArray(messages)) return [];

  return messages
    .filter((message): message is ClientMessage => {
      if (!message || typeof message !== "object") return false;
      const candidate = message as Partial<ClientMessage>;
      return (
        (candidate.role === "user" || candidate.role === "assistant") &&
        typeof candidate.content === "string" &&
        candidate.content.trim().length > 0
      );
    })
    .slice(-20)
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, 1400),
    }));
};

const getLatestUserMessage = (messages: ClientMessage[]) =>
  [...messages].reverse().find((message) => message.role === "user");

const splitCurrentMessage = (messages: ClientMessage[]) => {
  const latestUserMessage = getLatestUserMessage(messages);
  const conversationMemory = messages.slice(0, -1);

  return {
    currentMessage: latestUserMessage?.content.trim() || "",
    conversationMemory,
    hasMeetingIntent: latestUserMessage ? hasMeetingIntent(latestUserMessage.content) : false,
  };
};

const parseToolArguments = (toolCall: ToolCall): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(toolCall.function.arguments || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const createContact = async (args: Record<string, unknown>): Promise<Record<string, unknown>> => {
  const email = typeof args.email === "string" ? args.email.trim() : "";

  if (!email) {
    return { ok: false, error: "Email is required before a contact can be created." };
  }
  const interest = typeof args.interest === "string" ? args.interest : undefined;
  const message =
    typeof args.message === "string" && args.message.trim()
      ? args.message.trim()
      : interest
        ? `AXON chat lead interested in ${interest}.`
        : "AXON chat lead.";

  try {
    const response = await contactsApi.create({
      email,
      name: typeof args.name === "string" ? args.name : undefined,
      phone: typeof args.phone === "string" ? args.phone : undefined,
      company: typeof args.company === "string" ? args.company : undefined,
      message,
      source: "axon_chat",
      journey: {
        captured_by: "AXON",
        interest,
      },
    });

    return {
      ok: true,
      contact: response.data,
    };
  } catch (error) {
    const axiosError = error as {
      response?: { status?: number; data?: { detail?: string; message?: string } };
    };

    return {
      ok: false,
      error: axiosError.response?.data?.detail || axiosError.response?.data?.message || "Failed to create contact.",
      status: axiosError.response?.status,
    };
  }
};

const executeToolCall = async (toolCall: ToolCall): Promise<ToolResult> => {
  const args = parseToolArguments(toolCall);

  if (toolCall.function.name === "create_contact") {
    return {
      toolCallId: toolCall.id,
      name: toolCall.function.name,
      content: await createContact(args),
    };
  }

  return {
    toolCallId: toolCall.id,
    name: toolCall.function.name,
    content: {
      ok: true,
      message: "Calendly booking flow opened for the visitor.",
      reason: typeof args.reason === "string" ? args.reason : undefined,
    },
    clientEvent: {
      type: "tool_result",
      tool: "book_meeting",
      action: "open_calendly",
    },
  };
};

const streamGroqResponse = async (
  messages: unknown[],
  apiKey: string,
  encoder: TextEncoder,
  controller: ReadableStreamDefaultController,
) => {
  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Title": "SPCTEK.AI AXON Chat",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      max_completion_tokens: 1024,
      temperature: 0.7,
      stream: true,
      stop: null,
      top_p: 0.95,
    }),
  });

  if (!response.ok || !response.body) {
    const errorText = await response.text().catch(() => "");
    throw new Error(errorText || "AXON had trouble responding.");
  }

  const reader = response.body.getReader();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) controller.enqueue(value);
  }

  controller.enqueue(encoder.encode("data: [DONE]\n\n"));
};

export async function POST(request: Request) {
  const apiKey = process.env.NEXT_PUBLIC_LLM_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "AXON is not configured yet. Add NEXT_PUBLIC_LLM_API_KEY to the frontend environment." },
      { status: 500 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  const { messages } = (body || {}) as { messages?: unknown };
  const cleanedMessages = cleanMessages(messages);

  if (!cleanedMessages.length || cleanedMessages[cleanedMessages.length - 1]?.role !== "user") {
    return NextResponse.json({ error: "A user message is required." }, { status: 400 });
  }

  try {
    const {
      currentMessage,
      conversationMemory,
      hasMeetingIntent: currentMessageHasMeetingIntent,
    } = splitCurrentMessage(cleanedMessages);
    const goalSpecificPrompt = currentMessageHasMeetingIntent
      ? `
Goal:
- Book the meeting.
- Do not ask for an email address or other contact info.
- Do not use create_contact.
- If book_meeting is used, treat the booking flow as the primary outcome and respond briefly.
`
      : `
Goal:
- Capture contact information if the visitor is looking for follow-up.
- Do not push booking unless the visitor explicitly asks to schedule.
- If the visitor has not provided an email address, ask for it once and keep moving.
`;

    const toolAwarePrompt = `${axonSystemPrompt}

${goalSpecificPrompt}

Decision rule:
- Treat conversation history as memory only.
- Only the current user message can authorize the active goal.
- If the current user message is booking-related, use book_meeting and do not ask for contact details.
- If the current user message is lead-capture-related, use create_contact and do not pivot into booking.
- Never trigger either action because of earlier conversation history alone.

Current user message:
${currentMessage}
`.trim();

    const currentUserMessage = { role: "user", content: currentMessage };
    const baseMessages = [{ role: "system", content: toolAwarePrompt }, ...conversationMemory, currentUserMessage];
    const activeTools = currentMessageHasMeetingIntent
      ? tools.filter((tool) => tool.function.name === "book_meeting")
      : tools;
    const toolChoiceResponse = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "SPCTEK.AI AXON Chat",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: baseMessages,
        max_completion_tokens: 512,
        temperature: 0.35,
        stream: false,
        stop: null,
        top_p: 0.95,
        tools: activeTools,
        tool_choice: "auto",
      }),
    });

    if (!toolChoiceResponse.ok) {
      const errorText = await toolChoiceResponse.text();
      console.error("Groq AXON error:", toolChoiceResponse.status, errorText);
      return NextResponse.json({ error: "AXON had trouble responding. Please try again." }, { status: 502 });
    }

    const toolChoiceData = await toolChoiceResponse.json();
    const assistantMessage = toolChoiceData?.choices?.[0]?.message;
    const toolCalls = Array.isArray(assistantMessage?.tool_calls) ? (assistantMessage.tool_calls as ToolCall[]) : [];

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const toolResults = await Promise.all(
            toolCalls
              .filter((toolCall) => toolCall.function.name !== "book_meeting" || currentMessageHasMeetingIntent)
              .map((toolCall) => executeToolCall(toolCall)),
          );

          for (const toolResult of toolResults) {
            if (toolResult.clientEvent) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(toolResult.clientEvent)}\n\n`));
            }
          }

          const finalMessages = toolCalls.length
            ? [
                ...baseMessages,
                {
                  role: "assistant",
                  content: assistantMessage?.content || null,
                  tool_calls: toolCalls,
                },
                ...toolResults.map((toolResult) => ({
                  role: "tool",
                  tool_call_id: toolResult.toolCallId,
                  name: toolResult.name,
                  content: JSON.stringify(toolResult.content),
                })),
              ]
            : baseMessages;

          await streamGroqResponse(finalMessages, apiKey, encoder, controller);
        } catch (streamError) {
          console.error("AXON stream error:", streamError);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "error",
                error: "AXON is temporarily unavailable. Please try again soon.",
              })}\n\n`,
            ),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("AXON chat route error:", error);
    return NextResponse.json({ error: "AXON is temporarily unavailable. Please try again soon." }, { status: 500 });
  }
}
