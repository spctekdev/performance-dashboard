import { Mail } from "lucide-react";

export type InquiryReference = {
  type: "GOAL" | "JOURNAL_ENTRY" | "KPI_DEFINITION" | "KPI_PERFORMANCE" | "KNOWLEDGE";
  id: string;
};

export function InquiryButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="entity-inquiry-button"
      onClick={onClick}
      aria-label={`Inquire about ${label}`}
      title={`Inquire about ${label}`}
    >
      <Mail size={14} />
    </button>
  );
}
