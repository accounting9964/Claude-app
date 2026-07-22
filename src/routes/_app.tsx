import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useSession } from "@/hooks/use-session";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Car, LayoutDashboard, FileText, Users, Wallet, BarChart3, Settings, LogOut, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCaseName } from "@/lib/case-name";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

const nav: { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/cases", label: "Cases", icon: FileText },
  { to: "/contacts", label: "Contacts", icon: Users },
  { to: "/finance", label: "Finance", icon: Wallet },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

function AppLayout() {
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const { data: results } = useQuery({
    queryKey: ["global-search", q],
    enabled: q.trim().length > 1,
    queryFn: async () => {
      const [cases, contacts] = await Promise.all([
        supabase
          .from("cases")
          .select("id, vehicles(year,make,model,vin)")
          .or(`vehicles.vin.ilike.%${q}%`)
          .limit(8),
        supabase.from("contacts").select("id,display_name,kind").ilike("display_name", `%${q}%`).limit(8),
      ]);
      return { cases: cases.data ?? [], contacts: contacts.data ?? [] };
    },
  });

  if (loading || !session) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen flex bg-muted/20">
      <Toaster />
      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <CommandInput placeholder="Search cases by VIN, contacts by name…" value={q} onValueChange={setQ} />
        <CommandList>
          <CommandEmpty>{q.trim().length > 1 ? "No results." : "Type to search."}</CommandEmpty>
          {!!results?.cases.length && (
            <CommandGroup heading="Cases">
              {results.cases.map((c: any) => (
                <CommandItem
                  key={c.id}
                  onSelect={() => {
                    setSearchOpen(false);
                    navigate({ to: "/cases/$caseId", params: { caseId: c.id } });
                  }}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  {formatCaseName(c.vehicles)}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {!!results?.contacts.length && (
            <CommandGroup heading="Contacts">
              {results.contacts.map((c: any) => (
                <CommandItem
                  key={c.id}
                  onSelect={() => {
                    setSearchOpen(false);
                    navigate({ to: "/contacts/$contactId", params: { contactId: c.id } });
                  }}
                >
                  <Users className="h-4 w-4 mr-2" />
                  {c.display_name}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>

      <aside className="w-60 border-r bg-background flex flex-col shrink-0">
        <div className="h-14 flex items-center gap-2 px-4 border-b">
          <Car className="h-5 w-5" />
          <span className="font-semibold">Dealership</span>
        </div>
        <button
          onClick={() => setSearchOpen(true)}
          className="mx-2 mt-2 flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground border bg-muted/40 hover:bg-muted transition-colors"
        >
          <Search className="h-3.5 w-3.5" />
          Search
          <span className="ml-auto text-[10px] border rounded px-1">⌘K</span>
        </button>
        <nav className="flex-1 p-2 space-y-1">
          {nav.map((n) => {
            const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                  active ? "bg-primary text-primary-foreground" : "hover:bg-accent text-foreground/80"
                )}
              >
                <Icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t text-xs text-muted-foreground">
          <div className="truncate mb-2">{session.user.email}</div>
          <Button size="sm" variant="outline" className="w-full" onClick={signOut}>
            <LogOut className="h-3 w-3 mr-1" /> Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
