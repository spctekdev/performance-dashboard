"use client";
import { FormEvent, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, LoaderCircle, Plus, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import type { DashboardData } from "@/lib/dashboard";

type Employee = DashboardData["users"][number];
type Category = "GOOD" | "BAD" | "NOTE";

export function MonthlyEntry({
  employee,
  period,
  actor,
}: {
  employee: Employee;
  period: string;
  actor: DashboardData["actor"];
}) {
  const router = useRouter();
  const [kpiBusy, setKpiBusy] = useState(false);
  const [journalBusy, setJournalBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<Category>("GOOD");
  const canManage = actor.accessLevel !== "EMPLOYEE" && actor.id !== employee.id;
  const rows = useMemo(
    () =>
      employee.assignments.map((assignment) => {
        const saved = employee.performance.find(
          (item) => item.period === `${period}-01` && item.kpiId === assignment.kpiId,
        );
        return { ...assignment, current: saved?.current ?? "", target: saved?.target ?? assignment.target };
      }),
    [employee, period],
  );

  async function saveKpis(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setKpiBusy(true);
    setMessage("");
    try {
      const form = new FormData(event.currentTarget);
      for (const row of rows) {
        const value = form.get(`kpi-${row.kpiId}`);
        if (value !== "" && value !== null)
          await post("/api/performance", {
            userId: employee.id,
            kpiId: row.kpiId,
            period: `${period}-01`,
            current: Number(value),
            target: row.target,
          });
      }
      setMessage("KPI status updated.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update KPI status");
    } finally {
      setKpiBusy(false);
    }
  }

  async function addJournal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setJournalBusy(true);
    setMessage("");
    try {
      const form = new FormData(event.currentTarget);
      await post("/api/journals", {
        userId: employee.id,
        description: String(form.get("description") || ""),
        category,
        impact: Number(form.get("impact")),
        period: `${period}-01`,
      });
      event.currentTarget.reset();
      setCategory("GOOD");
      setMessage("Journal entry added.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add journal entry");
    } finally {
      setJournalBusy(false);
    }
  }

  return (
    <section className="card monthly-card">
      <div className="card-header">
        <div>
          <span className="section-eyebrow">PERFORMANCE UPDATE</span>
          <h2>Monthly check-in</h2>
          <p>Update KPI status and add journal entries independently.</p>
        </div>
        <span className="role-chip">{employee.roleTitle}</span>
      </div>
      <div className="entry-layout">
        <form className="entry-block" onSubmit={saveKpis}>
          <div className="entry-panel-header">
            <div>
              <h3>📊 KPI status</h3>
              <p>
                {new Date(`${period}-02T00:00:00Z`).toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                  timeZone: "UTC",
                })}
              </p>
            </div>
          </div>
          {rows.length ? (
            <div className="entry-kpis">
              {rows.map((row) => (
                <label key={row.kpiId}>
                  <span>
                    {row.name}
                    <small>
                      Target {row.target.toLocaleString()} {row.unit}
                    </small>
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    name={`kpi-${row.kpiId}`}
                    defaultValue={row.current}
                    placeholder="Actual"
                  />
                </label>
              ))}
            </div>
          ) : (
            <div className="inline-empty">No KPIs are assigned to this role yet.</div>
          )}
          <button className="btn-primary" disabled={kpiBusy}>
            {kpiBusy ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />} Update KPI status
          </button>
        </form>
        <form className={`journal-entry-panel ${category.toLowerCase()}`} onSubmit={addJournal}>
          <div className="entry-panel-header">
            <div>
              <h3>
                {category === "GOOD" ? (
                  <CheckCircle2 size={18} />
                ) : category === "BAD" ? (
                  <AlertTriangle size={18} />
                ) : (
                  <FileText size={18} />
                )}{" "}
                Add journal entry
              </h3>
              <p>Record an achievement, challenge, or note.</p>
            </div>
          </div>
          {canManage ? (
            <>
              <div className="journal-entry-controls">
                <label>
                  Type
                  <select value={category} onChange={(event) => setCategory(event.target.value as Category)}>
                    <option value="GOOD">Achievement</option>
                    <option value="BAD">Challenge</option>
                    <option value="NOTE">Note</option>
                  </select>
                </label>
                <label>
                  Impact
                  <select name="impact" defaultValue="66">
                    <option value="99">High</option>
                    <option value="66">Medium</option>
                    <option value="33">Low</option>
                  </select>
                </label>
              </div>
              <textarea
                className="journal-entry-textarea"
                name="description"
                minLength={3}
                required
                placeholder="What should be recorded?"
              />
              <button className="btn-primary" disabled={journalBusy}>
                {journalBusy ? <LoaderCircle className="spin" size={17} /> : <Plus size={17} />} Add journal entry
              </button>
            </>
          ) : (
            <div className="journal-entry-locked">
              Journal entries can only be added by a manager for a team member.
            </div>
          )}
        </form>
      </div>
      {message && <div className="form-alert success">{message}</div>}
    </section>
  );
}

async function post(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
}
