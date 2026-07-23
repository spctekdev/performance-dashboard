"use client";
import { useMemo, useState } from "react";
import {
  CalendarDays,
  Gauge,
  LayoutDashboard,
  Settings2,
  TrendingUp,
  Users,
  ClipboardEdit,
  Target,
  BookOpen,
  BarChart3,
  Bot,
  Inbox,
} from "lucide-react";
import type { DashboardData } from "@/lib/dashboard";
import { Header } from "./Header";
import { PerformanceCard } from "./PerformanceCard";
import { PerformanceChart, KpiBarChart } from "./PerformanceChart";
import { KPICard } from "./KPICard";
import { JournalTimeline } from "./JournalTimeline";
import { JournalPanel } from "./JournalPanel";
import { GoalCard, GoalsPanel } from "./GoalsPanel";
import { MonthlyEntry } from "./MonthlyEntry";
import { TeamOverview } from "./TeamOverview";
import { AdminPanel } from "./AdminPanel";
import { KnowledgePanel } from "./KnowledgePanel";
import { RoleProgressionTree } from "./RoleProgressionTree";
import { PerformanceComparison } from "./PerformanceComparison";
import { PulsePanel } from "./PulsePanel";
import { InquiriesPanel } from "./InquiriesPanel";
import type { InquiryReference } from "./InquiryButton";

type Tab =
  | "overview"
  | "entry"
  | "journal"
  | "goals"
  | "knowledge"
  | "kpis"
  | "comparison"
  | "team"
  | "management"
  | "hierarchy"
  | "pulse"
  | "inquiries";
