import { createFileRoute } from "@tanstack/react-router";
import { exchangeQboCode, verifyOAuthState, tokenRowFromResponse } from "@/lib/qbo/qbo.server";

export const Route = createFileRoute("/api/public/qbo/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const realmId = url.searchParams.get("realmId");
        const error = url.searchParams.get("error");
        const errorDescription = url.searchParams.get("error_description") || "";

        if (error) {
          return redirectToSettings(`error=${encodeURIComponent(error)}&message=${encodeURIComponent(errorDescription)}`);
        }
        if (!code || !state || !realmId) {
          return redirectToSettings("error=missing_params&message=OAuth callback was missing required parameters");
        }

        let returnUrl: string;
        let userId: string;
        try {
          const payload = verifyOAuthState(state);
          userId = payload.userId;
          returnUrl = payload.returnUrl;
        } catch (err) {
          console.error("QBO callback state verification failed", err);
          return redirectToSettings("error=invalid_state&message=OAuth state verification failed");
        }

        try {
          const tokenResponse = await exchangeQboCode(code);
          const row = tokenRowFromResponse(userId, realmId, tokenResponse);

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error: upsertError } = await supabaseAdmin
            .from("qbo_tokens")
            .upsert(row, { onConflict: "user_id" });

          if (upsertError) {
            console.error("Failed to save QBO tokens", upsertError);
            return redirectToSettings("error=save_failed&message=Failed to save QuickBooks connection");
          }

          return Response.redirect(`${returnUrl}?qbo=connected&realm=${encodeURIComponent(realmId)}`, 302);
        } catch (err) {
          console.error("QBO token exchange failed", err);
          const message = err instanceof Error ? err.message : "Token exchange failed";
          return redirectToSettings(`error=token_exchange&message=${encodeURIComponent(message)}`);
        }
      },
    },
  },
});

function redirectToSettings(query: string): Response {
  return Response.redirect(`/settings?${query}`, 302);
}
