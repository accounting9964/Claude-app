import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Car, TrendingDown, TrendingUp, Flag } from "lucide-react";
import { formatCaseName } from "@/lib/case-name";

export const Route = createFileRoute("/_app/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Dealership Manager" },
      { name: "description", content: "Overview of cases, payables and receivables." },
    ],
  }),
  component: Dashboard,
});

const money = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });

function Dashboard() {
  const { data } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [cases, txns, attention] = await Promise.all([
        supabase.from("cases").select("id,status", { count: "exact" }).is("archived_at", null),
        supabase.from("case_transactions").select("kind,amount,amount_paid,is_paid"),
        supabase
          .from("cases")
          .select("id, needs_attention, attention_note, vehicles(year,make,model,vin)")
          .eq("needs_attention", true)
          .is("archived_at", null)
          .limit(5),
      ]);
      const openCases = (cases.data ?? []).filter((c) => c.status !== "closed").length;
      let payable = 0, receivable = 0;
      for (const t of txns.data ?? []) {
        const outstanding = Number(t.amount) - Number(t.amount_paid);
        if (t.is_paid) continue;
        if (t.kind === "bill") payable += outstanding;
        else receivable += outstanding;
      }
      return { openCases, totalCases: cases.count ?? 0, payable, receivable, attention: attention.data ?? [] };
    },
  });

  const stats = [
    { label: "Open cases", value: data?.openCases ?? 0, sub: `${data?.totalCases ?? 0} active`, icon: Car, to: "/cases" as const },
    { label: "Total payable to sellers", value: money(data?.payable ?? 0), sub: "Unpaid bills", icon: TrendingDown, to: "/finance" as const },
    { label: "Total receivable from buyers", value: money(data?.receivable ?? 0), sub: "Unpaid invoices", icon: TrendingUp, to: "/finance" as const },
  ];

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Live view of your dealership operations.</p>
      </header>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.label} to={s.to} className="block">
              <Card className="cursor-pointer transition-colors hover:bg-muted/40 hover:border-primary/40">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{s.value}</div>
                  <CardDescription>{s.sub}</CardDescription>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {!!data?.attention.length && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Flag className="h-4 w-4 text-destructive" /> Needs attention
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.attention.map((c: any) => (
              <Link
                key={c.id}
                to="/cases/$caseId"
                params={{ caseId: c.id }}
                className="flex items-center justify-between p-2 rounded-md hover:bg-muted/60 text-sm"
              >
                <span className="font-medium">{formatCaseName(c.vehicles)}</span>
                <span className="text-muted-foreground truncate max-w-xs">{c.attention_note}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
