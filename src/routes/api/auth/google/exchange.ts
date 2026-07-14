import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/auth/google/exchange
 *
 * Server-side leg of the direct Google OAuth 2.0 PKCE flow.
 * Receives the authorization code + PKCE verifier from the browser,
 * exchanges them for tokens at Google's token endpoint using the
 * Client Secret (which never leaves the server), and returns the
 * id_token and access_token to the client.
 *
 * The client then calls supabase.auth.signInWithIdToken({ provider: 'google', token: id_token })
 * to obtain a Supabase session, enabling RLS policies to function normally.
 *
 * Required env vars (server-side only):
 *   GOOGLE_CLIENT_ID      — OAuth 2.0 Client ID
 *   GOOGLE_CLIENT_SECRET  — OAuth 2.0 Client Secret (never expose to the browser)
 */

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

type ExchangeBody = {
  code?: string;
  code_verifier?: string;
  redirect_uri?: string;
};

export const Route = createFileRoute("/api/auth/google/exchange")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as ExchangeBody;
          const { code, code_verifier, redirect_uri } = body;

          if (!code || !code_verifier || !redirect_uri) {
            return new Response(
              JSON.stringify({
                error: "Missing required fields: code, code_verifier, redirect_uri",
              }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          const clientId = process.env.GOOGLE_CLIENT_ID;
          const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

          if (!clientId || !clientSecret) {
            console.error("Google OAuth env vars missing: GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET");
            return new Response(
              JSON.stringify({ error: "Google OAuth not configured on the server." }),
              { status: 503, headers: { "Content-Type": "application/json" } },
            );
          }

          // Exchange authorization code for tokens at Google's token endpoint
          const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              code,
              client_id: clientId,
              client_secret: clientSecret,
              redirect_uri,
              grant_type: "authorization_code",
              code_verifier,
            }),
          });

          if (!tokenRes.ok) {
            const errText = await tokenRes.text();
            console.error("Google token exchange failed:", tokenRes.status, errText);
            return new Response(
              JSON.stringify({ error: "Token exchange with Google failed.", detail: errText }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          const tokens = (await tokenRes.json()) as {
            access_token: string;
            id_token: string;
            expires_in: number;
            token_type: string;
          };

          // Only return the tokens the client needs — never forward the full response
          return new Response(
            JSON.stringify({
              access_token: tokens.access_token,
              id_token: tokens.id_token,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err) {
          console.error("Google exchange route error:", err);
          const msg = err instanceof Error ? err.message : "Unknown server error";
          return new Response(JSON.stringify({ error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
