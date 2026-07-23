import { requireUser } from "@/lib/auth/session";
import { getDashboardData } from "@/lib/dashboard";
import { DashboardShell } from "@/components/Dashboard/DashboardShell";

export const dynamic = "force-dynamic";
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; inquiry?: string; knowledge?: string }>;
}) {
  const actor = await requireUser();
  const data = await getDashboardData(actor);
  const query = await searchParams;
  return (
    <DashboardShell
      data={data}
      initialTab={query.tab === "inquiries" ? "inquiries" : query.tab === "knowledge" ? "knowledge" : undefined}
      initialInquiryId={query.inquiry}
      initialKnowledgeId={query.knowledge}
    />
  );
}
