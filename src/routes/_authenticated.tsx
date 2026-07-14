import {
  createFileRoute,
  Outlet,
  redirect,
  Link,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, MapPinned, Users, Radio } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [roles, setRoles] = useState<string[]>([]);
  const [displayName, setDisplayName] = useState<string>("");

  useEffect(() => {
    (async () => {
      const [{ data: r }, { data: p }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle(),
      ]);
      setRoles((r ?? []).map((row) => row.role));
      setDisplayName(p?.display_name ?? user.email ?? "");
    })();
  }, [user]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  const canStaff = roles.includes("volunteer") || roles.includes("ops");
  const canOps = roles.includes("ops");

  const nav: {
    to: "/fan" | "/staff" | "/ops";
    label: string;
    icon: typeof MapPinned;
    locked: boolean;
  }[] = [
    { to: "/fan", label: "Fan", icon: MapPinned, locked: false },
    { to: "/staff", label: "Staff", icon: Users, locked: !canStaff },
    { to: "/ops", label: "Ops", icon: Radio, locked: !canOps },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/fan" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-sm">
              P
            </div>
            <span className="font-semibold tracking-tight">PitchOps</span>
          </Link>

          <nav
            role="tablist"
            aria-label="Role"
            className="flex items-center gap-1 rounded-full border border-border bg-card p-1"
          >
            {nav.map((n) => {
              const active = pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  role="tab"
                  aria-selected={active}
                  aria-disabled={n.locked}
                  className={
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition " +
                    (active
                      ? "bg-primary text-primary-foreground"
                      : n.locked
                        ? "cursor-not-allowed text-muted-foreground opacity-50"
                        : "text-muted-foreground hover:text-foreground")
                  }
                  onClick={(e) => {
                    if (n.locked) e.preventDefault();
                  }}
                >
                  <n.icon className="h-3.5 w-3.5" aria-hidden />
                  {n.label}
                  {n.locked && <span className="sr-only">(requires elevated role)</span>}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{displayName}</span>
            <button
              type="button"
              onClick={signOut}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium transition hover:bg-accent"
              aria-label="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main id="main-content" className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
