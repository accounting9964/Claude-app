// A case's pipeline stage is *derived*, not stored — it comes from the same
// underlying flags the old filter bar used. Keeping this in one place means
// the board view, the table view, and the case detail page can never disagree
// about what stage a case is in.

export type CaseRow = {
  is_purchased: boolean;
  qbo_bill_id: string | null;
  qbo_bill_deleted_at: string | null;
  buyer_id: string | null;
  listed_on_marketplace: boolean;
  qbo_invoice_id: string | null;
  qbo_invoice_deleted_at: string | null;
  is_sold: boolean;
  sale_is_final: boolean;
  needs_attention: boolean;
  status: string;
  archived_at: string | null;
};

export type Stage =
  | "not_purchased"
  | "purchased"
  | "listed"
  | "with_buyer"
  | "sold_pending"
  | "sold_final"
  | "closed";

export const STAGES: { key: Stage; label: string; color: string }[] = [
  { key: "not_purchased", label: "Not purchased", color: "bg-muted-foreground" },
  { key: "purchased", label: "Purchased", color: "bg-chart-2" },
  { key: "listed", label: "Listed", color: "bg-chart-4" },
  { key: "with_buyer", label: "With a buyer", color: "bg-chart-3" },
  { key: "sold_pending", label: "Sold — non-final", color: "bg-yellow-500" },
  { key: "sold_final", label: "Sold — final", color: "bg-green-600" },
  { key: "closed", label: "Closed", color: "bg-foreground" },
];

export function hasBill(c: CaseRow) {
  return !!c.qbo_bill_id && !c.qbo_bill_deleted_at;
}
export function hasInvoice(c: CaseRow) {
  return !!c.qbo_invoice_id && !c.qbo_invoice_deleted_at;
}

export function caseStage(c: CaseRow): Stage {
  if (c.status === "closed" || c.archived_at) return "closed";
  if (hasInvoice(c) && c.sale_is_final) return "sold_final";
  if (hasInvoice(c) || c.is_sold) return "sold_pending";
  if (c.buyer_id) return "with_buyer";
  if (c.listed_on_marketplace) return "listed";
  if (hasBill(c) || c.is_purchased) return "purchased";
  return "not_purchased";
}
