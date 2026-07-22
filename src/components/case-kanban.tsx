import { useNavigate } from "@tanstack/react-router";
import { Flag, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCaseName } from "@/lib/case-name";
import { caseStage, hasBill, hasInvoice, STAGES, type CaseRow } from "@/lib/case-stage";
import { cn } from "@/lib/utils";

type Row = CaseRow & {
  id: string;
  vehicles: { year: number | null; make: string | null; model: string | null; vin: string | null } | null;
  seller?: { display_name: string } | null;
  buyer?: { display_name: string } | null;
  txns?: { kind: string; is_paid: boolean }[];
};

export function CaseKanban({ rows }: { rows: Row[] }) {
  const navigate = useNavigate();
  const byStage = STAGES.map((s) => ({
    ...s,
    cards: rows.filter((r) => caseStage(r) === s.key),
  }));

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {byStage.map((col) => (
        <div key={col.key} className="w-64 shrink-0 flex flex-col">
          <div className="flex items-center gap-2 px-1 py-2">
            <span className={cn("h-2 w-2 rounded-full", col.color)} />
            <span className="text-sm font-medium">{col.label}</span>
            <span className="text-xs text-muted-foreground ml-auto tabular-nums">{col.cards.length}</span>
          </div>
          <div className="flex-1 space-y-2 min-h-8">
            {col.cards.map((c) => {
              const openBill = (c.txns ?? []).some((t) => t.kind === "bill" && !t.is_paid);
              const openInvoice = (c.txns ?? []).some((t) => t.kind === "invoice" && !t.is_paid);
              return (
                <button
                  key={c.id}
                  onClick={() => navigate({ to: "/cases/$caseId", params: { caseId: c.id } })}
                  className="w-full text-left rounded-lg border bg-background p-3 shadow-sm hover:border-primary/50 hover:shadow transition-all"
                >
                  <div className="flex items-start gap-1.5 mb-1">
                    {c.needs_attention && <Flag className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />}
                    <span className="text-sm font-medium leading-tight">{formatCaseName(c.vehicles)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mb-2">
                    {c.buyer?.display_name ?? c.seller?.display_name ?? "No contact yet"}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {openBill && (
                      <Badge variant="outline" className="text-[10px] border-orange-500 text-orange-700">
                        <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                        Pay seller
                      </Badge>
                    )}
                    {openInvoice && (
                      <Badge variant="outline" className="text-[10px] border-orange-500 text-orange-700">
                        <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                        Collect
                      </Badge>
                    )}
                  </div>
                </button>
              );
            })}
            {col.cards.length === 0 && (
              <div className="text-xs text-muted-foreground/60 px-1 py-6 text-center border border-dashed rounded-lg">
                Empty
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
