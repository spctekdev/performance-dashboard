"use client";
import { FormEvent, useMemo, useState } from "react";
import { CalendarDays, LoaderCircle, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { DashboardData } from "@/lib/dashboard";

type Employee = DashboardData["users"][number];
type Goal = Employee["goals"][number];
const statuses = ["BACKLOG", "IN_PROGRESS", "BLOCKED", "UNDER_REVIEW", "FINISHED"] as const;
const label = (status: string) => status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export function GoalsPanel({ employee, canManage }: { employee: Employee; canManage: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Goal | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [filter, setFilter] = useState("ALL");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [renderedAt] = useState(() => Date.now());
  const goals = useMemo(
    () => employee.goals.filter((goal) => filter === "ALL" || goal.status === filter),
    [employee.goals, filter],
  );
  const activeGoal = editing || (isAdding ? ({} as Goal) : null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const editingGoal = editing;
    setBusy(true);
    setMessage("");
    const body = {
      userId: employee.id,
      description: String(form.get("description") || ""),
      deadline: new Date(String(form.get("deadline"))).toISOString(),
      status: String(form.get("status")),
      remarks: String(form.get("remarks") || ""),
    };
    try {
      await request(editingGoal ? `/api/goals/${editingGoal.id}` : "/api/goals", editingGoal ? "PATCH" : "POST", body);
      formElement.reset();
      setEditing(null);
      setIsAdding(false);
      setMessage(editingGoal ? "Goal updated." : "Goal added.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save goal");
    } finally {
      setBusy(false);
    }
  }
  async function remove(goal: Goal) {
    if (!window.confirm("Delete this goal?")) return;
    setBusy(true);
    setMessage("");
    try {
      await request(`/api/goals/${goal.id}`, "DELETE");
      setMessage("Goal deleted.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete goal");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card list-panel">
      <div className="card-header list-panel-header">
        <div>
          <span className="section-eyebrow">PLANNING & DELIVERY</span>
          <h2>Goals</h2>
          <p>Deadlines, progress, and manager remarks for {employee.name}.</p>
        </div>
        {canManage && (
          <button className="btn-primary add-goal-button" type="button" onClick={() => setIsAdding(true)}>
            <Plus size={16} /> Add goal
          </button>
        )}
      </div>
      {message && <div className="form-alert success">{message}</div>}
      <div className="list-toolbar">
        <label>
          Filter{" "}
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="ALL">All statuses</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {label(status)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="goal-list">
        {goals.length ? (
          goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              renderedAt={renderedAt}
              canManage={canManage}
              onEdit={() => setEditing(goal)}
              onDelete={() => void remove(goal)}
            />
          ))
        ) : (
          <div className="inline-empty">No goals match this filter.</div>
        )}
      </div>
      {activeGoal && (
        <div
          className="journal-modal-backdrop"
          role="presentation"
          onMouseDown={() => !busy && (setEditing(null), setIsAdding(false))}
        >
          <form
            className="journal-edit-modal goal-modal"
            onSubmit={save}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="journal-modal-header">
              <div>
                <span className="section-eyebrow">GOAL EDITOR</span>
                <h3>{editing ? "Edit goal" : "Add a goal"}</h3>
                <p>Set a clear outcome, deadline, status, and supporting remarks.</p>
              </div>
              <button
                className="journal-modal-close"
                type="button"
                disabled={busy}
                onClick={() => {
                  setEditing(null);
                  setIsAdding(false);
                }}
                aria-label="Close editor"
              >
                <X size={18} />
              </button>
            </div>
            <label>
              Goal description
              <textarea
                name="description"
                required
                minLength={3}
                defaultValue={editing?.description}
                placeholder="What needs to be achieved?"
              />
            </label>
            <div className="two-fields">
              <label>
                Deadline
                <input name="deadline" type="datetime-local" required defaultValue={editing?.deadline.slice(0, 16)} />
              </label>
              <label>
                Status
                <select name="status" defaultValue={editing?.status ?? "BACKLOG"}>
                  {statuses.map((status) => (
                    <option value={status} key={status}>
                      {label(status)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Manager remarks
              <textarea name="remarks" defaultValue={editing?.remarks} placeholder="Context, feedback, or next steps" />
            </label>
            <div className="journal-modal-actions">
              <button
                className="btn-secondary"
                type="button"
                disabled={busy}
                onClick={() => {
                  setEditing(null);
                  setIsAdding(false);
                }}
              >
                Cancel
              </button>
              <button className="btn-primary" disabled={busy}>
                {busy ? <LoaderCircle className="spin" size={16} /> : editing ? <Save size={16} /> : <Plus size={16} />}
                {editing ? " Save changes" : " Add goal"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

export function GoalCard({
  goal,
  renderedAt,
  canManage,
  onEdit,
  onDelete,
}: {
  goal: Goal;
  renderedAt: number;
  canManage: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const deadline = new Date(goal.deadline);
  const hoursRemaining = Math.ceil((deadline.getTime() - renderedAt) / 3_600_000);
  const absHours = Math.abs(hoursRemaining);
  const days = Math.floor(absHours / 24);
  const hours = absHours % 24;
  const timeRemaining = `${days} day${days === 1 ? "" : "s"}${hours ? `, ${hours} hour${hours === 1 ? "" : "s"}` : ""}`;
  return (
    <article className={`timeline-item goal-entry status-${goal.status.toLowerCase()}`}>
      <div className="timeline-date">
        <time>
          {deadline.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}
        </time>
      </div>
      <div className="timeline-content">
        <div className="timeline-meta">
          <span className={`status-chip ${goal.status.toLowerCase()}`}>{label(goal.status)}</span>
        </div>
        <p>{goal.description}</p>
        {goal.remarks && <small className="goal-entry-remarks">{goal.remarks}</small>}
        <div className="entry-badges">
          <span className="goal-deadline">
            <CalendarDays size={14} />
            <time>Due {deadline.toLocaleTimeString("en-US", { timeStyle: "short", timeZone: "UTC" })}</time>
            {goal.status !== "FINISHED" && (
              <em className={hoursRemaining < 0 ? "overdue" : ""}>
                {hoursRemaining < 0 ? `${timeRemaining} overdue` : `${timeRemaining} left`}
              </em>
            )}
          </span>
        </div>
      </div>
      {canManage && onEdit && onDelete && (
        <div className="timeline-actions">
          <button type="button" onClick={onEdit}>
            <Pencil size={13} /> Edit
          </button>
          <button type="button" onClick={onDelete}>
            <Trash2 size={13} /> Delete
          </button>
        </div>
      )}
    </article>
  );
}
async function request(url: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
}
