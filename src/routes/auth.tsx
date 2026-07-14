import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — PitchOps" },
      { name: "description", content: "Sign in to your PitchOps stadium operations account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

// ─── PKCE helpers ────────────────────────────────────────────────────────────

/** Generate a cryptographically random code verifier (RFC 7636 §4.1) */
async function generateCodeVerifier(): Promise<string> {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/** Derive the code challenge from the verifier using S256 (SHA-256 + base64url) */
async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

// ─── Component ───────────────────────────────────────────────────────────────

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const callbackHandled = useRef(false);

  // ── Redirect if already signed in ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/fan" });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") navigate({ to: "/fan" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  // ── Handle Google OAuth callback (code in URL) ──
  useEffect(() => {
    if (callbackHandled.current) return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const oauthError = params.get("error");
    const oauthErrorDesc = params.get("error_description");

    // Remove OAuth params from the URL immediately (clean up address bar)
    if (code || oauthError) {
      window.history.replaceState({}, "", "/auth");
    }

    if (oauthError) {
      toast.error(`Google sign-in error: ${oauthErrorDesc ?? oauthError}`);
      return;
    }

    if (!code) return;

    callbackHandled.current = true;
    const codeVerifier = sessionStorage.getItem("google_pkce_verifier");
    sessionStorage.removeItem("google_pkce_verifier");

    if (!codeVerifier) {
      toast.error("OAuth session expired. Please try signing in again.");
      return;
    }

    setBusy(true);

    // Step 1: Exchange authorization code for Google tokens (server-side, secret stays hidden)
    fetch("/api/auth/google/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        code_verifier: codeVerifier,
        redirect_uri: window.location.origin + "/auth",
      }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Token exchange failed");
        return data as { id_token: string; access_token: string };
      })
      .then(async ({ id_token, access_token }) => {
        // Step 2: Bridge the Google ID token into a Supabase session.
        // This is needed so Supabase RLS policies (auth.uid()) continue to work.
        // Requires Google provider to be enabled in Supabase with your Client ID.
        const { error } = await supabase.auth.signInWithIdToken({
          provider: "google",
          token: id_token,
          access_token,
        });
        if (error) throw error;
        // onAuthStateChange above will navigate to /fan
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Sign-in failed";
        toast.error(msg);
        setBusy(false);
      });
  }, []);

  // ── Email / password auth ──
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName || email.split("@")[0] } },
        });
        if (error) throw error;
        toast.success("Account created. You are signed in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  /**
   * Direct Google OAuth 2.0 — PKCE (Authorization Code + S256 challenge).
   *
   * Flow:
   *   1. Generate code_verifier (random) + code_challenge (SHA-256 of verifier)
   *   2. Store verifier in sessionStorage for the callback
   *   3. Redirect browser to Google's authorization endpoint
   *   4. Google redirects back to /auth?code=...
   *   5. The useEffect above catches the code, calls /api/auth/google/exchange,
   *      gets id_token, then signs into Supabase via signInWithIdToken.
   *
   * The Client Secret never touches the browser — it is only used server-side
   * in /api/auth/google/exchange.ts.
   */
  const signInWithGoogle = async () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
    if (!clientId) {
      toast.error("VITE_GOOGLE_CLIENT_ID is not set in .env");
      return;
    }
    setBusy(true);
    try {
      const codeVerifier = await generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);

      // Persist verifier for the callback (sessionStorage survives the redirect)
      sessionStorage.setItem("google_pkce_verifier", codeVerifier);

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: window.location.origin + "/auth",
        response_type: "code",
        scope: "openid email profile",
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        access_type: "offline",
        prompt: "consent",
      });

      // Navigate the browser to Google — the redirect will bring us back to /auth?code=...
      window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start Google sign-in");
      setBusy(false);
    }
  };

  return (
    <main
      id="main-content"
      className="flex min-h-screen items-center justify-center gradient-pitch px-4 py-12"
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-xl">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back home
        </Link>
        <h1 className="text-2xl font-semibold">
          {mode === "signin" ? "Sign in to PitchOps" : "Create your PitchOps account"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "signin"
            ? "Welcome back. Enter the stadium."
            : "Fans get instant access. Staff & ops roles are granted by an admin."}
        </p>

        {/* Google OAuth — Direct PKCE flow, no Supabase OAuth proxy */}
        <button
          id="google-signin-btn"
          type="button"
          onClick={signInWithGoogle}
          disabled={busy}
          className="mt-6 flex w-full items-center justify-center gap-3 rounded-md border border-border bg-background px-4 py-2.5 text-sm font-medium transition hover:bg-accent disabled:opacity-60"
          aria-label="Continue with Google"
        >
          <GoogleIcon />
          {busy ? "Redirecting to Google…" : "Continue with Google"}
        </button>

        <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          or
          <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" && (
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Display name</span>
              <input
                id="auth-display-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none"
                autoComplete="name"
              />
            </label>
          )}
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Email</span>
            <input
              id="auth-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none"
              autoComplete="email"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Password</span>
            <input
              id="auth-password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
          </label>
          <button
            id="auth-submit-btn"
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="font-medium text-primary hover:underline"
          >
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
