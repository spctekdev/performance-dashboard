"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, ChevronRight, Inbox, LoaderCircle, Plus, Send } from "lucide-react";
import type { DashboardData } from "@/lib/dashboard";
import type { InquiryReference } from "./InquiryButton";

type Inquiry = {
  id: string;
  subject: string;
  status: "OPEN" | "ANSWERED" | "CLOSED";
  employeeId: string;
  employeeName?: string;
  departmentName?: string;
  referenceType: InquiryReference["type"] | "NONE";
  referenceLabel: string | null;
  lastMessageAt: string;
  recipients: Array<{ managerId: string; managerName?: string; deliveryStatus: string; readAt: string | null }>;
  messages: Array<{ id: string; authorId: string; authorName?: string; body: string; createdAt: string }>;
};

type ReferenceOption = InquiryReference & { label: string };
type View = "thread" | "compose";

export function InquiriesPanel({
  data,
  initialInquiryId,
  initialReference,
}: {
  data: DashboardData;
  initialInquiryId?: string;
  initialReference?: InquiryReference;
}) {
  const [items, setItems] = useState<Inquiry[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [view, setView] = useState<View>(initialReference ? "compose" : "thread");
  const [error, setError] = useState("");
  const [isLoadingInquiries, setIsLoadingInquiries] = useState(true);
  const [busyAction, setBusyAction] = useState<"create" | "reply" | "status" | null>(null);
  const [managerTarget, setManagerTarget] = useState("ALL");
  const [reference, setReference] = useState<InquiryReference | null>(initialReference ?? null);
  const selected = items.find((item) => item.id === selectedId);
  const actorRecord = data.users.find((user) => user.id === data.actor.id);
  const isEmployee = data.actor.accessLevel === "EMPLOYEE";
  const canManageStatus = !isEmployee;
  const departmentManagers =
    data.departments
      .find((department) => department.id === actorRecord?.departmentId)
      ?.managers.filter((manager) => manager.status === "active") ?? [];

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/inquiries")
      .then(async (response) => ({ response, json: await response.json() }))
      .then(({ response, json }) => {
        if (cancelled) return;
        if (!response.ok) return setError(json.error ?? "Could not load inquiries.");
        setItems(json.data);
        setSelectedId(initialInquiryId || json.data[0]?.id || "");
      })
      .catch(() => {
        if (!cancelled) setError("Could not load inquiries. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingInquiries(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initialInquiryId]);

  async function load(select?: string) {
    setIsLoadingInquiries(true);
    try {
      const response = await fetch("/api/inquiries");
      const json = await response.json();
      if (!response.ok) return setError(json.error ?? "Could not load inquiries.");
      setItems(json.data);
      setSelectedId((current) => select || current || initialInquiryId || json.data[0]?.id || "");
    } catch {
      setError("Could not load inquiries. Please try again.");
    } finally {
      setIsLoadingInquiries(false);
    }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setBusyAction("create");
    setError("");
    const form = new FormData(formElement);
    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: form.get("subject"),
          message: form.get("message"),
          reference,
          managerIds: managerTarget === "ALL" ? undefined : [managerTarget],
        }),
      });
      const json = await response.json();
      if (!response.ok) return setError(json.error ?? "Could not create inquiry.");
      formElement.reset();
      setManagerTarget("ALL");
      setReference(null);
      setView("thread");
      await load(json.data.id);
    } catch {
      setError("Could not create inquiry. Please try again.");
    } finally {
      setBusyAction(null);
    }
  }

  async function reply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const formElement = event.currentTarget;
    setBusyAction("reply");
    setError("");
    const form = new FormData(formElement);
    try {
      const response = await fetch(`/api/inquiries/${selected.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: form.get("body") }),
      });
      const json = await response.json();
      if (!response.ok) return setError(json.error ?? "Could not send reply.");
      formElement.reset();
      await load(selected.id);
    } catch {
      setError("Could not send reply. Please try again.");
    } finally {
      setBusyAction(null);
    }
  }

  async function updateStatus(status: Inquiry["status"]) {
    if (!selected) return;
    setBusyAction("status");
    setError("");
    try {
      const response = await fetch(`/api/inquiries/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) return setError((await response.json()).error ?? "Could not update inquiry.");
      await load(selected.id);
    } catch {
      setError("Could not update inquiry. Please try again.");
    } finally {
      setBusyAction(null);
    }
  }

  async function selectInquiry(item: Inquiry) {
    setView("thread");
    setSelectedId(item.id);
    const recipient = item.recipients.find((row) => row.managerId === data.actor.id);
    if (recipient && !recipient.readAt) {
      await fetch(`/api/inquiries/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read: true }),
      });
      await load(item.id);
    }
  }

  const referenceGroups = useMemo(() => {
    if (!actorRecord) return [];
    const knowledgeCategories = new Map<string, ReferenceOption[]>();
    for (const row of data.knowledge) {
      const items = knowledgeCategories.get(row.categoryName) ?? [];
      items.push({ type: "KNOWLEDGE", id: row.id, label: `Knowledge · ${row.content.title}` });
      knowledgeCategories.set(row.categoryName, items);
    }
    return [
      {
        label: "Goals",
        items: actorRecord.goals.map((row) => ({
          type: "GOAL" as const,
          id: row.id,
          label: `Goal · ${row.description}`,
        })),
      },
      {
        label: "Journal entries",
        items: actorRecord.journals.map((row) => ({
          type: "JOURNAL_ENTRY" as const,
          id: row.id,
          label: `${journalType(row.category)} · ${row.description}`,
        })),
      },
      {
        label: "KPI definitions",
        items: actorRecord.assignments.map((row) => ({
          type: "KPI_DEFINITION" as const,
          id: row.kpiId,
          label: `KPI definition · ${row.name}`,
        })),
      },
      {
        label: "KPI results",
        items: actorRecord.performance.map((row) => ({
          type: "KPI_PERFORMANCE" as const,
          id: row.id,
          label: `KPI result · ${row.name} (${row.period})`,
        })),
      },
      {
        label: "Knowledge",
        items: [] as ReferenceOption[],
        subgroups: [...knowledgeCategories].map(([label, items]) => ({ label, items })),
      },
    ];
  }, [actorRecord, data.knowledge]);

  const messages = selected ? [...selected.messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt)) : [];
  return (
    <section className="support-panel inquiry-layout">
      <aside className="support-sidebar inquiry-sidebar">
        <div className="inquiry-sidebar-heading">
          <h2>
            <Inbox size={18} /> Inquiries
          </h2>
          {isEmployee && (
            <button type="button" className="inquiry-new-button" onClick={() => setView("compose")}>
              <Plus size={15} /> New inquiry
            </button>
          )}
        </div>
        <div className="inquiry-list" aria-label="Inquiry conversations" aria-busy={isLoadingInquiries}>
          {isLoadingInquiries ? (
            <div className="inquiry-sidebar-feedback">
              <LoaderCircle className="spin" size={19} />
              <span>Loading inquiries…</span>
            </div>
          ) : items.length ? (
            items.map((item) => {
              const unread = item.recipients.some((row) => row.managerId === data.actor.id && !row.readAt);
              return (
                <button
                  key={item.id}
                  className={`${selectedId === item.id && view === "thread" ? "active" : ""} ${unread ? "unread" : ""}`}
                  onClick={() => void selectInquiry(item)}
                >
                  <span className="inquiry-list-subject">{item.subject}</span>
                  <span className="inquiry-list-meta">
                    <span>{isEmployee ? "Your inquiry" : (item.employeeName ?? "Employee")}</span>
                    <span className={`inquiry-list-status ${item.status.toLowerCase()}`}>
                      {item.status.toLowerCase()}
                    </span>
                  </span>
                </button>
              );
            })
          ) : (
            <div className="inquiry-sidebar-feedback">
              <Inbox size={20} />
              <span>No inquiries yet</span>
            </div>
          )}
        </div>
      </aside>
      <div className="inquiry-main">
        {view === "compose" && isEmployee ? (
          <InquiryComposer
            busy={busyAction === "create"}
            departmentManagers={departmentManagers}
            groups={referenceGroups}
            managerTarget={managerTarget}
            onCancel={() => setView("thread")}
            onManagerTarget={setManagerTarget}
            onReference={setReference}
            onSubmit={create}
            reference={reference}
          />
        ) : selected ? (
          <article className="inquiry-thread">
            <header>
              <div>
                <span className={`inquiry-status ${selected.status.toLowerCase()}`}>{selected.status}</span>
                <h2>{selected.subject}</h2>
                <p>
                  {selected.employeeName ?? "Employee"} · {selected.departmentName}
                </p>
                <ReferenceSummary label={selected.referenceLabel} type={selected.referenceType} />
              </div>
              {canManageStatus && (
                <div className="inquiry-status-actions">
                  <label>
                    Status
                    <select
                      value={selected.status}
                      disabled={busyAction === "status"}
                      onChange={(event) => void updateStatus(event.target.value as Inquiry["status"])}
                    >
                      <option value="OPEN">Open</option>
                      <option value="ANSWERED">Answered</option>
                      <option value="CLOSED">Closed</option>
                    </select>
                  </label>
                  {busyAction === "status" && <LoaderCircle className="spin" size={15} aria-label="Updating status" />}
                </div>
              )}
            </header>
            <div className="inquiry-recipient-summary">
              Sent to {selected.recipients.map((row) => row.managerName ?? "Manager").join(", ")}
            </div>
            <div className="inquiry-messages">
              {messages.map((message) => (
                <div key={message.id} className={message.authorId === data.actor.id ? "mine" : ""}>
                  <strong>{message.authorName}</strong>
                  <p>{message.body}</p>
                  <time>{new Date(message.createdAt).toLocaleString()}</time>
                </div>
              ))}
            </div>
            {selected.status !== "CLOSED" && (
              <form className="inquiry-reply" onSubmit={reply}>
                <textarea name="body" required maxLength={10000} rows={3} placeholder="Write a reply…" />
                <button className="support-primary" disabled={busyAction !== null}>
                  {busyAction === "reply" ? <LoaderCircle className="spin" size={14} /> : <Send size={14} />}
                  {busyAction === "reply" ? "Sending…" : "Send reply"}
                </button>
              </form>
            )}
          </article>
        ) : (
          <div className="support-empty">
            <Inbox size={34} />
            <h3>No inquiry selected</h3>
            <p>{items.length ? "Choose a conversation from the list." : "No inquiries are available yet."}</p>
          </div>
        )}
        {error && <p className="support-error">{error}</p>}
      </div>
    </section>
  );
}

function InquiryComposer({
  busy,
  departmentManagers,
  groups,
  managerTarget,
  onCancel,
  onManagerTarget,
  onReference,
  onSubmit,
  reference,
}: {
  busy: boolean;
  departmentManagers: Array<{ id: string; name: string }>;
  groups: ReferenceGroup[];
  managerTarget: string;
  onCancel: () => void;
  onManagerTarget: (value: string) => void;
  onReference: (reference: InquiryReference | null) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  reference: InquiryReference | null;
}) {
  return (
    <form className="inquiry-compose-page" onSubmit={onSubmit}>
      <header>
        <button type="button" className="inquiry-back-button" onClick={onCancel}>
          <ArrowLeft size={15} /> Back to conversations
        </button>
        <span className="section-eyebrow">NEW INQUIRY</span>
        <h2>Ask for support</h2>
        <p>Choose who should receive your message and, if useful, link it to the relevant dashboard item.</p>
      </header>
      <label>
        Subject
        <input name="subject" required minLength={3} maxLength={180} placeholder="What do you need help with?" />
      </label>
      <label>
        Address to
        <select value={managerTarget} onChange={(event) => onManagerTarget(event.target.value)}>
          <option value="ALL">All department managers</option>
          {departmentManagers.map((manager) => (
            <option key={manager.id} value={manager.id}>
              {manager.name}
            </option>
          ))}
        </select>
      </label>
      <ReferencePicker groups={groups} selected={reference} onSelect={onReference} />
      <label>
        Message
        <textarea
          name="message"
          required
          minLength={3}
          maxLength={10000}
          rows={6}
          placeholder="Describe what you need help with…"
        />
      </label>
      <div className="inquiry-compose-actions">
        <button type="button" className="support-link" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
        <button className="support-primary" disabled={busy}>
          {busy ? <LoaderCircle className="spin" size={15} /> : <Send size={15} />}
          {busy ? "Sending inquiry…" : "Send inquiry"}
        </button>
      </div>
    </form>
  );
}

type ReferenceGroup = {
  label: string;
  items: ReferenceOption[];
  subgroups?: Array<{ label: string; items: ReferenceOption[] }>;
};

function ReferencePicker({
  groups,
  selected,
  onSelect,
}: {
  groups: ReferenceGroup[];
  selected: InquiryReference | null;
  onSelect: (reference: InquiryReference | null) => void;
}) {
  const isSelected = (option: ReferenceOption) => selected?.type === option.type && selected.id === option.id;
  const allOptions = groups.flatMap((group) => [
    ...group.items,
    ...(group.subgroups?.flatMap((subgroup) => subgroup.items) ?? []),
  ]);
  const selectedOption = allOptions.find(isSelected);
  return (
    <div className="inquiry-reference-picker">
      <div className="inquiry-reference-heading">
        <span className="inquiry-reference-label">Dashboard reference</span>
        <label className="inquiry-no-reference">
          <span>No dashboard reference</span>
          <input type="checkbox" checked={!selected} onChange={(event) => event.target.checked && onSelect(null)} />
        </label>
      </div>
      {selectedOption && <ReferenceSummary label={selectedOption.label} type={selectedOption.type} />}
      <div className="inquiry-reference-groups">
        {groups.map((group) => (
          <details key={group.label}>
            <summary>
              <ChevronRight size={15} />
              <span>{group.label}</span>
              <small>
                {group.items.length + (group.subgroups?.reduce((count, row) => count + row.items.length, 0) ?? 0)}
              </small>
            </summary>
            <div className="inquiry-reference-options">
              {group.items.map((option) => (
                <ReferenceOptionButton
                  key={`${option.type}-${option.id}`}
                  option={option}
                  selected={isSelected(option)}
                  onSelect={onSelect}
                />
              ))}
              {group.subgroups?.map((subgroup) => (
                <details className="inquiry-reference-subgroup" key={subgroup.label}>
                  <summary>
                    <ChevronRight size={14} />
                    <span>{subgroup.label}</span>
                    <small>{subgroup.items.length}</small>
                  </summary>
                  <div className="inquiry-reference-options nested">
                    {subgroup.items.map((option) => (
                      <ReferenceOptionButton
                        key={`${option.type}-${option.id}`}
                        option={option}
                        selected={isSelected(option)}
                        onSelect={onSelect}
                      />
                    ))}
                  </div>
                </details>
              ))}
              {!group.items.length && !group.subgroups?.length && <p>No options available.</p>}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

function ReferenceOptionButton({
  option,
  selected,
  onSelect,
}: {
  option: ReferenceOption;
  selected: boolean;
  onSelect: (reference: InquiryReference) => void;
}) {
  return (
    <button type="button" className={selected ? "selected" : ""} onClick={() => onSelect(option)}>
      <span>{option.label}</span>
      {selected && <Check size={14} />}
    </button>
  );
}

function ReferenceSummary({ label, type }: { label: string | null; type: Inquiry["referenceType"] }) {
  if (!label || type === "NONE") return null;
  return (
    <div className="inquiry-reference-summary">
      <span>{referenceTypeLabel(type)}</span>
      <strong>{label}</strong>
    </div>
  );
}

function journalType(category: "GOOD" | "BAD" | "NOTE") {
  return category === "GOOD" ? "Journal achievement" : category === "BAD" ? "Journal challenge" : "Journal note";
}

function referenceTypeLabel(type: Inquiry["referenceType"]) {
  return type === "JOURNAL_ENTRY"
    ? "Journal entry"
    : type === "KPI_DEFINITION"
      ? "KPI definition"
      : type === "KPI_PERFORMANCE"
        ? "KPI result"
        : type === "GOAL"
          ? "Goal"
          : "Knowledge";
}
