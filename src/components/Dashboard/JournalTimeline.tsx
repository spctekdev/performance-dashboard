import { Pencil, Trash2 } from "lucide-react";
import { InquiryButton } from "./InquiryButton";
type Entry = {
  id: string;
  description: string;
  category: "GOOD" | "BAD" | "NOTE";
  impact: number;
  period: string;
  createdAt: string;
};
export function JournalTimeline({
  entries,
  category,
  onEdit,
  onDelete,
  onInquire,
}: {
  entries: Entry[];
  category?: "GOOD" | "BAD" | "NOTE";
  onEdit?: (entry: Entry) => void;
  onDelete?: (entry: Entry) => void;
  onInquire?: (entry: Entry) => void;
}) {
  const rows = category ? entries.filter((e) => e.category === category) : entries;
  if (!rows.length)
    return (
      <div className="empty-state">
        <span>{category === "BAD" ? "🌱" : "🏆"}</span>
        <h3>Nothing recorded yet</h3>
        <p>Monthly reflections will appear here.</p>
      </div>
    );
  return (
    <div className="timeline">
      {rows.map((entry) => {
        const impact = impactLabel(entry.impact);
        const period = new Date(`${entry.period}T00:00:00Z`);
        return (
          <article className={`timeline-item ${entry.category.toLowerCase()}`} key={entry.id}>
            <div className="timeline-date">
              <time>{period.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })}</time>
            </div>
            <div className="timeline-content">
              <div className="timeline-meta">
                <span className="entry-type-badge">
                  {entry.category === "GOOD" ? "Achievement" : entry.category === "BAD" ? "Challenge" : "Note"}
                </span>
              </div>
              <p>{entry.description}</p>
              <div className="entry-badges">
                <span className={`impact-badge ${impact.toLowerCase()}`}>Impact: {impact}</span>
              </div>
            </div>
            {(onInquire || (onEdit && onDelete)) && (
              <div className="timeline-actions">
                {onInquire && <InquiryButton label="this journal entry" onClick={() => onInquire(entry)} />}
                {onEdit && onDelete && (
                  <>
                    <button type="button" onClick={() => onEdit(entry)}>
                      <Pencil size={13} /> Edit
                    </button>
                    <button type="button" onClick={() => onDelete(entry)}>
                      <Trash2 size={13} /> Delete
                    </button>
                  </>
                )}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

function impactLabel(impact: number) {
  if (impact >= 99) return "High";
  if (impact >= 66) return "Medium";
  return "Low";
}
