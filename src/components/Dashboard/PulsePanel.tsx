"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Bot, LoaderCircle, MessageSquare, Plus, Send, Trash2 } from "lucide-react";
import { PulseMarkdown } from "./PulseMarkdown";

type Session = { id: string; title: string; lastMessageAt: string };
type Message = { id: string; role: "USER" | "ASSISTANT" | "TOOL"; status: string; content: string; createdAt: string };
type StreamEvent = { text?: string; state?: string; message?: string };

export function PulsePanel({ onStartInquiry }: { onStartInquiry: () => void }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const transcriptRef = useRef<HTMLDivElement>(null);
  const messagesRequest = useRef(0);

  const loadSessions = useCallback(async (showLoading = true): Promise<Session[]> => {
    if (showLoading) setSessionsLoading(true);
    try {
      const response = await fetch("/api/chat/sessions");
      const json = await response.json();
      if (!response.ok) {
        setError(json.error ?? "Could not load Pulse sessions.");
        return [];
      }
      const loaded = json.data as Session[];
      setSessions(loaded);
      return loaded;
    } catch {
      setError("Could not load Pulse sessions. Please try again.");
      return [];
    } finally {
      if (showLoading) setSessionsLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (id: string) => {
    const request = ++messagesRequest.current;
    setMessagesLoading(true);
    try {
      const response = await fetch(`/api/chat/sessions/${id}/messages`);
      const json = await response.json();
      if (request !== messagesRequest.current) return;
      if (!response.ok) return setError(json.error ?? "Could not load this conversation.");
      setMessages((json.data as Message[]).filter((item) => item.role !== "TOOL"));
    } catch {
      if (request === messagesRequest.current) setError("Could not load this conversation. Please try again.");
    } finally {
      if (request === messagesRequest.current) setMessagesLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const loaded = await loadSessions();
      const firstId = loaded[0]?.id;
      if (firstId) {
        setSessionId(firstId);
        await loadMessages(firstId);
      }
    })();
  }, [loadMessages, loadSessions]);

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (transcript) transcript.scrollTo({ top: transcript.scrollHeight, behavior: busy ? "smooth" : "auto" });
  }, [busy, messages, status]);

  async function selectSession(id: string) {
    if (busy || id === sessionId) return;
    setSessionId(id);
    setMessages([]);
    setError("");
    await loadMessages(id);
  }

  async function createSession() {
    setCreatingSession(true);
    setError("");
    try {
      const response = await fetch("/api/chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const json = await response.json();
      if (!response.ok) return setError(json.error ?? "Could not create a conversation.");
      messagesRequest.current++;
      setSessions((current) => [json.data, ...current]);
      setSessionId(json.data.id);
      setMessages([]);
      setMessagesLoading(false);
    } catch {
      setError("Could not create a conversation. Please try again.");
    } finally {
      setCreatingSession(false);
    }
  }

  async function removeSession(id: string) {
    if (!window.confirm("Delete this Pulse conversation?")) return;
    setDeletingSessionId(id);
    setError("");
    try {
      const response = await fetch(`/api/chat/sessions/${id}`, { method: "DELETE" });
      if (!response.ok) return setError((await response.json()).error ?? "Could not delete this conversation.");
      const next = sessions.filter((session) => session.id !== id);
      setSessions(next);
      if (sessionId === id) {
        const nextId = next[0]?.id ?? "";
        setSessionId(nextId);
        setMessages([]);
        if (nextId) await loadMessages(nextId);
      }
    } catch {
      setError("Could not delete this conversation. Please try again.");
    } finally {
      setDeletingSessionId(null);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const field = form.elements.namedItem("message") as HTMLTextAreaElement;
    const text = field.value.trim();
    if (!text || busy) return;

    setBusy(true);
    setError("");
    setStatus("Preparing your context…");
    let activeId = sessionId;
    let assistantId = "";
    let streamFailed = false;

    try {
      if (!activeId) {
        const sessionResponse = await fetch("/api/chat/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        const sessionJson = await sessionResponse.json();
        if (!sessionResponse.ok) throw new Error(sessionJson.error ?? "Could not start Pulse.");
        activeId = sessionJson.data.id;
        setSessionId(activeId);
        setSessions((current) => [sessionJson.data, ...current]);
      }

      field.value = "";
      const userRow: Message = {
        id: crypto.randomUUID(),
        role: "USER",
        status: "COMPLETED",
        content: text,
        createdAt: new Date().toISOString(),
      };
      assistantId = crypto.randomUUID();
      setMessages((current) => [
        ...current,
        userRow,
        { id: assistantId, role: "ASSISTANT", status: "PENDING", content: "", createdAt: new Date().toISOString() },
      ]);

      const response = await fetch(`/api/chat/sessions/${activeId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (!response.ok || !response.body) throw new Error((await response.json()).error ?? "Pulse request failed.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const block of events) {
          const eventName = block.match(/^event: (.+)$/m)?.[1];
          const raw = block.match(/^data: (.+)$/m)?.[1];
          if (!raw) continue;
          const data = JSON.parse(raw) as StreamEvent;
          if (eventName === "token" && data.text)
            setMessages((current) =>
              current.map((item) => (item.id === assistantId ? { ...item, content: item.content + data.text } : item)),
            );
          if (eventName === "status")
            setStatus(
              data.state === "grounding"
                ? "Preparing your dashboard context…"
                : data.state === "retrieving"
                  ? "Checking authorized knowledge…"
                  : data.state === "answering"
                    ? "Writing a response…"
                    : "Planning the answer…",
            );
          if (eventName === "error") {
            streamFailed = true;
            setError(data.message ?? "Pulse could not complete this response.");
            setMessages((current) =>
              current.map((item) =>
                item.id === assistantId && !item.content
                  ? { ...item, content: data.message ?? "Pulse could not complete this response." }
                  : item,
              ),
            );
          }
          if (eventName === "done" && data.message)
            setMessages((current) =>
              current.map((item) =>
                item.id === assistantId ? { ...item, content: data.message ?? item.content } : item,
              ),
            );
        }
      }
      setMessages((current) =>
        current.map((item) =>
          item.id === assistantId ? { ...item, status: streamFailed ? "FAILED" : "COMPLETED" } : item,
        ),
      );
      await loadSessions(false);
    } catch (caught) {
      if (assistantId)
        setMessages((current) =>
          current.map((item) => (item.id === assistantId ? { ...item, status: "FAILED" } : item)),
        );
      setError(caught instanceof Error ? caught.message : "Pulse request failed.");
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  return (
    <section className="support-panel pulse-layout">
      <aside className="support-sidebar pulse-sidebar inquiry-sidebar">
        <div className="inquiry-sidebar-heading">
          <h2>
            <Bot size={18} /> Pulse
          </h2>
          <button
            type="button"
            className="inquiry-new-button"
            disabled={creatingSession || deletingSessionId !== null || busy}
            onClick={() => void createSession()}
          >
            {creatingSession ? <LoaderCircle className="spin" size={15} /> : <Plus size={15} />}
            {creatingSession ? "Creating…" : "New conversation"}
          </button>
        </div>
        <div className="inquiry-list pulse-session-list" aria-label="Pulse conversations" aria-busy={sessionsLoading}>
          {sessionsLoading ? (
            <PulseLoading label="Loading conversations…" />
          ) : sessions.length ? (
            sessions.map((session) => (
              <div className="pulse-session-row" key={session.id}>
                <button
                  type="button"
                  className={session.id === sessionId ? "active" : ""}
                  disabled={busy || deletingSessionId !== null}
                  onClick={() => void selectSession(session.id)}
                >
                  <span>{session.title}</span>
                  <small>{new Date(session.lastMessageAt).toLocaleDateString()}</small>
                </button>
                <button
                  type="button"
                  className="pulse-session-delete"
                  disabled={creatingSession || deletingSessionId !== null || busy}
                  onClick={() => void removeSession(session.id)}
                  aria-label={`Delete ${session.title}`}
                >
                  {deletingSessionId === session.id ? (
                    <LoaderCircle className="spin" size={13} />
                  ) : (
                    <Trash2 size={13} />
                  )}
                </button>
              </div>
            ))
          ) : (
            <div className="pulse-sidebar-empty">
              <MessageSquare size={20} />
              <span>No conversations yet</span>
            </div>
          )}
        </div>
      </aside>

      <div className="pulse-main">
        <header>
          <div>
            <span className="support-icon">
              <Bot size={20} />
            </span>
            <h2>Pulse</h2>
            <p>Your dashboard and department knowledge assistant.</p>
          </div>
          <button type="button" className="support-link" onClick={onStartInquiry}>
            Start an inquiry
          </button>
        </header>
        <div ref={transcriptRef} className="pulse-transcript" aria-live="polite" aria-busy={messagesLoading || busy}>
          {messagesLoading ? (
            <PulseLoading label="Loading conversation…" />
          ) : !messages.length ? (
            <div className="support-empty">
              <Bot size={34} />
              <h3>What can I help you understand?</h3>
              <p>Ask about your KPIs, goals, role progression, or department guidance.</p>
            </div>
          ) : (
            messages.map((message) => (
              <article
                key={message.id}
                className={`pulse-message ${message.role.toLowerCase()} ${message.status.toLowerCase()}`}
              >
                {message.content ? (
                  <>
                    <strong>{message.role === "USER" ? "You" : "Pulse"}</strong>
                    {message.role === "ASSISTANT" ? (
                      <PulseMarkdown content={message.content} />
                    ) : (
                      <p>{message.content}</p>
                    )}
                  </>
                ) : (
                  <p className="pulse-pending">
                    <LoaderCircle className="spin" size={14} /> Pulse is working…
                  </p>
                )}
                {message.status === "FAILED" && (
                  <small>Pulse could not complete this response. Try again or start an inquiry.</small>
                )}
              </article>
            ))
          )}
        </div>
        {status && (
          <p className="pulse-activity">
            <LoaderCircle className="spin" size={14} /> {status}
          </p>
        )}
        {error && <p className="support-error">{error}</p>}
        <form className="pulse-composer" onSubmit={submit}>
          <textarea
            name="message"
            required
            maxLength={4000}
            rows={1}
            disabled={busy}
            placeholder="Ask Pulse…"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <button disabled={busy} aria-label="Send message">
            {busy ? <LoaderCircle className="spin" size={16} /> : <Send size={16} />}
            <span>{busy ? "Sending…" : "Send"}</span>
          </button>
        </form>
        <small className="support-notice">
          Pulse uses only your dashboard and authorized department knowledge. Verify important decisions with your
          manager.
        </small>
      </div>
    </section>
  );
}

function PulseLoading({ label }: { label: string }) {
  return (
    <div className="pulse-loading">
      <LoaderCircle className="spin" size={20} />
      <span>{label}</span>
    </div>
  );
}
