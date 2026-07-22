import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Trash2, Archive, FileText, Download, Flag, ExternalLink, RefreshCw, AlertTriangle, CheckCircle2, Car, ArrowDownLeft, ArrowUpRight, Tag, ClipboardList, FolderOpen, MessageSquare } from "lucide-react";
import { ensureCaseDriveFolder } from "@/lib/gdrive.functions";
import { ActivityTimeline, logCaseActivity } from "@/components/activity-timeline";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { formatCaseName } from "@/lib/case-name";
import { useServerFn } from "@tanstack/react-start";
import {
  syncCasePurchaseToQbo,
  syncCaseSaleToQbo,
  checkQboBillStatus,
  checkQboInvoiceStatus,
  getQboEnvironment,
  deleteCaseFully,
} from "@/lib/qbo/qbo.functions";

export const Route = createFileRoute("/_app/cases/$caseId")({
  head: () => ({ meta: [{ title: "Case — Dealership Manager" }] }),
  component: CaseDetailPage,
  errorComponent: ({ error }) => <div className="p-6 text-destructive">Failed to load: {error.message}</div>,
  notFoundComponent: () => <div className="p-6">Case not found.</div>,
});

type TaxCode = "G" | "S" | "H13" | "E";
const TAX_RATES: Record<TaxCode, number> = { G: 0.05, S: 0.14975, H13: 0.13, E: 0 };
const TAX_LABELS: Record<TaxCode, string> = { G: "G — 5%", S: "S — 14.975%", H13: "H13 — 13%", E: "E — 0% (exempt)" };

const SECTIONS = [
  { id: "vehicle", label: "Vehicle", icon: Car, bg: "bg-chart-1/10", border: "border-chart-1", text: "text-chart-1" },
  { id: "purchase", label: "Purchase", icon: ArrowDownLeft, bg: "bg-chart-2/10", border: "border-chart-2", text: "text-chart-2" },
  { id: "sale", label: "Sale", icon: ArrowUpRight, bg: "bg-chart-3/10", border: "border-chart-3", text: "text-chart-3" },
  { id: "status", label: "Status", icon: Tag, bg: "bg-chart-4/10", border: "border-chart-4", text: "text-chart-4" },
  { id: "documents", label: "Documents", icon: ClipboardList, bg: "bg-chart-5/10", border: "border-chart-5", text: "text-chart-5" },
  { id: "activity", label: "Activity", icon: MessageSquare, bg: "bg-muted", border: "border-muted-foreground/30", text: "text-foreground" },
] as const;

function computeTotals(amounts: Array<{ amt: string; code: TaxCode }>) {
  let base = 0;
  let tax = 0;
  for (const { amt, code } of amounts) {
    const n = Number(amt) || 0;
    base += n;
    tax += n * TAX_RATES[code];
  }
  return { base, tax, total: base + tax };
}

function computeTotalsLegacy(a1: string, a2: string, code: TaxCode) {
  return computeTotals([{ amt: a1, code }, { amt: a2, code }]);
}


