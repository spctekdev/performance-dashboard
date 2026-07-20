"use client";
import { ResponsiveContainer, Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis, Bar, BarChart } from "recharts";
export function PerformanceChart({ data }: { data: { period: string; score: number; target: number }[] }) {
  if (!data.length) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={230}>
      <AreaChart data={data} margin={{ top: 12, right: 8, left: -25, bottom: 0 }}>
        <defs>
          <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f43f8f" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#f43f8f" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef0f6" />
        <XAxis dataKey="period" tick={{ fontSize: 11 }} axisLine={false} />
        <YAxis domain={[0, 120]} tick={{ fontSize: 11 }} axisLine={false} />
        <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e2e5ef" }} />
        <Area type="monotone" dataKey="score" stroke="#f43f8f" strokeWidth={3} fill="url(#scoreFill)" />
        <Area type="monotone" dataKey="target" stroke="#a78bfa" strokeDasharray="6 5" fill="none" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
export function KpiBarChart({ data }: { data: { name: string; score: number }[] }) {
  if (!data.length) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 10, right: 5, left: -25, bottom: 24 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0f6" />
        <XAxis dataKey="name" tick={{ fontSize: 10 }} textAnchor="middle" interval={0} />
        <YAxis domain={[0, 120]} tick={{ fontSize: 11 }} />
        <Tooltip cursor={{ fill: "#f8f9fc" }} contentStyle={{ borderRadius: 10 }} />
        <Bar dataKey="score" fill="#4f46e5" radius={[7, 7, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
function EmptyChart() {
  return (
    <div className="empty-chart">
      <span>↗</span>
      <p>Add monthly KPI results to reveal your trend.</p>
    </div>
  );
}
