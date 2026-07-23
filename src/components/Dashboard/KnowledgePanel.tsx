"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Edit3, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { DashboardData } from "@/lib/dashboard";
import { InquiryButton, type InquiryReference } from "./InquiryButton";
import { SopEditor } from "./SopEditor";

type Entry = DashboardData["knowledge"][number];
type KnowledgeType = "SOP" | "BEST_PRACTICE" | "KPI";
type BestPractice = Extract<Entry["content"], { priority: string }>;
type Kpi = { title: string; description: string; target_label: string | number; metadata: Record<string, string>[] };

export function KnowledgePanel({
  data,
  onInquire,
  initialKnowledgeId,
}: {
  data: DashboardData;
  onInquire?: (reference: InquiryReference) => void;
  initialKnowledgeId?: string;
}) {
  const router = useRouter();
  const initialEntry = data.knowledge.find((entry) => entry.id === initialKnowledgeId);
  const initialCategory = data.categories.find((category) => category.id === initialEntry?.categoryId);
  const firstDepartmentId = initialCategory?.departmentId ?? data.departments[0]?.id ?? "";
  const [departmentId, setDepartmentId] = useState(firstDepartmentId);
  const categories = useMemo(
    () => data.categories.filter((category) => category.departmentId === departmentId),
    [data.categories, departmentId],
  );
  const [categoryId, setCategoryId] = useState(
    () =>
      initialCategory?.id ?? data.categories.find((category) => category.departmentId === firstDepartmentId)?.id ?? "",
  );
  const [highlightedKnowledgeId, setHighlightedKnowledgeId] = useState(initialEntry?.id ?? "");
  const [editor, setEditor] = useState<{ type: KnowledgeType; entry?: Entry } | null>(null);
  const activeCategoryId = categories.some((category) => category.id === categoryId)
    ? categoryId
    : (categories[0]?.id ?? "");
  const entries = useMemo(
    () => data.knowledge.filter((entry) => entry.categoryId === activeCategoryId),
    [data.knowledge, activeCategoryId],
  );
  const selectedCategory = categories.find((category) => category.id === activeCategoryId);
  const selectedDepartment = data.departments.find((department) => department.id === departmentId);
  const canManage =
    data.actor.accessLevel === "ADMIN" ||
    selectedDepartment?.managers.some((manager) => manager.id === data.actor.id) === true;
  const sops = entries.filter((entry) => entry.type === "SOP");
  const bestPractices = entries.filter((entry) => entry.type === "BEST_PRACTICE");
  const kpis = entries.filter((entry) => entry.type === "KPI");

  useEffect(() => {
    if (!highlightedKnowledgeId || !entries.some((entry) => entry.id === highlightedKnowledgeId)) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`knowledge-${highlightedKnowledgeId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
    const timeout = window.setTimeout(() => setHighlightedKnowledgeId(""), 2_800);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [entries, highlightedKnowledgeId]);

  function selectDepartment(nextDepartmentId: string) {
    const nextCategories = data.categories.filter((category) => category.departmentId === nextDepartmentId);
    setDepartmentId(nextDepartmentId);
    setCategoryId(nextCategories[0]?.id ?? "");
  }

  async function remove(entry: Entry) {
    if (!window.confirm(`Delete “${(entry.content as { title: string }).title}”? This cannot be undone.`)) return;
    const response = await fetch(`/api/knowledge/${entry.id}`, { method: "DELETE" });
    if (!response.ok) return window.alert((await response.json()).error ?? "Could not delete the entry.");
    router.refresh();
  }

  async function editCategory() {
    if (!selectedCategory) return;
    const name = window.prompt("Category name", selectedCategory.name);
    if (name === null) return;
    const description = window.prompt("Category description", selectedCategory.description);
    if (description === null) return;
    if (name.trim() === selectedCategory.name && description.trim() === selectedCategory.description) return;
    const response = await fetch(`/api/categories/${selectedCategory.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });
    if (!response.ok) return window.alert((await response.json()).error ?? "Could not update the category.");
    router.refresh();
  }
  async function addCategory() {
    if (!selectedDepartment) return;
    const name = window.prompt("New category name");
    if (!name) return;
    const description = window.prompt("Category description");
    if (!description) return;
    const response = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, departmentId: selectedDepartment.id }),
    });
    if (!response.ok) return window.alert((await response.json()).error ?? "Could not create the category.");
    router.refresh();
  }

  return (
    <section className="knowledge-library">
      <div className="knowledge-library-toolbar">
        <div className="knowledge-library-heading">
          <h2>{selectedDepartment?.name ?? "Knowledge library"}</h2>
          <span>{selectedCategory?.name ?? "Select a category"}</span>
          {selectedCategory && <p>{selectedCategory.description}</p>}
          <div className="knowledge-category-actions">
            {canManage && selectedCategory && (
              <button type="button" className="knowledge-description-edit" onClick={editCategory}>
                <Edit3 size={12} /> Edit category
              </button>
            )}
            {canManage && selectedDepartment && (
              <button type="button" className="knowledge-description-edit" onClick={addCategory}>
                <Plus size={12} /> Add category
              </button>
            )}
          </div>
        </div>
        <div className="knowledge-filter-stack">
          <label>
            Department
            <select value={departmentId} onChange={(event) => selectDepartment(event.target.value)}>
              {data.departments.map((department) => (
                <option value={department.id} key={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Category
            <select
              value={activeCategoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              disabled={!categories.length}
            >
              {categories.map((category) => (
                <option value={category.id} key={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {!activeCategoryId ? (
        <KnowledgeEmpty label="No categories are available for this department." />
      ) : (
        <div className="knowledge-sections">
          <KnowledgeSection
            title="Standard operating procedures"
            action={canManage ? <AddButton label="Add SOP" onClick={() => setEditor({ type: "SOP" })} /> : null}
          >
            {sops.length ? (
              <div className="knowledge-sop-grid">
                {sops.map((entry) => (
                  <SopCard
                    entry={entry}
                    key={entry.id}
                    focused={entry.id === highlightedKnowledgeId}
                    canManage={canManage}
                    onEdit={() => setEditor({ type: "SOP", entry })}
                    onDelete={() => remove(entry)}
                    onInquire={onInquire ? () => onInquire({ type: "KNOWLEDGE", id: entry.id }) : undefined}
                  />
                ))}
              </div>
            ) : (
              <KnowledgeEmpty label="No SOPs are available in this category." />
            )}
          </KnowledgeSection>
          <KnowledgeSection
            title="Best practices"
            action={
              canManage ? (
                <AddButton label="Add best practice" onClick={() => setEditor({ type: "BEST_PRACTICE" })} />
              ) : null
            }
          >
            {bestPractices.length ? (
              <div className="knowledge-card-grid">
                {bestPractices.map((entry) => (
                  <BestPracticeCard
                    entry={entry}
                    key={entry.id}
                    focused={entry.id === highlightedKnowledgeId}
                    canManage={canManage}
                    onEdit={() => setEditor({ type: "BEST_PRACTICE", entry })}
                    onDelete={() => remove(entry)}
                    onInquire={onInquire ? () => onInquire({ type: "KNOWLEDGE", id: entry.id }) : undefined}
                  />
                ))}
              </div>
            ) : (
              <KnowledgeEmpty label="No best practices are available in this category." />
            )}
          </KnowledgeSection>
          <KnowledgeSection
            title="Key performance indicators"
            action={canManage ? <AddButton label="Add KPI" onClick={() => setEditor({ type: "KPI" })} /> : null}
          >
            {kpis.length ? (
              <div className="knowledge-card-grid">
                {kpis.map((entry) => (
                  <KpiCard
                    entry={entry}
                    key={entry.id}
                    focused={entry.id === highlightedKnowledgeId}
                    canManage={canManage}
                    onEdit={() => setEditor({ type: "KPI", entry })}
                    onDelete={() => remove(entry)}
                    onInquire={onInquire ? () => onInquire({ type: "KNOWLEDGE", id: entry.id }) : undefined}
                  />
                ))}
              </div>
            ) : (
              <KnowledgeEmpty label="No key performance indicators are available in this category." />
            )}
          </KnowledgeSection>
        </div>
      )}
      {editor ? (
        editor.type === "SOP" ? (
          <SopEditor
            key={editor.entry?.id ?? editor.type}
            entry={editor.entry}
            categoryId={activeCategoryId}
            onClose={() => setEditor(null)}
          />
        ) : (
          <KnowledgeEditor
            key={editor.entry?.id ?? editor.type}
            type={editor.type}
            entry={editor.entry}
            categoryId={activeCategoryId}
            onClose={() => setEditor(null)}
          />
        )
      ) : null}
    </section>
  );
}

function KnowledgeSection({
  title,
  action,
  children,
}: {
  title: string;
  action: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="knowledge-section">
      <div className="knowledge-section-header">
        <h3 className="knowledge-section-title">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function SopCard({ entry, focused, canManage, onEdit, onDelete, onInquire }: CardProps) {
  const content = entry.content as Extract<Entry["content"], { steps: unknown[] }>;
  return (
    <article id={`knowledge-${entry.id}`} className={`knowledge-sop-card${focused ? " knowledge-focus" : ""}`}>
      <CardActions canManage={canManage} onEdit={onEdit} onDelete={onDelete} onInquire={onInquire} />
      <h4>{content.title}</h4>
      <p>{content.description}</p>
      <ol className="knowledge-sop-steps">
        {content.steps.map((step, index) => (
          <li key={`${step.step_title}-${index}`}>
            <strong>{step.step_title}</strong>
            <span>{step.step_description}</span>
          </li>
        ))}
      </ol>
      <small>
        {content.steps.length} steps{content.tags.length ? ` · ${content.tags.join(", ")}` : ""}
      </small>
    </article>
  );
}

function BestPracticeCard({ entry, focused, canManage, onEdit, onDelete, onInquire }: CardProps) {
  const content = entry.content as BestPractice & { source?: string };
  return (
    <article id={`knowledge-${entry.id}`} className={`knowledge-bp-card${focused ? " knowledge-focus" : ""}`}>
      <CardActions canManage={canManage} onEdit={onEdit} onDelete={onDelete} onInquire={onInquire} />
      <div className="knowledge-card-top">
        <h4>
          <span>◆</span>
          {content.title}
        </h4>
        <Priority priority={content.priority} />
      </div>
      <p>{content.description}</p>
      {content.source && <em>Source: {content.source}</em>}
    </article>
  );
}

function KpiCard({ entry, focused, canManage, onEdit, onDelete, onInquire }: CardProps) {
  const content = entry.content as Kpi;
  const metadata = content.metadata.flatMap((item) => Object.entries(item));
  return (
    <article id={`knowledge-${entry.id}`} className={`knowledge-kpi-card${focused ? " knowledge-focus" : ""}`}>
      <CardActions canManage={canManage} onEdit={onEdit} onDelete={onDelete} onInquire={onInquire} />
      <div className="knowledge-card-top">
        <h4>
          <span>◆</span>
          {content.title}
        </h4>
        <strong className="knowledge-target">{content.target_label}</strong>
      </div>
      <p>{content.description}</p>
      {metadata.length > 0 && (
        <div className="knowledge-metadata">
          {metadata.map(([key, value]) => (
            <span key={`${key}-${value}`}>
              <small>{key}</small>
              <b>{value}</b>
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

type CardProps = {
  entry: Entry;
  focused: boolean;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onInquire?: () => void;
};
function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="knowledge-add-button" type="button" onClick={onClick}>
      <Plus size={14} />
      {label}
    </button>
  );
}
function CardActions({ canManage, onEdit, onDelete, onInquire }: Omit<CardProps, "entry" | "focused">) {
  return canManage || onInquire ? (
    <div className="knowledge-card-actions">
      {onInquire && <InquiryButton label="this knowledge entry" onClick={onInquire} />}
      {canManage && (
        <>
          <button type="button" aria-label="Edit entry" onClick={onEdit}>
            <Edit3 size={13} />
          </button>
          <button type="button" aria-label="Delete entry" className="delete" onClick={onDelete}>
            <Trash2 size={13} />
          </button>
        </>
      )}
    </div>
  ) : null;
}

function KnowledgeEditor({
  type,
  entry,
  categoryId,
  onClose,
}: {
  type: KnowledgeType;
  entry?: Entry;
  categoryId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const content = entry?.content as Record<string, unknown> | undefined;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const defaultSteps = Array.isArray(content?.steps)
    ? content.steps
        .map(
          (step) =>
            `${(step as { step_title: string }).step_title}: ${(step as { step_description: string }).step_description}`,
        )
        .join("\n")
    : "";
  const defaultMetadata = Array.isArray(content?.metadata)
    ? content.metadata
        .flatMap((item) => Object.entries(item as Record<string, string>).map(([key, value]) => `${key}: ${value}`))
        .join("\n")
    : "";

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const base = { title: String(form.get("title")), description: String(form.get("description")) };
    const content =
      type === "SOP"
        ? {
            ...base,
            steps: String(form.get("steps"))
              .split("\n")
              .filter(Boolean)
              .map((line) => {
                const [step_title, ...description] = line.split(":");
                return { step_title: step_title.trim(), step_description: description.join(":").trim() };
              }),
            tags: String(form.get("tags"))
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean),
          }
        : type === "BEST_PRACTICE"
          ? { ...base, priority: String(form.get("priority")) }
          : {
              ...base,
              target_label: String(form.get("target_label")),
              metadata: String(form.get("metadata"))
                .split("\n")
                .filter(Boolean)
                .map((line) => {
                  const [key, ...value] = line.split(":");
                  return { [key.trim()]: value.join(":").trim() };
                }),
            };
    const response = await fetch(entry ? `/api/knowledge/${entry.id}` : "/api/knowledge", {
      method: entry ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, categoryId, content }),
    });
    if (!response.ok) {
      setError((await response.json()).error ?? "Could not save the entry.");
      setBusy(false);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <div className="knowledge-editor-backdrop" role="presentation">
      <form className="knowledge-editor" onSubmit={save}>
        <div className="knowledge-editor-header">
          <div>
            <span>
              {entry ? "Edit" : "New"} {type === "SOP" ? "SOP" : type === "KPI" ? "KPI" : "best practice"}
            </span>
            <h3>{entry ? "Update knowledge entry" : "Create knowledge entry"}</h3>
          </div>
          <button type="button" aria-label="Close editor" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <label>
          Title
          <input name="title" required defaultValue={String(content?.title ?? "")} />
        </label>
        <label>
          Description
          <textarea name="description" required defaultValue={String(content?.description ?? "")} />
        </label>
        {type === "SOP" && (
          <>
            <label>
              Steps <small>One per line: Title: description</small>
              <textarea name="steps" required defaultValue={defaultSteps} />
            </label>
            <label>
              Tags <small>Comma separated</small>
              <input name="tags" defaultValue={Array.isArray(content?.tags) ? content.tags.join(", ") : ""} />
            </label>
          </>
        )}
        {type === "BEST_PRACTICE" && (
          <label>
            Priority
            <select name="priority" defaultValue={String(content?.priority ?? "medium")}>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
        )}
        {type === "KPI" && (
          <>
            <label>
              Target label
              <input name="target_label" required defaultValue={String(content?.target_label ?? "")} />
            </label>
            <label>
              Metadata <small>One per line: Label: value</small>
              <textarea name="metadata" defaultValue={defaultMetadata} />
            </label>
          </>
        )}
        {error && <p className="knowledge-editor-error">{error}</p>}
        <div className="knowledge-editor-footer">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="knowledge-editor-save" disabled={busy}>
            {busy ? "Saving…" : "Save entry"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Priority({ priority }: { priority: string }) {
  return <span className={`knowledge-priority ${priority}`}>{priority}</span>;
}
function KnowledgeEmpty({ label }: { label: string }) {
  return <div className="knowledge-empty">{label}</div>;
}