function CaseDetailPage() {
  const { caseId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: c, isLoading } = useQuery({
    queryKey: ["case", caseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("*, vehicles(*)")
        .eq("id", caseId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const ensureFolder = useServerFn(ensureCaseDriveFolder);


  const { data: contacts } = useQuery({
    queryKey: ["contacts-min"],
    queryFn: async () => (await supabase.from("contacts").select("id,display_name,kind").order("display_name")).data ?? [],
  });

  const { data: makes } = useQuery({
    queryKey: ["vehicle-makes"],
    queryFn: async () => (await supabase.from("vehicle_makes").select("id,name").order("name")).data ?? [],
  });
  const { data: models } = useQuery({
    queryKey: ["vehicle-models"],
    queryFn: async () => (await supabase.from("vehicle_models").select("id,make_id,name").order("name")).data ?? [],
  });

  const { data: documents } = useQuery({
    queryKey: ["case-docs", caseId],
    queryFn: async () => (await supabase.from("case_documents").select("*").eq("case_id", caseId).order("created_at", { ascending: false })).data ?? [],
  });

  const { data: txns } = useQuery({
    queryKey: ["case-txns", caseId],
    queryFn: async () => (await supabase.from("case_transactions").select("*").eq("case_id", caseId)).data ?? [],
  });

  const [form, setForm] = useState<any>(null);
  useEffect(() => { if (c && !form) setForm({
    // vehicle
    v_vin: c.vehicles?.vin ?? "",
    v_make: c.vehicles?.make ?? "",
    v_model: c.vehicles?.model ?? "",
    v_year: c.vehicles?.year?.toString() ?? "",
    v_trim: c.vehicles?.trim ?? "",
    v_mileage: c.vehicles?.mileage?.toString() ?? "",
    v_color: c.vehicles?.color ?? "",
    // case
    notes: c.notes ?? "",
    is_trade_in: !!c.is_trade_in,
    is_mb: !!c.is_mb,
    seller_id: c.seller_id,
    buyer_id: c.buyer_id,
    trade_in_lessee_id: c.trade_in_lessee_id,
    pAmt1: c.purchase_amount_1?.toString() ?? "",
    pAmt2: c.purchase_amount_2?.toString() ?? "",
    pAmt3: c.purchase_amount_3?.toString() ?? "",
    pTax1: (c.purchase_tax_code_1 ?? c.purchase_tax_code ?? "E") as TaxCode,
    pTax2: (c.purchase_tax_code_2 ?? c.purchase_tax_code ?? "E") as TaxCode,
    pTax3: (c.purchase_tax_code_3 ?? "E") as TaxCode,

    purchase_date: c.purchase_date ?? "",
    sAmt1: c.sale_amount_1?.toString() ?? "",
    sAmt2: c.sale_amount_2?.toString() ?? "",
    sTax: (c.sale_tax_code ?? "E") as TaxCode,
    sale_date: c.sale_date ?? "",
    listed_on_marketplace: !!c.listed_on_marketplace,
    sale_is_final: !!c.sale_is_final,
    needs_attention: !!c.needs_attention,
    attention_note: c.attention_note ?? "",
    title_from_seller_received_at: c.title_from_seller_received_at,
    atac_from_seller_received_at: c.atac_from_seller_received_at,
    title_to_buyer_provided_at: c.title_to_buyer_provided_at,
    atac_to_buyer_provided_at: c.atac_to_buyer_provided_at,
    // status flags
    has_buyer_in_mind: !!c.has_buyer_in_mind,
    is_purchased: !!c.is_purchased,
    in_possession: !!c.in_possession,
    in_inventory: !!c.in_inventory,
    is_sold: !!c.is_sold,
    shipped_overseas: !!c.shipped_overseas,
    shipping_status: c.shipping_status ?? "",
  }); }, [c, form]);

  const sellers = useMemo(() => (contacts ?? []).filter((x: any) => x.kind === "seller" || x.kind === "both"), [contacts]);
  const buyers = useMemo(() => (contacts ?? []).filter((x: any) => x.kind === "buyer" || x.kind === "both"), [contacts]);
  const lessees = useMemo(() => (contacts ?? []).filter((x: any) => x.kind === "lessee"), [contacts]);

  const currentMakeId = useMemo(() => (makes ?? []).find((m: any) => m.name === form?.v_make)?.id ?? null, [makes, form?.v_make]);
  const modelsForMake = useMemo(() => {
    if (!currentMakeId) return models ?? [];
    return (models ?? []).filter((m: any) => m.make_id === currentMakeId);
  }, [models, currentMakeId]);

  const pTotals = form ? computeTotals([{ amt: form.pAmt1, code: form.pTax1 }, { amt: form.pAmt2, code: form.pTax2 }, { amt: form.pAmt3, code: form.pTax3 }]) : { base: 0, tax: 0, total: 0 };
  const sTotals = form ? computeTotalsLegacy(form.sAmt1, form.sAmt2, form.sTax) : { base: 0, tax: 0, total: 0 };


  const [saving, setSaving] = useState(false);
  const pushPurchase = useServerFn(syncCasePurchaseToQbo);
  const pushSale = useServerFn(syncCaseSaleToQbo);
  const recheckBill = useServerFn(checkQboBillStatus);
  const recheckInvoice = useServerFn(checkQboInvoiceStatus);
  const getEnv = useServerFn(getQboEnvironment);
  const { data: qboEnvData } = useQuery({
    queryKey: ["qbo-env"],
    queryFn: () => getEnv(),
  });
  const environment = (qboEnvData?.environment ?? "production") as "production" | "sandbox";
  const qboHost = environment === "sandbox" ? "sandbox.qbo.intuit.com" : "qbo.intuit.com";

  const [deleting, setDeleting] = useState(false);
  const [confirmingVehicle, setConfirmingVehicle] = useState(false);
  const [checkingBill, setCheckingBill] = useState(false);
  const [checkingInvoice, setCheckingInvoice] = useState(false);
  const [resyncingBill, setResyncingBill] = useState(false);
  const [resyncingInvoice, setResyncingInvoice] = useState(false);
  const [creatingBill, setCreatingBill] = useState(false);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [billNumber, setBillNumber] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");


  async function createMake(name: string) {
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("vehicle_makes").insert({ name, created_by: u.user?.id ?? null }).select("id,name").single();
    if (error) { toast.error(error.message); return; }
    await qc.invalidateQueries({ queryKey: ["vehicle-makes"] });
    setForm((f: any) => ({ ...f, v_make: data.name }));
  }
  async function createModel(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    // Avoid duplicates
    const existing = (models ?? []).find((m: any) => m.name.toLowerCase() === trimmed.toLowerCase() && (!currentMakeId || m.make_id === currentMakeId));
    if (existing) {
      setForm((f: any) => ({ ...f, v_model: existing.name }));
      return;
    }
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("vehicle_models").insert({ make_id: currentMakeId, name: trimmed, created_by: u.user?.id ?? null }).select("id,make_id,name").single();
    if (error) { toast.error(error.message); return; }
    await qc.invalidateQueries({ queryKey: ["vehicle-models"] });
    setForm((f: any) => ({ ...f, v_model: data.name }));
  }

  async function createContact(name: string, kind: "seller" | "buyer"): Promise<string | null> {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const existing = (contacts ?? []).find((x: any) => x.display_name.toLowerCase() === trimmed.toLowerCase() && (x.kind === kind || x.kind === "both"));
    if (existing) return existing.id;
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("contacts").insert({ display_name: trimmed, kind, created_by: u.user?.id ?? null }).select("id").single();
    if (error) { toast.error(error.message); return null; }
    await qc.invalidateQueries({ queryKey: ["contacts-min"] });
    toast.success(`${kind === "seller" ? "Seller" : "Buyer"} created`);
    return data.id;
  }

  async function confirmVehicle() {
    if (!form || !c) return;
    setConfirmingVehicle(true);
    try {
      if (c.vehicle_id) {
        const { error: ve } = await supabase.from("vehicles").update({
          vin: form.v_vin?.trim() || null,
          make: form.v_make || null,
          model: form.v_model || null,
          year: form.v_year ? Number(form.v_year) : null,
          trim: form.v_trim || null,
          mileage: form.v_mileage ? Number(form.v_mileage) : null,
          color: form.v_color || null,
        }).eq("id", c.vehicle_id);
        if (ve) throw ve;
      }
      const res = await ensureFolder({ data: { caseId } });
      await qc.invalidateQueries({ queryKey: ["case", caseId] });
      await qc.invalidateQueries({ queryKey: ["cases-list"] });
      toast.success(res.folderUrl ? "Case saved & Drive folder ready" : "Case saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not confirm vehicle");
    } finally {
      setConfirmingVehicle(false);
    }
  }

  async function save() {

    if (!form) return;
    setSaving(true);
    try {
      // vehicle
      if (c.vehicle_id) {
        const { error: ve } = await supabase.from("vehicles").update({
          vin: form.v_vin?.trim() || null,
          make: form.v_make || null,
          model: form.v_model || null,
          year: form.v_year ? Number(form.v_year) : null,
          trim: form.v_trim || null,
          mileage: form.v_mileage ? Number(form.v_mileage) : null,
          color: form.v_color || null,
        }).eq("id", c.vehicle_id);
        if (ve) throw ve;
      }
      // case
      const { error } = await supabase.from("cases").update({
        notes: form.notes || null,
        is_trade_in: form.is_trade_in,
        is_mb: form.is_mb,
        seller_id: form.seller_id,
        buyer_id: form.buyer_id,
        trade_in_lessee_id: form.is_trade_in ? form.trade_in_lessee_id : null,
        purchase_amount_1: form.pAmt1 ? Number(form.pAmt1) : null,
        purchase_amount_2: form.pAmt2 ? Number(form.pAmt2) : null,
        purchase_amount_3: form.pAmt3 ? Number(form.pAmt3) : null,
        purchase_tax_code_1: form.pTax1,
        purchase_tax_code_2: form.pTax2,
        purchase_tax_code_3: form.pTax3,
        // Keep legacy field for QBO — use the first tax code across amounts with a positive amount.
        purchase_tax_code: form.pTax1,

        purchase_tax_amount: pTotals.base ? pTotals.tax : null,
        purchase_total: pTotals.base ? pTotals.total : null,
        purchase_price: pTotals.base ? pTotals.total : null,
        purchase_date: form.purchase_date || null,
        sale_amount_1: form.sAmt1 ? Number(form.sAmt1) : null,
        sale_amount_2: form.sAmt2 ? Number(form.sAmt2) : null,
        sale_tax_code: form.sTax,
        sale_tax_amount: sTotals.base ? sTotals.tax : null,
        sale_total: sTotals.base ? sTotals.total : null,
        sale_price: sTotals.base ? sTotals.total : null,
        sale_date: form.sale_date || null,
        listed_on_marketplace: !!form.listed_on_marketplace,
        has_buyer_in_mind: !!form.has_buyer_in_mind,
        is_purchased: !!form.is_purchased,
        in_possession: !!form.in_possession,
        in_inventory: !!form.in_inventory,
        is_sold: !!form.is_sold,
        shipped_overseas: !!form.shipped_overseas,
        shipping_status: form.shipped_overseas ? (form.shipping_status?.trim() || null) : null,
      } as any).eq("id", caseId);
      if (error) throw error;
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["case", caseId] });
      qc.invalidateQueries({ queryKey: ["case-txns", caseId] });
      qc.invalidateQueries({ queryKey: ["cases-list"] });
      qc.invalidateQueries({ queryKey: ["case-activity", caseId] });

    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  async function patchCase(patch: Record<string, unknown>, successMsg?: string) {
    const { error } = await (supabase.from("cases") as any).update(patch).eq("id", caseId);
    if (error) { toast.error(error.message); return; }
    if (successMsg) toast.success(successMsg);
    qc.invalidateQueries({ queryKey: ["case", caseId] });
    qc.invalidateQueries({ queryKey: ["case-txns", caseId] });
    qc.invalidateQueries({ queryKey: ["cases-list"] });
  }

  function toggleTs(field: string, current: string | null) {
    const next = current ? null : new Date().toISOString();
    setForm((f: any) => ({ ...f, [field]: next }));
    patchCase({ [field]: next });
  }

  const [archiving, setArchiving] = useState(false);
  async function archive() {
    setArchiving(true);
    try {
      const { error } = await supabase.from("cases").update({ archived_at: new Date().toISOString() } as any).eq("id", caseId);
      if (error) throw error;
      await logCaseActivity(caseId, "system", "Case archived");
      toast.success("Case archived");
      qc.invalidateQueries({ queryKey: ["cases-list"] });
      navigate({ to: "/cases" });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Archive failed"); }
    finally { setArchiving(false); }
  }

  const deleteCaseFn = useServerFn(deleteCaseFully);
  async function del() {
    setDeleting(true);
    try {
      const res = await deleteCaseFn({ data: { caseId } });
      if (res.warnings?.length) {
        toast.warning(`Case deleted with warnings: ${res.warnings.join("; ")}`);
      } else {
        toast.success("Case deleted (QuickBooks + Drive folder cleaned up)");
      }
      qc.invalidateQueries({ queryKey: ["cases-list"] });
      navigate({ to: "/cases" });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Delete failed"); setDeleting(false); }
  }

  async function downloadDoc(path: string, name: string) {
    const { data, error } = await supabase.storage.from("case-documents").createSignedUrl(path, 60);
    if (error || !data) { toast.error("Could not open document"); return; }
    const a = document.createElement("a");
    a.href = data.signedUrl; a.download = name; a.target = "_blank"; a.click();
  }

  async function deleteDoc(id: string, path: string) {
    await supabase.storage.from("case-documents").remove([path]);
    await supabase.from("case_documents").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["case-docs", caseId] });
    toast.success("Document deleted");
  }

  async function uploadDocs(files: FileList | null) {
    if (!files || !files.length) return;
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id ?? null;
    for (const file of Array.from(files)) {
      const path = `${uid}/${caseId}/${crypto.randomUUID()}-${file.name}`;
      const { error: ue } = await supabase.storage.from("case-documents").upload(path, file, { contentType: file.type || undefined });
      if (ue) { toast.error(`Upload failed: ${file.name}`); continue; }
      await supabase.from("case_documents").insert({
        case_id: caseId, kind: "other", file_path: path,
        file_name: file.name, mime_type: file.type || null, size_bytes: file.size, uploaded_by: uid,
      });
    }
    qc.invalidateQueries({ queryKey: ["case-docs", caseId] });
    toast.success("Uploaded");
  }

  async function onRecheckBill() {
    setCheckingBill(true);
    try {
      const res = await recheckBill({ data: { caseId } });
      if (res.status === "deleted") toast.warning("QuickBooks says this bill was deleted");
      else if (res.status === "present") toast.success("QuickBooks bill is present");
      qc.invalidateQueries({ queryKey: ["case", caseId] }); qc.invalidateQueries({ queryKey: ["case-txns", caseId] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Recheck failed"); }
    finally { setCheckingBill(false); }
  }
  async function onRecheckInvoice() {
    setCheckingInvoice(true);
    try {
      const res = await recheckInvoice({ data: { caseId } });
      if (res.status === "deleted") toast.warning("QuickBooks says this invoice was deleted");
      else if (res.status === "present") toast.success("QuickBooks invoice is present");
      qc.invalidateQueries({ queryKey: ["case", caseId] }); qc.invalidateQueries({ queryKey: ["case-txns", caseId] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Recheck failed"); }
    finally { setCheckingInvoice(false); }
  }
  async function onResyncBill(docNumber: string | null) {
    setResyncingBill(true);
    try {
      await pushPurchase({ data: { caseId, docNumber } });
      toast.success("QuickBooks bill re-created");
      qc.invalidateQueries({ queryKey: ["case", caseId] }); qc.invalidateQueries({ queryKey: ["case-txns", caseId] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Re-sync failed"); }
    finally { setResyncingBill(false); }
  }
  async function onResyncInvoice(docNumber: string | null) {
    setResyncingInvoice(true);
    try {
      await pushSale({ data: { caseId, docNumber } });
      toast.success("QuickBooks invoice re-created");
      qc.invalidateQueries({ queryKey: ["case", caseId] }); qc.invalidateQueries({ queryKey: ["case-txns", caseId] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Re-sync failed"); }
    finally { setResyncingInvoice(false); }
  }

  async function createBill() {
    if (!form?.seller_id) { toast.error("Add a seller first"); return; }
    if (!pTotals.total) { toast.error("Enter a purchase amount first"); return; }
    setCreatingBill(true);
    try {
      // Persist current form first so amounts/seller are on the row
      await save();
      const res = await pushPurchase({ data: { caseId, docNumber: billNumber.trim() || null } });
      if (res && "skipped" in res) toast.info("Bill already exists in QuickBooks");
      else { toast.success("QuickBooks bill created"); await logCaseActivity(caseId, "payment", `Bill created for ${form.seller_id ? "seller" : "case"} — ${pTotals.total.toLocaleString(undefined, { style: "currency", currency: "USD" })}`); }
      setBillNumber("");
      qc.invalidateQueries({ queryKey: ["case", caseId] });
      qc.invalidateQueries({ queryKey: ["case-txns", caseId] });
      qc.invalidateQueries({ queryKey: ["case-activity", caseId] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not create bill"); }
    finally { setCreatingBill(false); }
  }

  async function createInvoice() {
    if (!form?.buyer_id) { toast.error("Add a buyer first"); return; }
    if (!sTotals.total) { toast.error("Enter a sale amount first"); return; }
    setCreatingInvoice(true);
    try {
      await save();
      const res = await pushSale({ data: { caseId, docNumber: invoiceNumber.trim() || null } });
      if (res && "skipped" in res) toast.info("Invoice already exists in QuickBooks");
      else { toast.success("QuickBooks invoice created"); await logCaseActivity(caseId, "payment", `Invoice created for buyer — ${sTotals.total.toLocaleString(undefined, { style: "currency", currency: "USD" })}`); }
      setInvoiceNumber("");
      qc.invalidateQueries({ queryKey: ["case", caseId] });
      qc.invalidateQueries({ queryKey: ["case-txns", caseId] });
      qc.invalidateQueries({ queryKey: ["case-activity", caseId] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not create invoice"); }
    finally { setCreatingInvoice(false); }
  }

  if (isLoading || !form) return <div className="p-6">Loading…</div>;
  if (!c) return <div className="p-6">Case not found.</div>;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2">
            <Link to="/cases"><ArrowLeft className="h-4 w-4 mr-1" /> All cases</Link>
          </Button>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            {c.needs_attention && <Flag className="h-5 w-5 text-destructive" />}
            {formatCaseName(c.vehicles)}
          </h1>
          <div className="flex gap-2 mt-1">
            {c.is_trade_in && <Badge variant="secondary">Trade-in</Badge>}
            {c.is_mb && <Badge variant="secondary">MB</Badge>}
          </div>
        </div>
        <div className="flex gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm"><Archive className="h-4 w-4 mr-1" /> Archive</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Archive this case?</AlertDialogTitle>
                <AlertDialogDescription>
                  Archived cases drop off the active board and table but nothing is deleted — the vehicle, contacts,
                  QuickBooks bill/invoice, and documents all stay intact and can be found again if needed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={archive} disabled={archiving}>{archiving ? "Archiving…" : "Archive"}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Permanently delete this case?</AlertDialogTitle>
                <AlertDialogDescription>
                  This is different from archiving — it permanently removes the case, its documents, and — if present —
                  the QuickBooks bill/invoice and the Google Drive folder. Use this only for a case created by mistake.
                  This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={del} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{deleting ? "Deleting…" : "Delete permanently"}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {SECTIONS.filter((s) => s.id !== "documents" && s.id !== "activity").map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => document.getElementById(`section-${s.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-4 transition-transform hover:scale-[1.02] ${s.bg} ${s.border}`}
          >
            <s.icon className={`h-8 w-8 ${s.text}`} />
            <span className="text-sm font-semibold">{s.label}</span>
          </button>
        ))}
      </div>

      {/* ============ VEHICLE INFO ============ */}
      <Card id="section-vehicle" className="border-l-4 border-l-chart-1">
        <CardHeader className="sticky top-12 z-20 bg-chart-1/5 backdrop-blur border-b rounded-t-lg"><CardTitle className="text-base flex items-center gap-2"><Car className="h-4 w-4 text-chart-1" /> Vehicle info</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <div className="space-y-1 col-span-2">
            <Label>VIN</Label>
            <Input value={form.v_vin} onChange={(e) => setForm({ ...form, v_vin: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Model</Label>
            <Combobox
              items={modelsForMake.map((m: any) => ({ value: m.name, label: m.name }))}
              value={form.v_model || null}
              onChange={(v) => {
                const selectedModel = (models ?? []).find((m: any) => m.name === v);
                setForm((f: any) => ({
                  ...f,
                  v_model: v ?? "",
                  v_make: f.v_make || (selectedModel ? ((makes ?? []).find((m: any) => m.id === selectedModel.make_id)?.name ?? "") : ""),
                }));
              }}
              onCreate={createModel}
              placeholder="Select or add model"
              createLabel="Add model"
            />
          </div>
          <div className="space-y-1">
            <Label>Make</Label>
            <Combobox
              items={(makes ?? []).map((m: any) => ({ value: m.name, label: m.name }))}
              value={form.v_make || null}
              onChange={(v) => setForm({ ...form, v_make: v ?? "" })}
              onCreate={createMake}
              placeholder="Select or add make"
              createLabel="Add make"
            />
          </div>
          <div className="space-y-1"><Label>Year</Label><Input type="number" value={form.v_year} onChange={(e) => setForm({ ...form, v_year: e.target.value })} /></div>
          <div className="space-y-1"><Label>Trim</Label><Input value={form.v_trim} onChange={(e) => setForm({ ...form, v_trim: e.target.value })} /></div>
          <div className="space-y-1"><Label>KM</Label><Input type="number" value={form.v_mileage} onChange={(e) => setForm({ ...form, v_mileage: e.target.value })} /></div>
          <div className="space-y-1"><Label>Color</Label><Input value={form.v_color} onChange={(e) => setForm({ ...form, v_color: e.target.value })} /></div>
          <div className="col-span-2 flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2"><Switch checked={form.is_trade_in} onCheckedChange={(v) => setForm({ ...form, is_trade_in: v })} /><Label>Trade-in?</Label></div>
            <div className="flex items-center gap-2"><Checkbox checked={form.is_mb} onCheckedChange={(v) => setForm({ ...form, is_mb: v === true })} /><Label>MB?</Label></div>
          </div>
          {form.is_trade_in && (
            <div className="space-y-1 col-span-2">
              <Label>Lessee</Label>
              <Select value={form.trade_in_lessee_id ?? "none"} onValueChange={(v) => setForm({ ...form, trade_in_lessee_id: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Select lessee" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {lessees.map((x: any) => <SelectItem key={x.id} value={x.id}>{x.display_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1 col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <div className="col-span-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2 border-t">
            <div className="text-xs text-muted-foreground">
              {c.gdrive_folder_id ? (
                <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Drive folder ready</span>
              ) : (
                "Confirm to save the vehicle and create its Drive folder."
              )}
            </div>
            <Button type="button" onClick={confirmVehicle} disabled={confirmingVehicle}>
              <CheckCircle2 className="h-4 w-4 mr-1" />
              {confirmingVehicle ? "Saving…" : c.gdrive_folder_id ? "Update vehicle" : "Confirm vehicle & create folder"}
            </Button>
          </div>
        </CardContent>
      </Card>


      {/* ============ PURCHASE INFO ============ */}
      <Card id="section-purchase" className="border-l-4 border-l-chart-2">
        <CardHeader className="sticky top-12 z-20 bg-chart-2/5 backdrop-blur border-b rounded-t-lg"><CardTitle className="text-base flex items-center gap-2"><ArrowDownLeft className="h-4 w-4 text-chart-2" /> Purchase info</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <div className="space-y-1 col-span-2">
            <Label>Seller</Label>
            <Combobox
              items={sellers.map((x: any) => ({ value: x.id, label: x.display_name }))}
              value={form.seller_id ?? null}
              onChange={(v) => setForm({ ...form, seller_id: v })}
              onCreate={async (name) => {
                const id = await createContact(name, "seller");
                if (id) setForm((f: any) => ({ ...f, seller_id: id }));
              }}
              placeholder="Select or add seller"
              createLabel="Add seller"
            />
          </div>
          {([1, 2, 3] as const).map((n) => {
            const amtKey = `pAmt${n}` as "pAmt1" | "pAmt2" | "pAmt3";
            const taxKey = `pTax${n}` as "pTax1" | "pTax2" | "pTax3";
            return (
              <div key={n} className="col-span-2 grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Amount {n}</Label>
                  <Input type="number" step="0.01" value={form[amtKey]} onChange={(e) => setForm({ ...form, [amtKey]: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Sales tax on amount {n}</Label>
                  <Select value={form[taxKey]} onValueChange={(v) => setForm({ ...form, [taxKey]: v as TaxCode })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{(Object.keys(TAX_LABELS) as TaxCode[]).map(k => <SelectItem key={k} value={k}>{TAX_LABELS[k]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            );
          })}

          <div className="space-y-1"><Label>Purchase date</Label><Input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} /></div>
          <div className="space-y-1"><Label>Tax</Label><Input readOnly className="bg-muted" value={pTotals.tax ? pTotals.tax.toFixed(2) : ""} /></div>
          <div className="space-y-1"><Label>Total</Label><Input readOnly className="bg-muted font-semibold" value={pTotals.total ? pTotals.total.toFixed(2) : ""} /></div>
          {!c.qbo_bill_id && (
            <div className="col-span-2 rounded-md border p-3 space-y-2">
              <Label htmlFor="bill_number" className="text-sm">QuickBooks bill number (optional)</Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input id="bill_number" placeholder="e.g. Seller invoice #" value={billNumber} onChange={(e) => setBillNumber(e.target.value)} />
                <Button type="button" onClick={createBill} disabled={creatingBill}>
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  {creatingBill ? "Creating…" : "Create QBO bill"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Saves the case and posts a bill to QuickBooks. Leave the number blank to let QuickBooks assign one.</p>
            </div>
          )}
          {c.qbo_bill_id && (
            <div className="col-span-2 space-y-2">
              <QboDocStatus
                kind="bill" host={qboHost} id={c.qbo_bill_id} docNumber={c.qbo_bill_doc_number}
                deletedAt={c.qbo_bill_deleted_at} onRecheck={onRecheckBill} onResync={onResyncBill}
                checking={checkingBill} resyncing={resyncingBill}
              />
              <PaymentSummary txns={txns ?? []} kind="bill" qboDocId={c.qbo_bill_id} />
            </div>
          )}
          <div className="col-span-2 rounded-md border p-3 space-y-2">
            <div className="text-sm font-medium">Seller documents</div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <Checkbox checked={!!form.title_from_seller_received_at} onCheckedChange={() => toggleTs("title_from_seller_received_at", form.title_from_seller_received_at)} />
                Title received from seller
                {form.title_from_seller_received_at && <span className="text-xs text-muted-foreground">{new Date(form.title_from_seller_received_at).toLocaleDateString()}</span>}
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <Checkbox checked={!!form.atac_from_seller_received_at} onCheckedChange={() => toggleTs("atac_from_seller_received_at", form.atac_from_seller_received_at)} />
                ATAC received from seller
                {form.atac_from_seller_received_at && <span className="text-xs text-muted-foreground">{new Date(form.atac_from_seller_received_at).toLocaleDateString()}</span>}
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ============ SALE INFO ============ */}
      <Card id="section-sale" className="border-l-4 border-l-chart-3">
        <CardHeader className="sticky top-12 z-20 bg-chart-3/5 backdrop-blur border-b rounded-t-lg"><CardTitle className="text-base flex items-center gap-2"><ArrowUpRight className="h-4 w-4 text-chart-3" /> Sale info</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <div className="space-y-1 col-span-2">
            <Label>Buyer</Label>
            <Combobox
              items={buyers.map((x: any) => ({ value: x.id, label: x.display_name }))}
              value={form.buyer_id ?? null}
              onChange={(v) => setForm({ ...form, buyer_id: v })}
              onCreate={async (name) => {
                const id = await createContact(name, "buyer");
                if (id) setForm((f: any) => ({ ...f, buyer_id: id }));
              }}
              placeholder="Select or add buyer"
              createLabel="Add buyer"
            />
          </div>
          <div className="space-y-1"><Label>Amount 1</Label><Input type="number" step="0.01" value={form.sAmt1} onChange={(e) => setForm({ ...form, sAmt1: e.target.value })} /></div>
          <div className="space-y-1"><Label>Amount 2</Label><Input type="number" step="0.01" value={form.sAmt2} onChange={(e) => setForm({ ...form, sAmt2: e.target.value })} /></div>
          <div className="space-y-1">
            <Label>Sales tax</Label>
            <Select value={form.sTax} onValueChange={(v) => setForm({ ...form, sTax: v as TaxCode })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(TAX_LABELS) as TaxCode[]).map(k => <SelectItem key={k} value={k}>{TAX_LABELS[k]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Sale date</Label><Input type="date" value={form.sale_date} onChange={(e) => setForm({ ...form, sale_date: e.target.value })} /></div>
          <div className="space-y-1"><Label>Tax</Label><Input readOnly className="bg-muted" value={sTotals.tax ? sTotals.tax.toFixed(2) : ""} /></div>
          <div className="space-y-1"><Label>Total</Label><Input readOnly className="bg-muted font-semibold" value={sTotals.total ? sTotals.total.toFixed(2) : ""} /></div>
          {!c.qbo_invoice_id && (
            <div className="col-span-2 rounded-md border p-3 space-y-2">
              <Label htmlFor="invoice_number" className="text-sm">QuickBooks invoice number (optional)</Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input id="invoice_number" placeholder="e.g. INV-1042" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
                <Button type="button" onClick={createInvoice} disabled={creatingInvoice}>
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  {creatingInvoice ? "Creating…" : "Create QBO invoice"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Saves the case and posts an invoice to QuickBooks. Leave blank to let QuickBooks assign one.</p>
            </div>
          )}
          {c.qbo_invoice_id && (
            <div className="col-span-2 space-y-2">
              <QboDocStatus
                kind="invoice" host={qboHost} id={c.qbo_invoice_id} docNumber={c.qbo_invoice_doc_number}
                deletedAt={c.qbo_invoice_deleted_at} onRecheck={onRecheckInvoice} onResync={onResyncInvoice}
                checking={checkingInvoice} resyncing={resyncingInvoice}
              />
              <PaymentSummary txns={txns ?? []} kind="invoice" qboDocId={c.qbo_invoice_id} />
            </div>
          )}
          {form.buyer_id && (
            <div className="col-span-2 rounded-md border p-3 space-y-2">
              <div className="text-sm font-medium">Buyer documents</div>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <Checkbox checked={!!form.title_to_buyer_provided_at} onCheckedChange={() => toggleTs("title_to_buyer_provided_at", form.title_to_buyer_provided_at)} />
                  Title provided to buyer
                  {form.title_to_buyer_provided_at && <span className="text-xs text-muted-foreground">{new Date(form.title_to_buyer_provided_at).toLocaleDateString()}</span>}
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <Checkbox checked={!!form.atac_to_buyer_provided_at} onCheckedChange={() => toggleTs("atac_to_buyer_provided_at", form.atac_to_buyer_provided_at)} />
                  ATAC provided to buyer
                  {form.atac_to_buyer_provided_at && <span className="text-xs text-muted-foreground">{new Date(form.atac_to_buyer_provided_at).toLocaleDateString()}</span>}
                </label>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ============ STATUS SECTION ============ */}
      <Card id="section-status" className={`border-l-4 border-l-chart-4 ${form.needs_attention ? "border-destructive" : ""}`}>
        <CardHeader className="sticky top-12 z-20 bg-chart-4/5 backdrop-blur border-b rounded-t-lg"><CardTitle className="text-base flex items-center gap-2"><Tag className="h-4 w-4 text-chart-4" /> Status</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <StatusToggle
              label="Buyer in mind"
              checked={form.has_buyer_in_mind}
              onChange={(v) => { setForm({ ...form, has_buyer_in_mind: v }); patchCase({ has_buyer_in_mind: v }); }}
            />
            <StatusToggle
              label="Purchased"
              checked={form.is_purchased}
              onChange={(v) => { setForm({ ...form, is_purchased: v }); patchCase({ is_purchased: v }); }}
            />
            <StatusToggle
              label="In possession"
              checked={form.in_possession}
              onChange={(v) => { setForm({ ...form, in_possession: v }); patchCase({ in_possession: v }); }}
            />
            <StatusToggle
              label="In inventory"
              checked={form.in_inventory}
              onChange={(v) => { setForm({ ...form, in_inventory: v }); patchCase({ in_inventory: v }); }}
            />
            <StatusToggle
              label="Sold"
              checked={form.is_sold}
              onChange={(v) => { setForm({ ...form, is_sold: v }); patchCase({ is_sold: v }); }}
            />
            <StatusToggle
              label="Listed on marketplace"
              checked={form.listed_on_marketplace}
              onChange={(v) => { setForm({ ...form, listed_on_marketplace: v }); patchCase({ listed_on_marketplace: v }); }}
            />
            <StatusToggle
              label="Shipped overseas"
              checked={form.shipped_overseas}
              onChange={(v) => {
                const next = { ...form, shipped_overseas: v, shipping_status: v ? form.shipping_status : "" };
                setForm(next);
                patchCase({ shipped_overseas: v, shipping_status: v ? (form.shipping_status?.trim() || null) : null });
              }}
            />
          </div>

          {form.shipped_overseas && (
            <div className="space-y-2 pt-2 border-t">
              <Label htmlFor="shipping_status" className="text-sm">Shipment tracking</Label>
              <Textarea
                id="shipping_status"
                placeholder="e.g. Picked up by carrier · At port of Newark · On vessel MV Atlantic · Arrived at destination port · Delivered to buyer"
                value={form.shipping_status ?? ""}
                onChange={(e) => setForm({ ...form, shipping_status: e.target.value })}
                onBlur={() => patchCase({ shipping_status: form.shipping_status?.trim() || null })}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">Free-form notes on where the shipment is up to. Saves when you click away.</p>
            </div>
          )}

          {c.qbo_invoice_id && !c.qbo_invoice_deleted_at && (
            <div className="flex items-center gap-2 pt-2 border-t">
              {form.sale_is_final ? (
                <Badge variant="outline" className="border-green-600 text-green-700">Sale is final</Badge>
              ) : (
                <Badge variant="outline" className="border-yellow-500 text-yellow-700">Non-final sale</Badge>
              )}
              <Button
                type="button" variant="outline" size="sm"
                onClick={() => { const v = !form.sale_is_final; setForm({ ...form, sale_is_final: v }); patchCase({ sale_is_final: v }, v ? "Marked final" : "Reopened"); }}
              >
                {form.sale_is_final ? "Reopen" : "Mark final"}
              </Button>
            </div>
          )}

          <div className="pt-2 border-t space-y-2">
            <div className="flex items-center gap-2">
              <Flag className={`h-4 w-4 ${form.needs_attention ? "text-destructive" : "text-muted-foreground"}`} />
              <Switch
                checked={form.needs_attention}
                onCheckedChange={(v) => { setForm({ ...form, needs_attention: v }); patchCase({ needs_attention: v }); }}
              />
              <Label className="cursor-pointer">Flag this case for attention</Label>
            </div>
            {form.needs_attention && (
              <Textarea
                placeholder="What needs attention?"
                value={form.attention_note ?? ""}
                onChange={(e) => setForm({ ...form, attention_note: e.target.value })}
                onBlur={() => patchCase({ attention_note: form.attention_note || null }, "Saved")}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Documents — stored in Google Drive */}
      <Card id="section-documents" className="border-l-4 border-l-chart-5">
        <CardHeader className="sticky top-12 z-20 bg-chart-5/5 backdrop-blur border-b rounded-t-lg"><CardTitle className="text-base flex items-center gap-2"><ClipboardList className="h-4 w-4 text-chart-5" /> Documents</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Documents for this case are stored in a dedicated Google Drive folder. Upload, view and manage files directly in Drive.
          </p>
          <DriveFolderButton caseId={caseId} folderUrl={(c as any)?.gdrive_folder_url ?? null} />
        </CardContent>
      </Card>

      {/* ============ ACTIVITY ============ */}
      <Card id="section-activity" className="border-l-4 border-l-muted-foreground/30">
        <CardHeader className="sticky top-12 z-20 bg-muted/40 backdrop-blur border-b rounded-t-lg"><CardTitle className="text-base flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Activity</CardTitle></CardHeader>
        <CardContent>
          <ActivityTimeline caseId={caseId} />
        </CardContent>
      </Card>

      <div className="flex justify-end sticky bottom-4">
        <Button onClick={save} disabled={saving} size="lg">{saving ? "Saving…" : "Save changes"}</Button>
      </div>
    </div>
  );
}

function StatusToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent/50">
      <Switch checked={checked} onCheckedChange={onChange} />
      <span className="text-sm font-medium">{label}</span>
      {checked && <CheckCircle2 className="h-4 w-4 text-green-600 ml-auto" />}
    </label>
  );
}

function DriveFolderButton({ caseId, folderUrl }: { caseId: string; folderUrl: string | null }) {
  const ensure = useServerFn(ensureCaseDriveFolder);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  async function openFolder() {
    if (folderUrl) { window.open(folderUrl, "_blank", "noopener,noreferrer"); return; }
    setBusy(true);
    try {
      const res = await ensure({ data: { caseId } });
      qc.invalidateQueries({ queryKey: ["case", caseId] });
      window.open(res.folderUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open Drive folder");
    } finally { setBusy(false); }
  }
  return (
    <Button type="button" onClick={openFolder} disabled={busy} className="gap-2">
      <FolderOpen className="h-4 w-4" />
      {folderUrl ? "Open Google Drive folder" : busy ? "Creating folder…" : "Create & open Drive folder"}
      <ExternalLink className="h-3 w-3 opacity-70" />
    </Button>
  );
}

function QboDocStatus(props: {
  kind: "bill" | "invoice"; host: string; id: string; docNumber: string | null; deletedAt: string | null;
  onRecheck: () => void; onResync: (docNumber: string | null) => void; checking: boolean; resyncing: boolean;
}) {
  const { kind, host, id, docNumber, deletedAt, onRecheck, onResync, checking, resyncing } = props;
  const label = kind === "bill" ? "Bill" : "Invoice";
  const url = `https://${host}/app/${kind}?txnId=${encodeURIComponent(id)}`;
  const isDeleted = !!deletedAt;
  const [newDocNumber, setNewDocNumber] = useState("");
  return (
    <div className={`rounded-md border p-3 flex flex-wrap items-center gap-3 text-sm ${isDeleted ? "border-destructive/40 bg-destructive/5" : "bg-muted/30"}`}>
      {isDeleted ? <AlertTriangle className="h-4 w-4 text-destructive shrink-0" /> : <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />}
      <div className="flex-1 min-w-0">
        {isDeleted ? (
          <div>
            <div className="font-medium text-destructive">QuickBooks {label.toLowerCase()} was deleted</div>
            <div className="text-xs text-muted-foreground">Detected {new Date(deletedAt!).toLocaleString()}</div>
          </div>
        ) : (
          <div>
            <a href={url} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline inline-flex items-center gap-1">
              QuickBooks {label} {docNumber ? `#${docNumber}` : `#${id}`}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <div className="text-xs text-muted-foreground">Synced to QuickBooks</div>
          </div>
        )}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onRecheck} disabled={checking}>
        <RefreshCw className={`h-3.5 w-3.5 mr-1 ${checking ? "animate-spin" : ""}`} />
        {checking ? "Checking…" : "Recheck"}
      </Button>
      {isDeleted && (
        <>
          <Input
            className="h-8 w-40"
            placeholder={`${label} # (optional)`}
            value={newDocNumber}
            onChange={(e) => setNewDocNumber(e.target.value)}
          />
          <Button type="button" size="sm" onClick={() => onResync(newDocNumber.trim() || null)} disabled={resyncing}>
            {resyncing ? "Re-syncing…" : `Re-sync ${label.toLowerCase()}`}
          </Button>
        </>
      )}
    </div>
  );
}

function PaymentSummary({ txns, kind, qboDocId }: { txns: any[]; kind: "bill" | "invoice"; qboDocId: string }) {
  const t = txns.find((x) => x.kind === kind && x.qbo_doc_id === qboDocId);
  const money = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });
  if (!t) return (
    <div className="rounded-md border p-3 text-xs text-muted-foreground">
      Payment status not synced yet — click Recheck to pull from QuickBooks.
    </div>
  );
  const total = Number(t.amount);
  const paid = Number(t.amount_paid);
  const open = Math.max(0, total - paid);
  const label = kind === "bill" ? "Paid to seller" : "Collected from buyer";
  return (
    <div className={`rounded-md border p-3 text-sm ${t.is_paid ? "bg-green-50 border-green-200 dark:bg-green-950/20" : ""}`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="font-medium">{label}: {money(paid)} of {money(total)}</div>
          <div className="text-xs text-muted-foreground">
            {t.is_paid ? "Fully paid" : `Open: ${money(open)}`}
            {t.last_synced_at && ` · synced ${new Date(t.last_synced_at).toLocaleString()}`}
          </div>
        </div>
      </div>
    </div>
  );
}
