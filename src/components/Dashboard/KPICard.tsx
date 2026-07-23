import { InquiryButton } from "./InquiryButton";

export function KPICard({
  name,
  unit,
  current,
  target,
  onInquire,
}: {
  name: string;
  unit: string | null;
  current: number;
  target: number;
  onInquire?: () => void;
}) {
  const progress = target ? Math.min(150, (current / target) * 100) : 0;
  const status = progress >= 100 ? "On target" : progress >= 75 ? "In progress" : "Needs focus";
  return (
    <article className="kpi-item">
      <div className="kpi-top">
        <div>
          <span className="kpi-name">{name}</span>
        </div>
        <div className="kpi-card-actions">
          <span className={`status-pill ${progress >= 100 ? "great" : progress >= 75 ? "good" : "low"}`}>{status}</span>
          {onInquire && <InquiryButton label={name} onClick={onInquire} />}
        </div>
      </div>
      <div className="kpi-numbers">
        <strong>{current.toLocaleString()}</strong>
        <span>/ {target.toLocaleString() + " " + unit}</span>
      </div>
      <div className="progress-bar">
        <span style={{ width: `${Math.min(100, progress)}%` }} />
      </div>
      <small>{Math.round(progress)}% of monthly target</small>
    </article>
  );
}
