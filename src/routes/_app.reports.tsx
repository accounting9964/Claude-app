import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_app/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Dealership Manager" },
      { name: "description", content: "Reports of cases by model, seller and buyer." },
    ],
  }),
  component: ReportsPage,
});

const money = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });

type CaseRow = {
  id: string; status: string;
  purchase_total: number | null; sale_total: number | null;
  purchase_price: number | null; sale_price: number | null;
  purchase_date: string | null; sale_date: string | null;
  seller_id: string | null; buyer_id: string | null;
  vehicles: { model: string | null } | null;
  seller: { display_name: string } | null;
  buyer: { display_name: string } | null;
  txns: { kind: string; amount: number; amount_paid: number; is_paid: boolean }[];
};

function ReportsPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [openOnly, setOpenOnly] = useState(false);

  const { data } = useQuery({
    queryKey: ["report-cases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("id,status,purchase_total,sale_total,purchase_price,sale_price,purchase_date,sale_date,seller_id,buyer_id,vehicles(model),seller:contacts!cases_seller_id_fkey(display_name),buyer:contacts!cases_buyer_id_fkey(display_name),txns:case_transactions(kind,amount,amount_paid,is_paid)");
      if (error) throw error;
      return data as unknown as CaseRow[];
    },
  });

  const rows = useMemo(() => {
    let out = data ?? [];
    if (openOnly) out = out.filter((c) => c.status !== "closed");
    if (from) out = out.filter((c) => (c.purchase_date ?? "") >= from || (c.sale_date ?? "") >= from);
    if (to) out = out.filter((c) => (c.purchase_date ?? "9999") <= to || (c.sale_date ?? "9999") <= to);
    return out;
  }, [data, from, to, openOnly]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-muted-foreground">Aggregate cases by model, seller, or buyer.</p>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Filters</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-4 items-end">
          <div className="space-y-1"><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="space-y-1"><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} />
            Exclude closed cases
          </label>
        </CardContent>
      </Card>

      <Tabs defaultValue="model">
        <TabsList>
          <TabsTrigger value="model">By model</TabsTrigger>
          <TabsTrigger value="seller">By seller</TabsTrigger>
          <TabsTrigger value="buyer">By buyer</TabsTrigger>
        </TabsList>
        <TabsContent value="model"><ByModel rows={rows} /></TabsContent>
        <TabsContent value="seller"><BySeller rows={rows} /></TabsContent>
        <TabsContent value="buyer"><ByBuyer rows={rows} /></TabsContent>
      </Tabs>
    </div>
  );
}

function exportCsv(name: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `${name}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function ByModel({ rows }: { rows: CaseRow[] }) {
  const grouped = useMemo(() => {
    const m = new Map<string, { count: number; purchase: number; sale: number }>();
    for (const c of rows) {
      const key = c.vehicles?.model ?? "—";
      const g = m.get(key) ?? { count: 0, purchase: 0, sale: 0 };
      g.count++;
      g.purchase += Number(c.purchase_total ?? c.purchase_price ?? 0);
      g.sale += Number(c.sale_total ?? c.sale_price ?? 0);
      m.set(key, g);
    }
    return [...m.entries()].map(([k, v]) => ({ key: k, ...v, margin: v.sale - v.purchase })).sort((a, b) => b.count - a.count);
  }, [rows]);
  return (
    <ReportTable
      name="by-model" headers={["Model", "Cases", "Purchases", "Sales", "Margin"]}
      rows={grouped.map((r) => [r.key, r.count, money(r.purchase), money(r.sale), money(r.margin)])}
    />
  );
}

function BySeller({ rows }: { rows: CaseRow[] }) {
  const grouped = useMemo(() => {
    const m = new Map<string, { count: number; billed: number; paid: number }>();
    for (const c of rows) {
      const key = c.seller?.display_name ?? "—";
      const g = m.get(key) ?? { count: 0, billed: 0, paid: 0 };
      g.count++;
      for (const t of c.txns) if (t.kind === "bill") { g.billed += Number(t.amount); g.paid += Number(t.amount_paid); }
      m.set(key, g);
    }
    return [...m.entries()].map(([k, v]) => ({ key: k, ...v, open: v.billed - v.paid })).sort((a, b) => b.count - a.count);
  }, [rows]);
  return (
    <ReportTable
      name="by-seller" headers={["Seller", "Cases", "Billed", "Paid", "Outstanding"]}
      rows={grouped.map((r) => [r.key, r.count, money(r.billed), money(r.paid), money(r.open)])}
    />
  );
}

function ByBuyer({ rows }: { rows: CaseRow[] }) {
  const grouped = useMemo(() => {
    const m = new Map<string, { count: number; invoiced: number; collected: number }>();
    for (const c of rows) {
      const key = c.buyer?.display_name ?? "—";
      const g = m.get(key) ?? { count: 0, invoiced: 0, collected: 0 };
      g.count++;
      for (const t of c.txns) if (t.kind === "invoice") { g.invoiced += Number(t.amount); g.collected += Number(t.amount_paid); }
      m.set(key, g);
    }
    return [...m.entries()].map(([k, v]) => ({ key: k, ...v, open: v.invoiced - v.collected })).sort((a, b) => b.count - a.count);
  }, [rows]);
  return (
    <ReportTable
      name="by-buyer" headers={["Buyer", "Cases", "Invoiced", "Collected", "Outstanding"]}
      rows={grouped.map((r) => [r.key, r.count, money(r.invoiced), money(r.collected), money(r.open)])}
    />
  );
}

function ReportTable({ name, headers, rows }: { name: string; headers: string[]; rows: (string | number)[][] }) {
  return (
    <Card className="mt-4">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base">{rows.length} row{rows.length === 1 ? "" : "s"}</CardTitle>
        <Button variant="outline" size="sm" onClick={() => exportCsv(name, headers, rows)}>
          <Download className="h-4 w-4 mr-1" /> Export CSV
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>{headers.map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={headers.length} className="text-center py-8 text-muted-foreground">No data.</TableCell></TableRow>}
            {rows.map((r, i) => (
              <TableRow key={i}>{r.map((v, j) => <TableCell key={j}>{v}</TableCell>)}</TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
