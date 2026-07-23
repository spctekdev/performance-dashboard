"use client";

import { FormEvent, useState } from "react";
import { ArrowDown, ArrowUp, LoaderCircle, Plus, Tag, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { DashboardData } from "@/lib/dashboard";

type Entry = DashboardData["knowledge"][number];
type SopStep = { step_title: string; step_description: string };
type SopContent = { title: string; description: string; steps: SopStep[]; tags: string[] };

export function SopEditor({ entry, categoryId, onClose }: { entry?: Entry; categoryId: string; onClose: () => void }) {
  const router = useRouter();
  const content = entry?.content as Partial<SopContent> | undefined;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [steps, setSteps] = useState<SopStep[]>(() =>
    content?.steps?.length
      ? content.steps.map((step) => ({
          step_title: String(step.step_title ?? ""),
          step_description: String(step.step_description ?? ""),
        }))
      : [{ step_title: "", step_description: "" }],
  );
  const [tags, setTags] = useState<string[]>(() => {
    const unique = new Map<string, string>();
    for (const tag of content?.tags ?? []) {
      const trimmed = String(tag).trim();
      if (trimmed) unique.set(trimmed.toLowerCase(), trimmed);
    }
    return [...unique.values()];
  });
  const [tagDraft, setTagDraft] = useState("");

  function updateStep(index: number, key: keyof SopStep, value: string) {
    setSteps((current) => current.map((step, stepIndex) => (stepIndex === index ? { ...step, [key]: value } : step)));
  }

  function moveStep(index: number, direction: -1 | 1) {
    setSteps((current) => {
      const destination = index + direction;
      if (destination < 0 || destination >= current.length) return current;
      const next = [...current];
      [next[index], next[destination]] = [next[destination], next[index]];
      return next;
    });
  }

  function addTag() {
    const nextTag = tagDraft.trim();
    if (!nextTag) return;
    if (nextTag.length > 80) return setError("Tags cannot exceed 80 characters.");
    if (tags.length >= 50) return setError("An SOP can have at most 50 tags.");
    if (!tags.some((tag) => tag.toLowerCase() === nextTag.toLowerCase())) setTags((current) => [...current, nextTag]);
    setTagDraft("");
    setError("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const cleanedSteps = steps.map((step) => ({
      step_title: step.step_title.trim(),
      step_description: step.step_description.trim(),
    }));
    if (cleanedSteps.some((step) => !step.step_title || !step.step_description))
      return setError("Every step needs both a title and a description.");

    const submittedTags = [...tags];
    const pendingTag = tagDraft.trim();
    if (pendingTag.length > 80) return setError("Tags cannot exceed 80 characters.");
    if (pendingTag && !submittedTags.some((tag) => tag.toLowerCase() === pendingTag.toLowerCase()))
      submittedTags.push(pendingTag);
    if (submittedTags.length > 50) return setError("An SOP can have at most 50 tags.");

    const payload = {
      type: "SOP" as const,
      categoryId,
      content: {
        title: String(form.get("title") ?? "").trim(),
        description: String(form.get("description") ?? "").trim(),
        steps: cleanedSteps,
        tags: submittedTags,
      },
    };

    setBusy(true);
    setError("");
    try {
      const response = await fetch(entry ? `/api/knowledge/${entry.id}` : "/api/knowledge", {
        method: entry ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await response.json()) as { data?: { id?: string }; error?: string };
      if (!response.ok) return setError(json.error ?? "Could not save the SOP.");
      if (!json.data?.id) return setError("The server did not return the saved SOP.");
      router.refresh();
      onClose();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="knowledge-editor-backdrop" role="presentation">
      <form
        className="knowledge-editor knowledge-editor-sop"
        onSubmit={save}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sop-editor-title"
      >
        <header className="knowledge-editor-header">
          <div>
            <span>{entry ? "Edit SOP" : "New SOP"}</span>
            <h3 id="sop-editor-title">{entry ? "Update standard operating procedure" : "Create an SOP"}</h3>
            <p>Build a reusable procedure with clearly separated steps and searchable tags.</p>
          </div>
          <button type="button" aria-label="Close SOP editor" disabled={busy} onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="knowledge-editor-body">
          <section className="knowledge-editor-section">
            <SectionHeading eyebrow="Basic information" title="Name and describe the procedure" />
            <div className="knowledge-editor-basics">
              <label>
                SOP title
                <input
                  name="title"
                  required
                  minLength={2}
                  maxLength={160}
                  autoFocus={!entry}
                  placeholder="e.g. Industry Update Email SOP"
                  defaultValue={content?.title ?? ""}
                />
              </label>
              <label>
                Description
                <textarea
                  name="description"
                  required
                  minLength={3}
                  maxLength={10000}
                  placeholder="Explain when this SOP should be used and what it accomplishes."
                  defaultValue={content?.description ?? ""}
                />
              </label>
            </div>
          </section>

          <section className="knowledge-editor-section">
            <div className="knowledge-editor-section-heading">
              <div>
                <span>Procedure</span>
                <h4>Steps</h4>
                <p>Each step needs a short action title and clear instructions.</p>
              </div>
              <button
                className="knowledge-step-add"
                type="button"
                onClick={() => setSteps((current) => [...current, { step_title: "", step_description: "" }])}
              >
                <Plus size={14} /> Add step
              </button>
            </div>
            <div className="knowledge-step-list">
              {steps.map((step, index) => (
                <article className="knowledge-step-editor" key={index}>
                  <div className="knowledge-step-heading">
                    <div className="knowledge-step-identity">
                      <span className="knowledge-step-number" aria-hidden="true">
                        {index + 1}
                      </span>
                      <strong>Step {index + 1}</strong>
                    </div>
                    <div className="knowledge-step-actions">
                      <button
                        type="button"
                        disabled={index === 0}
                        aria-label={`Move step ${index + 1} up`}
                        onClick={() => moveStep(index, -1)}
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        disabled={index === steps.length - 1}
                        aria-label={`Move step ${index + 1} down`}
                        onClick={() => moveStep(index, 1)}
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        type="button"
                        className="delete"
                        disabled={steps.length === 1}
                        aria-label={`Remove step ${index + 1}`}
                        onClick={() => setSteps((current) => current.filter((_, stepIndex) => stepIndex !== index))}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <label>
                    Step title
                    <input
                      required
                      maxLength={160}
                      value={step.step_title}
                      onChange={(event) => updateStep(index, "step_title", event.target.value)}
                      placeholder="e.g. Research the industry update"
                    />
                  </label>
                  <label>
                    Step description
                    <textarea
                      required
                      maxLength={5000}
                      value={step.step_description}
                      onChange={(event) => updateStep(index, "step_description", event.target.value)}
                      placeholder="Describe the action, expected result, and checks required."
                    />
                  </label>
                </article>
              ))}
            </div>
          </section>

          <section className="knowledge-editor-section">
            <SectionHeading
              eyebrow="Organization"
              title="Tags"
              description="Add searchable labels that help employees find this SOP."
            />
            <div className="knowledge-tag-input">
              <Tag size={15} aria-hidden="true" />
              <input
                value={tagDraft}
                maxLength={80}
                placeholder="Type a tag and press Enter"
                aria-label="New SOP tag"
                onChange={(event) => setTagDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === ",") {
                    event.preventDefault();
                    addTag();
                  }
                }}
              />
              <button type="button" onClick={addTag} disabled={!tagDraft.trim()}>
                Add tag
              </button>
            </div>
            {tags.length ? (
              <div className="knowledge-tag-list" aria-label="SOP tags">
                {tags.map((tag) => (
                  <span key={tag}>
                    {tag}
                    <button
                      type="button"
                      aria-label={`Remove ${tag} tag`}
                      onClick={() => setTags((current) => current.filter((item) => item !== tag))}
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <small className="knowledge-tag-empty">No tags added yet.</small>
            )}
          </section>
        </div>

        <footer className="knowledge-editor-footer">
          <div aria-live="polite">{error ? <p className="knowledge-editor-error">{error}</p> : null}</div>
          <div>
            <button type="button" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="knowledge-editor-save" disabled={busy}>
              {busy ? <LoaderCircle className="spin" size={14} /> : null}
              {busy ? "Saving…" : entry ? "Save changes" : "Create SOP"}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <div className="knowledge-editor-section-heading">
      <div>
        <span>{eyebrow}</span>
        <h4>{title}</h4>
        {description ? <p>{description}</p> : null}
      </div>
    </div>
  );
}
