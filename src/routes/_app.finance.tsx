import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCaseName } from "@/lib/case-name";

export const Route = createFileRoute("/_app/finance")({
  head: () => ({
    meta: [
      { title: "Finance — Dealership Manager" },
      { name: "description", content: "Payables to sellers and receivables from buyers." },
    ],
  }),
  component: FinancePage,
});

const money = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });

type Txn = {
  id: string; kind: "bill" | "invoice"; amount: number; amount_paid: number;
  is_paid: boolean; due_date: string | null; qbo_doc_number: string | null;
  case_id: string; cases: {
    case_number: string | null;
    vehicle_id: string | null;
    vehicles: { model: string | null; year: number | null; vin: string | null } | null;
  } | null;
};

function FinancePage() {
  const { data } = useQuery({
    queryKey: ["txns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_transactions")
        .select("*, cases(case_number, vehicle_id, vehicles(model, year, vin))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Txn[];
    },
  });

  const bills = (data ?? []).filter((t) => t.kind === "bill");
  const invoices = (data ?? []).filter((t) => t.kind === "invoice");
  const totalPayable = bills.filter((t) => !t.is_paid).reduce((s, t) => s + (Number(t.amount) - Number(t.amount_paid)), 0);
  const totalReceivable = invoices.filter((t) => !t.is_paid).reduce((s, t) => s + (Number(t.amount) - Number(t.amount_paid)), 0);

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Finance</h1>
        <p className="text-sm text-muted-foreground">Bills owed to sellers and invoices owed by buyers. Paid status syncs from QuickBooks.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Total payable to sellers</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{money(totalPayable)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Total receivable from buyers</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{money(totalReceivable)}</div></CardContent>
        </Card>
      </div>

      <TxnTable title="Bills (payable to sellers)" rows={bills} />
      <TxnTable title="Invoices (receivable from buyers)" rows={invoices} />
    </div>
  );
}

function TxnTable({ title, rows }: { title: string; rows: Txn[] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Case</TableHead>
              <TableHead>QBO Doc #</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead>Outstanding</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No records yet.</TableCell></TableRow>}
            {rows.map((t) => {
              const out = Number(t.amount) - Number(t.amount_paid);
              return (
              <TableRow key={t.id}>
                  <TableCell className="font-medium text-sm">{formatCaseName(t.cases?.vehicles ?? null)}</TableCell>
                  <TableCell className="text-sm">{t.qbo_doc_number ?? "—"}</TableCell>
                  <TableCell>{money(Number(t.amount))}</TableCell>
                  <TableCell>{money(Number(t.amount_paid))}</TableCell>
                  <TableCell>{money(out)}</TableCell>
                  <TableCell className="text-sm">{t.due_date ?? "—"}</TableCell>
                  <TableCell><Badge variant={t.is_paid ? "secondary" : "outline"}>{t.is_paid ? "Paid" : "Open"}</Badge></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
