"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DashboardData } from "@/lib/dashboard";

type User = DashboardData["users"][number];
type Timeframe = "monthly" | "quarterly" | "annually";

export function PerformanceComparison({ users, initialEmployeeId }: { users: User[]; initialEmployeeId: string }) {
  const departments = useMemo(
    () =>
      [
        ...new Map(
          users
            .filter((user) => user.departmentId)
            .map((user) => [user.departmentId!, user.departmentName ?? "Unassigned"]),
        ).entries(),
      ].map(([id, name]) => ({ id, name })),
    [users],
  );
  const [departmentId, setDepartmentId] = useState("all");
  const [employeeId, setEmployeeId] = useState(initialEmployeeId);
  const [timeframe, setTimeframe] = useState<Timeframe>("monthly");
  const [windowValue, setWindowValue] = useState("");
  const scopedUsers = useMemo(
    () => (departmentId === "all" ? users : users.filter((user) => user.departmentId === departmentId)),
    [departmentId, users],
  );
  const employee = scopedUsers.find((user) => user.id === employeeId) ?? scopedUsers[0];
  const periods = useMemo(
    () => [...new Set(scopedUsers.flatMap((user) => user.performance.map((item) => item.period)))].sort(),
    [scopedUsers],
  );
  const windowOptions = useMemo(() => reportingWindows(periods, timeframe), [periods, timeframe]);
  const activeWindow = windowOptions.some((option) => option.value === windowValue)
    ? windowValue
    : (windowOptions.at(-1)?.value ?? "");
  const selectedPeriods = useMemo(
    () => periodsForWindow(periods, timeframe, activeWindow),
    [periods, timeframe, activeWindow],
  );
  const scores = useMemo(
    () =>
      scopedUsers
        .map((user) => ({ user, ...performanceSummary(user, selectedPeriods) }))
        .sort((a, b) => b.score - a.score),
    [scopedUsers, selectedPeriods],
  );
  const teamScore = scores.length ? Math.round(scores.reduce((sum, item) => sum + item.score, 0) / scores.length) : 0;
  const selected = employee ? performanceSummary(employee, selectedPeriods) : { score: 0, met: 0, total: 0 };
  const employeeKpis = useMemo(
    () => (employee ? kpiBreakdown(employee, selectedPeriods) : []),
    [employee, selectedPeriods],
  );
  const trend = useMemo(
    () =>
      selectedPeriods.map((period) => ({
        period: formatMonth(period),
        employee: employee ? performanceSummary(employee, [period]).score : 0,
        team: scopedUsers.length
          ? Math.round(
              scopedUsers.reduce((sum, user) => sum + performanceSummary(user, [period]).score, 0) / scopedUsers.length,
            )
          : 0,
      })),
    [employee, scopedUsers, selectedPeriods],
  );
  const timeframeLabel = { monthly: "Monthly", quarterly: "Quarterly", annually: "Annual" }[timeframe];

  return (
    <section className="comparison-panel">
      <div className="card-header comparison-header">
        <div>
          <span className="section-eyebrow">PERFORMANCE COMPARISON</span>
          <h2>Employee and team breakdown</h2>
          <p>Compare KPI achievement over the selected reporting window.</p>
        </div>
        <div className="comparison-timeframes">
          {(["monthly", "quarterly", "annually"] as Timeframe[]).map((option) => (
            <button key={option} className={timeframe === option ? "active" : ""} onClick={() => setTimeframe(option)}>
              {option === "annually" ? "Annual" : option[0].toUpperCase() + option.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="comparison-filters">
        <label>
          Team
          <select
            value={departmentId}
            onChange={(event) => {
              setDepartmentId(event.target.value);
              setWindowValue("");
              const next =
                event.target.value === "all" ? users : users.filter((user) => user.departmentId === event.target.value);
              setEmployeeId(next[0]?.id ?? "");
            }}
          >
            <option value="all">All accessible teams</option>
            {departments.map((department) => (
              <option value={department.id} key={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Employee
          <select value={employee?.id ?? ""} onChange={(event) => setEmployeeId(event.target.value)}>
            {scopedUsers.map((user) => (
              <option value={user.id} key={user.id}>
                {user.name} · {user.roleTitle}
              </option>
            ))}
          </select>
        </label>
        <label>
          Reporting period
          <select
            value={activeWindow}
            onChange={(event) => setWindowValue(event.target.value)}
            disabled={!windowOptions.length}
          >
            {windowOptions.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!employee || !selectedPeriods.length ? (
        <div className="inline-empty">No KPI performance has been recorded for this selection yet.</div>
      ) : (
        <>
          <div className="comparison-summary">
            <ComparisonMetric
              label={employee.name + "'s score"}
              value={selected.score + "%"}
              detail={selected.met + "/" + selected.total + " KPI targets met"}
            />
            <ComparisonMetric
              label="Team average"
              value={teamScore + "%"}
              detail={scores.length + " team member" + (scores.length === 1 ? "" : "s") + " included"}
            />
            <ComparisonMetric
              label="Team difference"
              value={(selected.score - teamScore >= 0 ? "+" : "") + (selected.score - teamScore) + " pts"}
              detail={selected.score >= teamScore ? "Above team average" : "Below team average"}
            />
          </div>
          <article className="comparison-trend-card">
            <div className="comparison-card-heading">
              <div>
                <h3>KPI performance across the period</h3>
                <span>{activeWindow ? windowOptions.find((option) => option.value === activeWindow)?.label : ""}</span>
              </div>
              <small>Employee score compared with team average</small>
            </div>
            <ComparisonTrendChart data={trend} />
          </article>
          <div className="comparison-grid">
            <article className="comparison-card">
              <div className="comparison-card-heading">
                <h3>Team ranking</h3>
                <span>{timeframeLabel} average</span>
              </div>
              <div className="comparison-ranking">
                {scores.map((item, index) => (
                  <div
                    className={"comparison-person " + (item.user.id === employee.id ? "selected" : "")}
                    key={item.user.id}
                  >
                    <span className="comparison-rank">{index + 1}</span>
                    <div>
                      <strong>{item.user.name}</strong>
                      <small>{item.user.roleTitle}</small>
                    </div>
                    <div className="comparison-score">
                      <i>
                        <b style={{ width: Math.min(item.score, 100) + "%" }} />
                      </i>
                      <strong>{item.score}%</strong>
                    </div>
                  </div>
                ))}
              </div>
            </article>
            <article className="comparison-card">
              <div className="comparison-card-heading">
                <h3>{employee.name}&apos;s KPI breakdown</h3>
                <span>{timeframeLabel} average</span>
              </div>
              <div className="comparison-kpis">
                {employeeKpis.map((item) => (
                  <div className="comparison-kpi" key={item.kpiId}>
                    <div>
                      <strong>{item.name}</strong>
                      <small>
                        {item.records} recorded result{item.records === 1 ? "" : "s"}
                      </small>
                    </div>
                    <div>
                      <strong>{item.score}%</strong>
                      <i>
                        <b style={{ width: Math.min(item.score, 100) + "%" }} />
                      </i>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </>
      )}
    </section>
  );
}

function ComparisonMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}
function ComparisonTrendChart({ data }: { data: { period: string; employee: number; team: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={235}>
      <LineChart data={data} margin={{ top: 14, right: 14, left: -22, bottom: 0 }}>
        <CartesianGrid stroke="#eef0f6" strokeDasharray="3 3" />
        <XAxis dataKey="period" tick={{ fontSize: 10 }} axisLine={false} />
        <YAxis domain={[0, 120]} tick={{ fontSize: 10 }} axisLine={false} />
        <Tooltip
          contentStyle={{ borderRadius: 9, border: "1px solid #e2e5ef" }}
          formatter={(value: number) => value + "%"}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line
          type="monotone"
          dataKey="employee"
          name="Employee score"
          stroke="#4f46e5"
          strokeWidth={3}
          dot={{ r: 3 }}
        />
        <Line
          type="monotone"
          dataKey="team"
          name="Team average"
          stroke="#14b8a6"
          strokeWidth={2.5}
          strokeDasharray="6 4"
          dot={{ r: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
function performanceSummary(user: User, periods: string[]) {
  const records = user.performance.filter((item) => periods.includes(item.period));
  const score = records.length
    ? Math.round(
        records.reduce((sum, item) => sum + (item.target ? (item.current / item.target) * 100 : 0), 0) / records.length,
      )
    : 0;
  return { score, met: records.filter((item) => item.current >= item.target).length, total: records.length };
}
function kpiBreakdown(user: User, periods: string[]) {
  const grouped = new Map<string, User["performance"]>();
  user.performance
    .filter((item) => periods.includes(item.period))
    .forEach((item) => grouped.set(item.kpiId, [...(grouped.get(item.kpiId) ?? []), item]));
  return [...grouped.values()]
    .map((records) => ({
      kpiId: records[0].kpiId,
      name: records[0].name,
      records: records.length,
      score: Math.round(
        records.reduce((sum, item) => sum + (item.target ? (item.current / item.target) * 100 : 0), 0) / records.length,
      ),
    }))
    .sort((a, b) => b.score - a.score);
}
function reportingWindows(periods: string[], timeframe: Timeframe) {
  if (timeframe === "monthly") return periods.map((period) => ({ value: period, label: formatPeriod(period) }));
  if (timeframe === "quarterly")
    return [...new Set(periods.map(quarterKey))].map((value) => ({ value, label: formatQuarter(value) }));
  return [...new Set(periods.map((period) => period.slice(0, 4)))].map((value) => ({ value, label: value }));
}
function periodsForWindow(periods: string[], timeframe: Timeframe, value: string) {
  if (timeframe === "monthly") return periods.filter((period) => period === value);
  if (timeframe === "quarterly") return periods.filter((period) => quarterKey(period) === value);
  return periods.filter((period) => period.startsWith(value + "-"));
}
function quarterKey(period: string) {
  return period.slice(0, 4) + "-Q" + (Math.floor((Number(period.slice(5, 7)) - 1) / 3) + 1);
}
function formatQuarter(value: string) {
  return value.slice(5) + " " + value.slice(0, 4);
}
function formatPeriod(period: string) {
  return new Date(period + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
function formatMonth(period: string) {
  return new Date(period + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
}
