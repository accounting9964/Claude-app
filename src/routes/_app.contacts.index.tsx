import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, RefreshCw, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { syncContactToQbo } from "@/lib/qbo/qbo.functions";

export const Route = createFileRoute("/_app/contacts/")({
  head: () => ({
    meta: [
      { title: "Contacts — Dealership Manager" },
      { name: "description", content: "Sellers and buyers, synced with QuickBooks Online." },
    ],
  }),
  component: ContactsPage,
});

type Contact = {
  id: string; display_name: string; kind: "seller" | "buyer" | "both";
  email: string | null; phone: string | null; company_name: string | null;
  qbo_customer_id: string | null; qbo_vendor_id: string | null;
};

function ContactsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const sync = useServerFn(syncContactToQbo);

  const { data: contacts, isLoading } = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Contact[];
    },
  });

  async function syncContact(id: string) {
    setSyncingId(id);
    try {
      await sync({ data: { contactId: id } });
      await qc.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Synced to QuickBooks");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncingId(null);
    }
  }

  const create = useMutation({
    mutationFn: async (payload: Partial<Contact> & { display_name: string; kind: Contact["kind"] }) => {
      const { data, error } = await supabase.from("contacts").insert(payload).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: async (id) => {
      toast.success("Contact added");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["contacts"] });
      // Best-effort auto-sync to QBO
      try {
        setSyncingId(id);
        await sync({ data: { contactId: id } });
        qc.invalidateQueries({ queryKey: ["contacts"] });
        toast.success("Synced to QuickBooks");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "QuickBooks sync failed — you can retry from the row");
      } finally {
        setSyncingId(null);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Contacts</h1>
          <p className="text-sm text-muted-foreground">Sellers become QBO vendors; buyers become QBO customers.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> New contact</Button>
          </DialogTrigger>
          <ContactDialog onSubmit={(v) => create.mutate(v)} loading={create.isPending} />
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">All contacts</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>QBO</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={5}>Loading…</TableCell></TableRow>}
              {!isLoading && (contacts?.length ?? 0) === 0 && (
                <TableRow><TableCell colSpan={5} className="text-muted-foreground text-center py-8">No contacts yet.</TableCell></TableRow>
              )}
              {contacts?.map((c) => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate({ to: "/contacts/$contactId", params: { contactId: c.id } })}>
                  <TableCell>
                    <div className="font-medium">{c.display_name}</div>
                    {c.company_name && <div className="text-xs text-muted-foreground">{c.company_name}</div>}
                  </TableCell>
                  <TableCell><Badge variant="secondary" className="capitalize">{c.kind}</Badge></TableCell>
                  <TableCell className="text-sm">{c.email ?? "—"}</TableCell>
                  <TableCell className="text-sm">{c.phone ?? "—"}</TableCell>
                  <TableCell className="text-xs">
                    {c.qbo_customer_id || c.qbo_vendor_id ? (
                      <span className="text-muted-foreground">Synced</span>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={syncingId === c.id}
                        onClick={(e) => { e.stopPropagation(); syncContact(c.id); }}
                      >
                        {syncingId === c.id ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3 mr-1" />
                        )}
                        Sync
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function ContactDialog({ onSubmit, loading }: { onSubmit: (v: Partial<Contact> & { display_name: string; kind: Contact["kind"] }) => void; loading: boolean }) {
  const [form, setForm] = useState({ display_name: "", kind: "seller" as Contact["kind"], company_name: "", email: "", phone: "", notes: "" });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>New contact</DialogTitle></DialogHeader>
      <form
        className="space-y-3"
        onSubmit={(e) => { e.preventDefault(); onSubmit({ ...form }); }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1 col-span-2">
            <Label>Display name</Label>
            <Input required value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Kind</Label>
            <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as Contact["kind"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="seller">Seller (vendor)</SelectItem>
                <SelectItem value="buyer">Buyer (customer)</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Company</Label>
            <Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="space-y-1 col-span-2">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={loading}>{loading ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
