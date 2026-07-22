import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link2, Loader2, Unlink, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { startQboAuth, disconnectQbo, getQboConnectionStatus } from "@/lib/qbo/qbo.functions";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Dealership Manager" },
      { name: "description", content: "Connect QuickBooks Online and manage integrations." },
    ],
  }),
  component: SettingsPage,
});

function useQboStatus() {
  const fetchStatus = useServerFn(getQboConnectionStatus);
  return useQuery({
    queryKey: ["qbo-status"],
    queryFn: () => fetchStatus(),
  });
}

function SettingsPage() {
  const queryClient = useQueryClient();
  const { data: status, isLoading, isFetching, refetch } = useQboStatus();
  const startAuth = useServerFn(startQboAuth);
  const disconnect = useServerFn(disconnectQbo);

  const url = typeof window !== "undefined" ? new URL(window.location.href) : null;
  const qboError = url?.searchParams.get("error");
  const qboMessage = url?.searchParams.get("message");
  const qboConnected = url?.searchParams.get("qbo") === "connected";

  async function connectQbo() {
    try {
      const { url } = await startAuth({ data: { returnUrl: "/settings" } });
      // Open in a new tab — Intuit blocks framing (X-Frame-Options: deny),
      // which shows as a grey screen if navigated in-place inside any iframe.
      const opened = window.open(url, "_blank", "noopener,noreferrer");
      if (!opened) {
        try {
          window.top!.location.href = url;
        } catch {
          window.location.href = url;
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start QuickBooks connection");
    }
  }


  async function handleDisconnect() {
    try {
      await disconnect();
      await queryClient.invalidateQueries({ queryKey: ["qbo-status"] });
      toast.success("Disconnected from QuickBooks");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to disconnect");
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <header>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Integrations and account settings.</p>
      </header>

      {qboConnected && (
        <div className="rounded-md border border-green-200 bg-green-50 dark:bg-green-950/30 p-3 flex items-start gap-3 text-sm">
          <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
          <div>
            <p className="font-medium text-green-800 dark:text-green-200">QuickBooks connected</p>
            <p className="text-green-700/80 dark:text-green-300/80">Realm ID: {url?.searchParams.get("realm")}</p>
          </div>
        </div>
      )}

      {qboError && !qboConnected && (
        <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950/30 p-3 flex items-start gap-3 text-sm">
          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
          <div>
            <p className="font-medium text-red-800 dark:text-red-200">QuickBooks connection failed</p>
            <p className="text-red-700/80 dark:text-red-300/80">{qboMessage || qboError}</p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="h-4 w-4" /> QuickBooks Online
          </CardTitle>
          <CardDescription>
            Sync sellers as vendors, buyers as customers, and post bills and invoices from each case into QBO.
            Payments are recorded in QBO and reflected back here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking connection…
            </div>
          ) : status?.connected ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="capitalize">{status.environment}</Badge>
                <span className="text-sm text-muted-foreground">Realm ID: {status.realmId}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                Access token expires {new Date(status.accessTokenExpiresAt).toLocaleString()}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} /> Refresh status
                </Button>
                <Button variant="destructive" onClick={handleDisconnect}>
                  <Unlink className="h-4 w-4 mr-2" /> Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-md border p-3 text-sm text-muted-foreground">
                Not connected. Click below to authorize this app to access your QuickBooks Online company.
                You’ll be redirected to Intuit to sign in and approve access.
              </div>
              <Button onClick={connectQbo}>
                <Link2 className="h-4 w-4 mr-2" /> Connect QuickBooks
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
