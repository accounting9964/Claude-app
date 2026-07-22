import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Flag, AlertTriangle, LayoutGrid, List, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { formatCaseName } from "@/lib/case-name";
import { cn } from "@/lib/utils";
import { CaseKanban } from "@/components/case-kanban";
import { STAGES, caseStage, hasBill, hasInvoice, type CaseRow } from "@/lib/case-stage";

const searchSchema = z.object({
  view: z.enum(["board", "table"]).catch("board").default("board"),
  q: z.string().catch("").default(""),
  stage: z.string().catch("").default(""),
  attention: z.boolean().catch(false).default(false),
});

export const Route = createFileRoute("/_app/cases/")({
  head: () => ({
    meta: [
      { title: "Cases — Dealership Manager" },
      { name: "description", content: "Track each vehicle purchase and sale from draft to closed." },
    ],
  }),
  validateSearch: searchSchema,
  component: CasesPage,
});

function CasesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [creating, setCreating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["cases-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select(
          "*, vehicles(year,make,model,vin), seller:contacts!cases_seller_id_fkey(display_name), buyer:contacts!cases_buyer_id_fkey(display_name), txns:case_transactions(kind,is_paid)"
        )
        .is("archived_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const filtered = useMemo(() => {
    let rows = data ?? [];
    if (search.attention) rows = rows.filter((r) => r.needs_attention);
    if (search.stage) rows = rows.filter((r) => caseStage(r as CaseRow) === search.stage);
    if (search.q.trim()) {
      const q = search.q.trim().toLowerCase();
      rows = rows.filter((r) => {
        const hay = [
          formatCaseName(r.vehicles),
          r.vehicles?.vin,
          r.seller?.display_name,
          r.buyer?.display_name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    return rows;
  }, [data, search.q, search.stage, search.attention]);

  const stageCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of STAGES) c[s.key] = 0;
    for (const row of data ?? []) c[caseStage(row as CaseRow)]++;
    return c;
  }, [data]);

  async function createBlankCase() {
    setCreating(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id ?? null;
      const { data: v, error: ve } = await supabase.from("vehicles").insert({ created_by: uid }).select("id").single();
      if (ve) throw ve;
      const { data: caseRow, error: ce } = await supabase
        .from("cases")
        .insert({ vehicle_id: v.id, status: "draft", created_by: uid })
        .select("id")
        .single();
      if (ce) throw ce;
      qc.invalidateQueries({ queryKey: ["cases-list"] });
      navigate({ to: "/cases/$caseId", params: { caseId: caseRow.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create case");
      setCreating(false);
    }
  }

  function setSearch(patch: Partial<typeof search>) {
    navigate({ to: "/cases", search: { ...search, ...patch }, replace: true });
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Cases</h1>
          <p className="text-sm text-muted-foreground">One case per vehicle: from purchase to sale.</p>
        </div>
        <Button onClick={createBlankCase} disabled={creating}>
          <Plus className="h-4 w-4 mr-1" /> {creating ? "Creating…" : "New case"}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-52 max-w-sm">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by vehicle, VIN, buyer, seller…"
            value={search.q}
            onChange={(e) => setSearch({ q: e.target.value })}
            className="pl-8"
          />
        </div>
        <button
          onClick={() => setSearch({ attention: !search.attention })}
          className={cn(
            "text-xs px-2.5 py-1.5 rounded-full border transition-colors flex items-center gap-1",
            search.attention ? "bg-destructive text-destructive-foreground border-destructive" : "bg-background hover:bg-accent"
          )}
        >
          <Flag className="h-3 w-3" /> Needs attention
        </button>
        <div className="ml-auto flex items-center border rounded-md overflow-hidden">
          <button
            onClick={() => setSearch({ view: "board" })}
            className={cn("px-2.5 py-1.5 flex items-center gap-1 text-xs", search.view === "board" ? "bg-primary text-primary-foreground" : "hover:bg-accent")}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Board
          </button>
          <button
            onClick={() => setSearch({ view: "table" })}
            className={cn("px-2.5 py-1.5 flex items-center gap-1 text-xs", search.view === "table" ? "bg-primary text-primary-foreground" : "hover:bg-accent")}
          >
            <List className="h-3.5 w-3.5" /> Table
          </button>
        </div>
      </div>

      {search.view === "table" && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSearch({ stage: "" })}
            className={cn("text-xs px-2.5 py-1 rounded-full border", !search.stage ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent")}
          >
            All <span className="ml-1 opacity-90 tabular-nums">{data?.length ?? 0}</span>
          </button>
          {STAGES.map((s) => (
            <button
              key={s.key}
              onClick={() => setSearch({ stage: search.stage === s.key ? "" : s.key })}
              className={cn(
                "text-xs px-2.5 py-1 rounded-full border",
                search.stage === s.key ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent"
              )}
            >
              {s.label} <span className="ml-1 opacity-90 tabular-nums">{stageCounts[s.key]}</span>
            </button>
          ))}
        </div>
      )}

      {isLoading && <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>}

      {!isLoading && search.view === "board" && <CaseKanban rows={filtered as any} />}

      {!isLoading && search.view === "table" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{filtered.length} case{filtered.length === 1 ? "" : "s"}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Case</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>VIN</TableHead>
                  <TableHead>Seller</TableHead>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Purchase</TableHead>
                  <TableHead>Sale</TableHead>
                  <TableHead>Flags</TableHead>
                  <TableHead>Stage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      No cases match.
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((c) => {
                  const openBill = (c.txns ?? []).some((t: any) => t.kind === "bill" && !t.is_paid);
                  const openInvoice = (c.txns ?? []).some((t: any) => t.kind === "invoice" && !t.is_paid);
                  const stage = STAGES.find((s) => s.key === caseStage(c));
                  return (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate({ to: "/cases/$caseId", params: { caseId: c.id } })}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1.5">
                          {c.needs_attention && <Flag className="h-3.5 w-3.5 text-destructive" />}
                          {formatCaseName(c.vehicles)}
                        </div>
                      </TableCell>
                      <TableCell>{c.vehicles ? [c.vehicles.year, c.vehicles.make, c.vehicles.model].filter(Boolean).join(" ") : "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{c.vehicles?.vin ?? "—"}</TableCell>
                      <TableCell>{c.seller?.display_name ?? "—"}</TableCell>
                      <TableCell>{c.buyer?.display_name ?? "—"}</TableCell>
                      <TableCell className="text-sm">
                        {c.purchase_total ?? c.purchase_price ? `$${Number(c.purchase_total ?? c.purchase_price).toLocaleString()}` : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {c.sale_total ?? c.sale_price ? `$${Number(c.sale_total ?? c.sale_price).toLocaleString()}` : "—"}
                      </TableCell>
                      <TableCell className="space-x-1">
                        {openBill && (
                          <Badge variant="outline" className="border-orange-500 text-orange-700">
                            <AlertTriangle className="h-3 w-3 mr-0.5" />
                            Pay seller
                          </Badge>
                        )}
                        {openInvoice && (
                          <Badge variant="outline" className="border-orange-500 text-orange-700">
                            <AlertTriangle className="h-3 w-3 mr-0.5" />
                            Collect
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {stage?.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
