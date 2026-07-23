"use client";

import { FormEvent, useMemo, useState } from "react";
import { LoaderCircle, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { JournalTimeline } from "./JournalTimeline";
import type { DashboardData } from "@/lib/dashboard";
import type { InquiryReference } from "./InquiryButton";

type Employee = DashboardData["users"][number];
type Entry = Employee["journals"][number];

export function JournalPanel({
  employee,
  canManage,
  onInquire,
}: {
  employee: Employee;
  canManage: boolean;
  onInquire?: (reference: InquiryReference) => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Entry | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState<"ALL" | Entry["category"]>("ALL");
  const entries = useMemo(
    () => employee.journals.filter((entry) => filter === "ALL" || entry.category === filter),
    [employee.journals, filter],
  );

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      await request(`/api/journals/entry/${editing.id}`, "PATCH", {
        description: String(form.get("description") || ""),
        category: String(form.get("category") || "GOOD"),
        impact: Number(form.get("impact")),
        period: `${String(form.get("period"))}-01`,
      });
      setEditing(null);
      setMessage("Journal entry updated.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update journal entry");
    } finally {
      setBusy(false);
    }
  }

  async function remove(entry: Entry) {
    if (!window.confirm("Delete this journal entry?")) return;
    setBusy(true);
    setMessage("");
    try {
      await request(`/api/journals/entry/${entry.id}`, "DELETE");
      if (editing?.id === entry.id) setEditing(null);
      setMessage("Journal entry deleted.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete journal entry");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <div className="card-header">
        <div>
          <span className="section-eyebrow">REFLECTIONS & SUPPORT</span>
          <h2>Journal</h2>
          <p>Achievements and challenges for {employee.name}.</p>
        </div>
      </div>
      {editing && (
        <div className="journal-modal-backdrop" role="presentation" onMouseDown={() => !busy && setEditing(null)}>
          <form className="journal-edit-modal" onSubmit={save} onMouseDown={(event) => event.stopPropagation()}>
            <div className="journal-modal-header">
              <div>
                <span className="section-eyebrow">JOURNAL EDITOR</span>
                <h3>Edit journal entry</h3>
                <p>Refine the note, type, impact, or reporting month.</p>
              </div>
              <button
                className="journal-modal-close"
                type="button"
                disabled={busy}
                onClick={() => setEditing(null)}
                aria-label="Close editor"
              >
                <X size={18} />
              </button>
            </div>
            <label>
              Entry
              <textarea name="description" defaultValue={editing.description} required minLength={3} />
            </label>
            <div className="two-fields">
              <label>
                Type
                <select name="category" defaultValue={editing.category}>
                  <option value="GOOD">Achievement</option>
                  <option value="BAD">Challenge</option>
                  <option value="NOTE">Note</option>
                </select>
              </label>
              <label>
                Impact
                <select name="impact" defaultValue={String(editing.impact)}>
                  <option value="99">High</option>
                  <option value="66">Medium</option>
                  <option value="33">Low</option>
                </select>
              </label>
            </div>
            <label>
              Month
              <input name="period" type="month" defaultValue={editing.period.slice(0, 7)} required />
            </label>
            <div className="journal-modal-actions">
              <button className="btn-secondary" type="button" disabled={busy} onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button className="btn-primary" type="submit" disabled={busy}>
                {busy ? <LoaderCircle className="spin" size={15} /> : <Save size={15} />} Save changes
              </button>
            </div>
          </form>
        </div>
      )}
      {message && <div className="form-alert success">{message}</div>}
      <div className="list-toolbar">
        <label>
          Filter{" "}
          <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
            <option value="ALL">All entries</option>
            <option value="GOOD">Achievements</option>
            <option value="BAD">Challenges</option>
            <option value="NOTE">Notes</option>
          </select>
        </label>
      </div>
      <JournalTimeline
        entries={entries}
        onEdit={
          canManage
            ? (entry) => setEditing(employee.journals.find((journal) => journal.id === entry.id) ?? null)
            : undefined
        }
        onDelete={
          canManage
            ? (entry) => {
                const journal = employee.journals.find((item) => item.id === entry.id);
                if (journal) void remove(journal);
              }
            : undefined
        }
        onInquire={onInquire ? (entry) => onInquire({ type: "JOURNAL_ENTRY", id: entry.id }) : undefined}
      />
    </section>
  );
}

async function request(url: string, method: "PATCH" | "DELETE", body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
}
