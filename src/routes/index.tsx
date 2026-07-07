import { createFileRoute, Link } from "@tanstack/react-router";
import { Radio, Users, ShieldCheck, Languages, Accessibility, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <main id="main-content" className="min-h-screen gradient-pitch">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
            <img src="/logo.ico" alt="Logo" className="h-full w-full" />
          </div>
          <span className="text-lg font-semibold tracking-tight">PitchOps</span>
        </div>
        <nav aria-label="Primary">
          <Link
            to="/auth"
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            Sign in
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-4xl px-6 pb-16 pt-10 text-center">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
          FIFA World Cup 2026 · Smart Stadiums & Tournament Operations
        </p>
        <h1 className="text-balance text-5xl font-bold leading-tight tracking-tight sm:text-6xl">
          The GenAI copilot for <span className="text-primary text-glow">every seat in the stadium</span>.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
          One assistant, three roles. Fans get multilingual navigation and accessibility support.
          Volunteers triage incidents with SOP guidance. Ops teams see live crowd flow and get
          Gemini-powered decision recommendations in real time.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/auth"
            className="rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            Enter the stadium
          </Link>
          <a
            href="#tracks"
            className="rounded-md border border-border bg-card/60 px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-card"
          >
            See how it works
          </a>
        </div>
      </section>

      <section
        id="tracks"
        aria-labelledby="tracks-heading"
        className="mx-auto max-w-6xl px-6 pb-16"
      >
        <h2 id="tracks-heading" className="mb-8 text-center text-2xl font-semibold">
          Every challenge track, one platform
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {tracks.map((t) => (
            <article
              key={t.title}
              className="rounded-xl border border-border bg-card p-6 shadow-sm"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <t.icon className="h-5 w-5" aria-hidden />
              </div>
              <h3 className="text-lg font-semibold">{t.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t.body}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/50 py-6 text-center text-xs text-muted-foreground">
        Built with Google Gemini via Lovable AI Gateway · Google Maps Platform ready · WCAG 2.2 AA
      </footer>
    </main>
  );
}

const tracks = [
  {
    icon: Radio,
    title: "Real-time decision support",
    body: "Live venue telemetry streams into a Gemini-powered ops brief with prioritized recommendations you can act on in seconds.",
  },
  {
    icon: Users,
    title: "Dynamic crowd management",
    body: "Section-level occupancy, ingress, egress and gate wait times feed a heatmap and adaptive routing for the least-congested paths.",
  },
  {
    icon: Languages,
    title: "Multilingual assistance",
    body: "Fans chat in seven languages. Staff compose PA broadcasts once and get calm, urgent, or celebratory tones auto-translated.",
  },
  {
    icon: Accessibility,
    title: "Accessibility-first",
    body: "Wheelchair routing, sensory-quiet zones, large-text mode, ARIA live regions, and reduced-motion respect throughout.",
  },
  {
    icon: ShieldCheck,
    title: "Volunteer & staff console",
    body: "One-tap incident reports with AI classification, SOP retrieval, and role-scoped Kanban triage for the ops team.",
  },
  {
    icon: Sparkles,
    title: "Operational intelligence",
    body: "Sustainability KPIs (energy · water · waste · transit split) summarized by Gemini into plain-language weekly trends.",
  },
];
