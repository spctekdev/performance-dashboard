"use client";

import { useMemo, useState } from "react";
import type { DashboardData } from "@/lib/dashboard";

type Entry = DashboardData["knowledge"][number];
type BestPractice = Extract<Entry["content"], { priority: string }>;
type Kpi = { title: string; description: string; target_label: string | number; metadata: Record<string, string>[] };

export function KnowledgePanel({ data }: { data: DashboardData }) {
  const firstDepartmentId = data.departments[0]?.id ?? "";
  const [departmentId, setDepartmentId] = useState(firstDepartmentId);
  const categories = useMemo(() => data.categories.filter((category) => category.departmentId === departmentId), [data.categories, departmentId]);
  const [categoryId, setCategoryId] = useState(() => data.categories.find((category) => category.departmentId === firstDepartmentId)?.id ?? "");
  const activeCategoryId = categories.some((category) => category.id === categoryId) ? categoryId : categories[0]?.id ?? "";

  const entries = useMemo(() => data.knowledge.filter((entry) => entry.categoryId === activeCategoryId), [data.knowledge, activeCategoryId]);
  const sops = entries.filter((entry) => entry.type === "SOP");
  const bestPractices = entries.filter((entry) => entry.type === "BEST_PRACTICE");
  const kpis = entries.filter((entry) => entry.type === "KPI");
  const selectedCategory = categories.find((category) => category.id === activeCategoryId);

  function selectDepartment(nextDepartmentId: string) {
    const nextCategories = data.categories.filter((category) => category.departmentId === nextDepartmentId);
    setDepartmentId(nextDepartmentId);
    setCategoryId(nextCategories[0]?.id ?? "");
  }

  return <section className="knowledge-library">
    <div className="knowledge-library-heading"><span>SPCTEK KNOWLEDGE BASE</span><h2>{selectedCategory?.name ?? "Knowledge library"}</h2><p>Department processes, working standards, and measurable targets.</p></div>
    <div className="knowledge-filter-stack">
      <label>Department<select value={departmentId} onChange={(event) => selectDepartment(event.target.value)}>{data.departments.map((department) => <option value={department.id} key={department.id}>{department.name}</option>)}</select></label>
      <label>Category<select value={activeCategoryId} onChange={(event) => setCategoryId(event.target.value)} disabled={!categories.length}>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
    </div>

    {!activeCategoryId ? <KnowledgeEmpty label="No categories are available for this department." /> : <div className="knowledge-sections">
      {sops.length > 0 && <KnowledgeSection title="Standard operating procedures"><div className="knowledge-sop-grid">{sops.map((entry) => <SopCard entry={entry} key={entry.id} />)}</div></KnowledgeSection>}
      <KnowledgeSection title="Best practices">{bestPractices.length ? <div className="knowledge-card-grid">{bestPractices.map((entry) => <BestPracticeCard entry={entry} key={entry.id} />)}</div> : <KnowledgeEmpty label="No best practices are available in this category." />}</KnowledgeSection>
      <KnowledgeSection title="KPI references" banner>{kpis.length ? <div className="knowledge-card-grid">{kpis.map((entry) => <KpiCard entry={entry} key={entry.id} />)}</div> : <KnowledgeEmpty label="No KPI references are available in this category." />}</KnowledgeSection>
    </div>}
  </section>;
}

function KnowledgeSection({ title, banner = false, children }: { title: string; banner?: boolean; children: React.ReactNode }) {
  return <section className="knowledge-section">{banner ? <div className="knowledge-kpi-banner"><h3>{title}</h3><p>Targets and measurement context for this category.</p></div> : <h3 className="knowledge-section-title">{title}</h3>}{children}</section>;
}

function SopCard({ entry }: { entry: Entry }) {
  const content = entry.content as Extract<Entry["content"], { steps: unknown[] }>;
  return <article className="knowledge-sop-card"><h4>{content.title}</h4><p>{content.description}</p><small>{content.steps.length} steps{content.tags.length ? ` · ${content.tags.join(", ")}` : ""}</small></article>;
}

function BestPracticeCard({ entry }: { entry: Entry }) {
  const content = entry.content as BestPractice & { source?: string };
  return <article className="knowledge-bp-card"><div className="knowledge-card-top"><h4><span>◆</span>{content.title}</h4><Priority priority={content.priority} /></div><p>{content.description}</p>{content.source && <em>Source: {content.source}</em>}</article>;
}

function KpiCard({ entry }: { entry: Entry }) {
  const content = entry.content as Kpi;
  const metadata = content.metadata.flatMap((item) => Object.entries(item));
  return <article className="knowledge-kpi-card"><div className="knowledge-card-top"><h4><span>◆</span>{content.title}</h4><strong className="knowledge-target">{content.target_label}</strong></div><p>{content.description}</p>{metadata.length > 0 && <div className="knowledge-metadata">{metadata.map(([key, value]) => <span key={`${key}-${value}`}><small>{key}</small><b>{value}</b></span>)}</div>}</article>;
}

function Priority({ priority }: { priority: string }) { return <span className={`knowledge-priority ${priority}`}>{priority}</span>; }
function KnowledgeEmpty({ label }: { label: string }) { return <div className="knowledge-empty">{label}</div>; }
