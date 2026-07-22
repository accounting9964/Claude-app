import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type Party = "seller" | "buyer";

type Row = {
  id: string;
  display_name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  case_count: number;
  open_count: number;
  last_activity: string | null;
};

export function ContactPartyList({ party, title, description }: { party: Party; title: string; description: string }) {
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["party-list", party],
    queryFn: async () => {
      const { data: contacts, error } = await supabase
        .from("contacts")
        .select("id, display_name, company_name, email, phone, kind")
        .in("kind", [party, "both"])
        .order("display_name", { ascending: true });
      if (error) throw error;

      const idField = party === "seller" ? "seller_id" : "buyer_id";
      const { data: cases, error: e2 } = await supabase
        .from("cases")
        .select(`id, ${idField}, closed_at:sale_date, updated_at, sale_is_final`);
      if (e2) throw e2;

      const byContact = new Map<string, { total: number; open: number; last: string | null }>();
      for (const c of cases ?? []) {
        const cid = (c as any)[idField] as string | null;
        if (!cid) continue;
        const cur = byContact.get(cid) ?? { total: 0, open: 0, last: null };
        cur.total += 1;
        // "open" = sale not final yet
        if (!(c as any).sale_is_final) cur.open += 1;
        const upd = (c as any).updated_at as string | null;
        if (upd && (!cur.last || upd > cur.last)) cur.last = upd;
        byContact.set(cid, cur);
      }

      const rows: Row[] = (contacts ?? []).map((c: any) => {
        const agg = byContact.get(c.id);
        return {
          id: c.id,
          display_name: c.display_name,
          company_name: c.company_name,
          email: c.email,
          phone: c.phone,
          case_count: agg?.total ?? 0,
          open_count: agg?.open ?? 0,
          last_activity: agg?.last ?? null,
        };
      });
      return rows;
    },
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return data ?? [];
    return (data ?? []).filter((r) =>
      [r.display_name, r.company_name, r.email, r.phone].filter(Boolean).join(" ").toLowerCase().includes(s)
    );
  }, [data, q]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <CardTitle className="text-base">All {title.toLowerCase()}</CardTitle>
          <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Cases</TableHead>
                <TableHead className="text-right">Open</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Last activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={5}>Loading…</TableCell></TableRow>}
              {!isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No {title.toLowerCase()} yet.</TableCell></TableRow>
              )}
              {filtered.map((r) => (
                <TableRow key={r.id} className="hover:bg-muted/50">
                  <TableCell>
                    <Link to="/contacts/$contactId" params={{ contactId: r.id }} className="font-medium hover:underline">
                      {r.display_name}
                    </Link>
                    {r.company_name && <div className="text-xs text-muted-foreground">{r.company_name}</div>}
                  </TableCell>
                  <TableCell className="text-right">{r.case_count}</TableCell>
                  <TableCell className="text-right">
                    {r.open_count > 0 ? <Badge variant="secondary">{r.open_count}</Badge> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.email ?? r.phone ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.last_activity ? new Date(r.last_activity).toLocaleDateString() : "—"}
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