export function DashboardShell({
  data,
  initialTab = "overview",
  initialInquiryId,
  initialKnowledgeId,
}: {
  data: DashboardData;
  initialTab?: Tab;
  initialInquiryId?: string;
  initialKnowledgeId?: string;
}) {
  const initialId = data.users.find((u) => u.id === data.actor.id)?.id || data.users[0]?.id;
  const [selectedId, setSelectedId] = useState(initialId);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [tab, setTab] = useState<Tab>(initialTab);
  const [inquiryReference, setInquiryReference] = useState<InquiryReference | undefined>();
  const [overviewRenderedAt] = useState(() => Date.now());
  const employee = data.users.find((u) => u.id === selectedId) || data.users[0];
  const selectableUsers = data.users;
  const stats = useMemo(() => (employee ? getStats(employee) : null), [employee]);
  if (!employee)
    return (
      <>
        <Header user={data.actor} />
        <main className="container">
          <div className="empty-state">
            <h2>No accessible employee records</h2>
            <p>Ask an administrator to configure your account.</p>
          </div>
        </main>
      </>
    );
  const tabs: { id: Tab; label: string; icon: typeof LayoutDashboard; visible: boolean }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard, visible: true },
    { id: "entry", label: "Performance Update", icon: ClipboardEdit, visible: data.actor.accessLevel !== "EMPLOYEE" },
    { id: "journal", label: "Journal", icon: ClipboardEdit, visible: true },
    { id: "goals", label: "Goals", icon: Target, visible: true },
    { id: "knowledge", label: "Knowledge", icon: BookOpen, visible: true },
    { id: "pulse", label: "Pulse", icon: Bot, visible: true },
    { id: "inquiries", label: "Inquiries", icon: Inbox, visible: true },
    { id: "kpis", label: "KPI Tracking", icon: Target, visible: true },
    { id: "comparison", label: "Comparison", icon: BarChart3, visible: data.actor.accessLevel !== "EMPLOYEE" },
    { id: "team", label: "Team Overview", icon: Users, visible: data.actor.accessLevel !== "EMPLOYEE" },
    { id: "management", label: "Management", icon: Settings2, visible: data.actor.accessLevel !== "EMPLOYEE" },
    { id: "hierarchy", label: "Hierarchy", icon: Users, visible: data.actor.accessLevel !== "EMPLOYEE" },
  ];
  const canInquire = data.actor.accessLevel === "EMPLOYEE" && employee.id === data.actor.id;
  function openInquiry(reference: InquiryReference) {
    setInquiryReference(reference);
    setTab("inquiries");
  }
  return (
    <div className="dashboard-page">
      <Header user={data.actor} />
      <main className="container">
        <section className="selector-bar">
          <label>
            <span>👤 Team member</span>
            <select value={employee.id} onChange={(e) => setSelectedId(e.target.value)}>
              {selectableUsers.map((u) => (
                <option value={u.id} key={u.id}>
                  {u.name} - {u.roleTitle}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>📅 Reporting month</span>
            <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
          </label>
          <label>
            <span>Role & access</span>
            <div className="person-info">
              <strong>{employee.roleTitle}</strong>
              <small>{employee.departmentName ?? employee.accessLevel.toLowerCase()}</small>
            </div>
          </label>
        </section>
        <nav className="tabs" aria-label="Dashboard sections">
          {tabs
            .filter((t) => t.visible)
            .map((item) => (
              <button
                key={item.id}
                className={tab === item.id ? "active" : ""}
                onClick={() => {
                  if (item.id === "inquiries") setInquiryReference(undefined);
                  setTab(item.id);
                }}
              >
                <item.icon size={16} />
                {item.label}
              </button>
            ))}
        </nav>
        {tab === "overview" && stats && (
          <>
            <section className="dash-banner-grid">
              <PerformanceCard
                icon={Gauge}
                label="Overall score"
                value={`${stats.overall}%`}
                sub={`${stats.delta >= 0 ? "+" : ""}${stats.delta}% vs prior month`}
                theme="dash-banner-pink"
              />
              <PerformanceCard
                icon={Target}
                label="KPIs met"
                value={`${stats.met}/${stats.latest.length}`}
                sub={`${stats.latest.length ? Math.round((stats.met / stats.latest.length) * 100) : 0}% achievement rate`}
                theme="dash-banner-purple"
              />
              <PerformanceCard
                icon={TrendingUp}
                label="Growth trajectory"
                value={stats.delta > 2 ? "Rising" : stats.delta < -2 ? "Falling" : "Steady"}
                sub="Performance trend"
                theme="dash-banner-teal"
              />
              <PerformanceCard
                icon={CalendarDays}
                label="Journal entries"
                value={String(employee.journals.length)}
                sub="Achievements & challenges"
                theme="dash-banner-orange"
              />
            </section>
            <section className="dash-main-row">
              <article className="chart-card main">
                <div className="chart-head">
                  <div>
                    <h2>Performance Trend</h2>
                    <p>Monthly target achievement</p>
                  </div>
                  <div className="legend">
                    <span className="score-dot" />
                    Score <span className="target-dot" />
                    Target
                  </div>
                </div>
                <PerformanceChart data={stats.trend} />
              </article>
              <article className="chart-card">
                <div className="chart-head">
                  <div>
                    <h2>KPI Balance</h2>
                    <p>Latest period by metric</p>
                  </div>
                </div>
                <KpiBarChart
                  data={stats.latest.map((x) => ({ name: x.name, score: Math.round((x.current / x.target) * 100) }))}
                />
              </article>
            </section>
            <section className="dash-bottom-row">
              <article className="card overview-kpi-card">
                <div className="card-header compact">
                  <div>
                    <span className="section-eyebrow">LATEST MONTH</span>
                    <h2>KPI Overview</h2>
                  </div>
                  <button onClick={() => setTab("kpis")}>View all →</button>
                </div>
                {stats.latest.slice(0, 3).map((k) => (
                  <KPICard
                    key={k.id}
                    {...k}
                    onInquire={canInquire ? () => openInquiry({ type: "KPI_PERFORMANCE", id: k.id }) : undefined}
                  />
                ))}
                {!stats.latest.length && <div className="inline-empty">No performance has been recorded yet.</div>}
              </article>
              {employee.nextRole && (
                <article className="card next-role-panel overview-next-role-card">
                  <div className="card-header compact">
                    <div>
                      <span className="section-eyebrow">ROLE PROGRESSION</span>
                      <h2>Next role: {employee.nextRole.title}</h2>
                    </div>
                  </div>
                  {employee.nextRole.kpis.length ? (
                    <div className="next-role-kpi-grid">
                      {employee.nextRole.kpis.map((kpi) => (
                        <article className="next-role-kpi" key={kpi.id}>
                          <span>{kpi.name}</span>
                          <strong>{kpi.target.toLocaleString() + " " + kpi.unit}</strong>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="inline-empty">No KPI targets have been assigned to this role yet.</div>
                  )}
                </article>
              )}
              <article className="card overview-journal-card">
                <div className="card-header compact">
                  <div>
                    <span className="section-eyebrow">RECENT ACTIVITY</span>
                    <h2>Journal</h2>
                  </div>
                  <button onClick={() => setTab("journal")}>View all →</button>
                </div>
                <JournalTimeline
                  entries={employee.journals.slice(0, 3)}
                  onInquire={canInquire ? (entry) => openInquiry({ type: "JOURNAL_ENTRY", id: entry.id }) : undefined}
                />
              </article>
              <article className="card overview-goals-card">
                <div className="card-header compact">
                  <div>
                    <span className="section-eyebrow">PLANNING & DELIVERY</span>
                    <h2>Goals</h2>
                  </div>
                  <button onClick={() => setTab("goals")}>View all →</button>
                </div>
                {employee.goals.length ? (
                  <div className="timeline">
                    {employee.goals.slice(0, 3).map((goal) => (
                      <GoalCard
                        key={goal.id}
                        goal={goal}
                        renderedAt={overviewRenderedAt}
                        canManage={false}
                        onInquire={canInquire ? () => openInquiry({ type: "GOAL", id: goal.id }) : undefined}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="inline-empty">No goals have been added yet.</div>
                )}
              </article>
            </section>
          </>
        )}
        {tab === "entry" && <MonthlyEntry employee={employee} period={period} actor={data.actor} />}{" "}
        {tab === "journal" && (
          <JournalPanel
            employee={employee}
            canManage={data.actor.accessLevel !== "EMPLOYEE" && data.actor.id !== employee.id}
            onInquire={canInquire ? openInquiry : undefined}
          />
        )}{" "}
        {tab === "goals" && (
          <GoalsPanel
            employee={employee}
            canManage={data.actor.accessLevel !== "EMPLOYEE" && data.actor.id !== employee.id}
            onInquire={canInquire ? openInquiry : undefined}
          />
        )}{" "}
        {tab === "knowledge" && (
          <KnowledgePanel
            data={data}
            initialKnowledgeId={initialKnowledgeId}
            onInquire={canInquire ? openInquiry : undefined}
          />
        )}{" "}
        {tab === "pulse" && (
          <PulsePanel
            onStartInquiry={() => {
              setInquiryReference(undefined);
              setTab("inquiries");
            }}
          />
        )}{" "}
        {tab === "inquiries" && (
          <InquiriesPanel
            key={inquiryReference ? `${inquiryReference.type}:${inquiryReference.id}` : "inquiries"}
            data={data}
            initialInquiryId={initialInquiryId}
            initialReference={inquiryReference}
          />
        )}{" "}
        {tab === "kpis" && (
          <section className="card">
            <div className="card-header">
              <div>
                <span className="section-eyebrow">MEASURABLE OUTCOMES</span>
                <h2>KPI Performance Tracking</h2>
                <p>Latest results against the targets assigned to {employee.roleTitle}.</p>
              </div>
            </div>
            <div className="kpi-grid">
              {stats?.latest.length
                ? stats.latest.map((k) => (
                    <KPICard
                      key={k.id}
                      {...k}
                      onInquire={canInquire ? () => openInquiry({ type: "KPI_PERFORMANCE", id: k.id }) : undefined}
                    />
                  ))
                : employee.assignments.map((a) => (
                    <KPICard
                      key={a.id}
                      name={a.name}
                      unit={a.unit}
                      current={0}
                      target={a.target}
                      onInquire={canInquire ? () => openInquiry({ type: "KPI_DEFINITION", id: a.kpiId }) : undefined}
                    />
                  ))}
            </div>
          </section>
        )}{" "}
        {tab === "comparison" && <PerformanceComparison users={data.users} initialEmployeeId={employee.id} />}{" "}
        {tab === "team" && <TeamOverview users={data.users} actorId={data.actor.id} />}{" "}
        {tab === "management" && <AdminPanel data={data} />}
        {tab === "hierarchy" && <RoleProgressionTree roles={data.roles} />}
      </main>
    </div>
  );
}
function getStats(employee: DashboardData["users"][number]) {
  const periods = [...new Set(employee.performance.map((p) => p.period))].sort();
  const latestPeriod = periods.at(-1);
  const previousPeriod = periods.at(-2);
  const rows = (period?: string) => employee.performance.filter((p) => p.period === period);
  const average = (items: typeof employee.performance) =>
    items.length
      ? Math.round(items.reduce((s, p) => s + (p.target ? (p.current / p.target) * 100 : 0), 0) / items.length)
      : 0;
  const latest = rows(latestPeriod);
  const overall = average(latest);
  const previous = average(rows(previousPeriod));
  const trend = periods.map((period) => ({
    period: new Date(`${period}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
    score: average(rows(period)),
    target: 100,
  }));
  return {
    latest,
    overall,
    delta: previousPeriod ? overall - previous : 0,
    met: latest.filter((p) => p.current >= p.target).length,
    trend,
  };
}
