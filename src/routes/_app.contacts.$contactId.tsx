import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowLeft, Trash2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { syncContactToQbo } from "@/lib/qbo/qbo.functions";

export const Route = createFileRoute("/_app/contacts/$contactId")({
  head: () => ({ meta: [{ title: "Contact — Dealership Manager" }] }),
  component: ContactDetailPage,
  errorComponent: ({ error }) => <div className="p-6 text-destructive">Failed to load: {error.message}</div>,
  notFoundComponent: () => <div className="p-6">Contact not found.</div>,
});

function ContactDetailPage() {
  const { contactId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const sync = useServerFn(syncContactToQbo);

  const { data: c, isLoading } = useQuery({
    queryKey: ["contact", contactId],
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("*").eq("id", contactId).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: cases } = useQuery({
    queryKey: ["contact-cases", contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("id, case_number, sale_is_final, purchase_date, sale_date, updated_at, seller_id, buyer_id")
        .or(`seller_id.eq.${contactId},buyer_id.eq.${contactId}`)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });


  const [f, setF] = useState<any>(null);
  useEffect(() => { if (c && !f) setF({
    display_name: c.display_name ?? "",
    kind: c.kind,
    company_name: c.company_name ?? "",
    email: c.email ?? "",
    phone: c.phone ?? "",
    notes: c.notes ?? "",
  }); }, [c, f]);

  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function save() {
    if (!f) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("contacts").update({
        display_name: f.display_name.trim(),
        kind: f.kind,
        company_name: f.company_name || null,
        email: f.email || null,
        phone: f.phone || null,
        notes: f.notes || null,
      }).eq("id", contactId);
      if (error) throw error;
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["contact", contactId] });
      qc.invalidateQueries({ queryKey: ["contacts"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  async function del() {
    setDeleting(true);
    try {
      const { error } = await supabase.from("contacts").delete().eq("id", contactId);
      if (error) throw error;
      toast.success("Contact deleted");
      qc.invalidateQueries({ queryKey: ["contacts"] });
      navigate({ to: "/contacts" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed — this contact may still be linked to a case");
      setDeleting(false);
    }
  }

  async function syncNow() {
    setSyncing(true);
    try { await sync({ data: { contactId } }); qc.invalidateQueries({ queryKey: ["contact", contactId] }); toast.success("Synced"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Sync failed"); }
    finally { setSyncing(false); }
  }

  if (isLoading || !f) return <div className="p-6">Loading…</div>;
  if (!c) return <div className="p-6">Contact not found.</div>;

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2">
            <Link to="/contacts"><ArrowLeft className="h-4 w-4 mr-1" /> All contacts</Link>
          </Button>
          <h1 className="text-2xl font-semibold">{c.display_name}</h1>
          <div className="text-xs text-muted-foreground">
            QBO: {c.qbo_customer_id ? `customer #${c.qbo_customer_id}` : c.qbo_vendor_id ? `vendor #${c.qbo_vendor_id}` : "not synced"}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={syncNow} disabled={syncing}><RefreshCw className="h-4 w-4 mr-1" /> {syncing ? "Syncing…" : "Sync QBO"}</Button>
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="destructive" size="sm"><Trash2 className="h-4 w-4 mr-1" /> Delete</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this contact?</AlertDialogTitle>
                <AlertDialogDescription>Permanently removes the contact from this app. Won't touch QuickBooks. If the contact is linked to any case this will fail.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={del} disabled={deleting}>{deleting ? "Deleting…" : "Delete"}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <div className="space-y-1 col-span-2"><Label>Display name</Label><Input value={f.display_name} onChange={(e) => setF({ ...f, display_name: e.target.value })} /></div>
          <div className="space-y-1">
            <Label>Kind</Label>
            <Select value={f.kind} onValueChange={(v) => setF({ ...f, kind: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="seller">Seller (vendor)</SelectItem>
                <SelectItem value="buyer">Buyer (customer)</SelectItem>
                <SelectItem value="both">Both</SelectItem>
                <SelectItem value="lessee">Lessee</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Company</Label><Input value={f.company_name} onChange={(e) => setF({ ...f, company_name: e.target.value })} /></div>
          <div className="space-y-1"><Label>Email</Label><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <div className="space-y-1"><Label>Phone</Label><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          <div className="space-y-1 col-span-2"><Label>Notes</Label><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Case history ({cases?.length ?? 0})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {(cases?.length ?? 0) === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center">No cases linked to this contact.</div>
          ) : (
            <ul className="divide-y">
              {cases!.map((cs) => {
                const role = cs.seller_id === contactId && cs.buyer_id === contactId ? "Seller & Buyer" : cs.seller_id === contactId ? "Seller" : "Buyer";
                return (
                  <li key={cs.id}>
                    <Link to="/cases/$caseId" params={{ caseId: cs.id }} className="flex items-center justify-between p-3 hover:bg-muted/50">
                      <div>
                        <div className="font-medium text-sm">{cs.case_number ?? "Case"}</div>
                        <div className="text-xs text-muted-foreground">{role} · {cs.sale_is_final ? "Final" : cs.sale_date ? "Non-final sale" : cs.purchase_date ? "Purchased" : "In progress"}</div>
                      </div>
                      <div className="text-xs text-muted-foreground">{cs.updated_at ? new Date(cs.updated_at).toLocaleDateString() : ""}</div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
      </div>

    </div>
  );
}
