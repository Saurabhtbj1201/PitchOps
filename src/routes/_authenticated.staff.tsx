import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createIncident, updateIncidentStatus } from "@/lib/incidents.functions";
import { AlertTriangle, CheckCircle2, Clock, ListTodo } from "lucide-react";

export const Route = createFileRoute("/_authenticated/staff")({
  head: () => ({
    meta: [
      { title: "Staff Console — PitchOps" },
      {
        name: "description",
        content: "Volunteer & staff incident reporting, SOP lookup, and triage.",
      },
    ],
  }),
  component: StaffPage,
});

type Incident = {
  id: string;
  kind: string;
  severity: string;
  status: string;
  description: string;
  section_id: string | null;
  created_at: string;
  ai_classification: { kind: string; severity: string; priority_reason: string } | null;
};
type SopRow = { id: string; kind: string; title: string; body: string; escalation: string };

function StaffPage() {
  const qc = useQueryClient();
  const create = useServerFn(createIncident);
  const updateStatus = useServerFn(updateIncidentStatus);

  const [venueId, setVenueId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sopKind, setSopKind] = useState("medical");

  const { data: venues } = useQuery({
    queryKey: ["venues"],
    queryFn: async () => (await supabase.from("venues").select("*").order("name")).data ?? [],
  });
  useEffect(() => {
    if (!venueId && venues?.length) setVenueId(venues[0].id);
  }, [venues, venueId]);

  const { data: sections } = useQuery({
    queryKey: ["sections", venueId],
    queryFn: async () =>
      (await supabase.from("sections").select("*").eq("venue_id", venueId).order("label")).data ??
      [],
    enabled: !!venueId,
  });

  const { data: incidents } = useQuery({
    queryKey: ["incidents", venueId],
    queryFn: async () => {
      if (!venueId) return [];
      const { data } = await supabase
        .from("incidents")
        .select("*")
        .eq("venue_id", venueId)
        .order("created_at", { ascending: false })
        .limit(30);
      return (data ?? []) as Incident[];
    },
    enabled: !!venueId,
    refetchInterval: 10000,
  });

  const { data: sops } = useQuery({
    queryKey: ["sops"],
    queryFn: async () => (await supabase.from("sops").select("*")).data ?? [],
  });
  const sop = (sops as SopRow[] | undefined)?.find((s) => s.kind === sopKind);

  useEffect(() => {
    if (!venueId) return;
    const ch = supabase
      .channel("staff_incidents_" + venueId)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "incidents", filter: `venue_id=eq.${venueId}` },
        () => qc.invalidateQueries({ queryKey: ["incidents", venueId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [venueId, qc]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !venueId) return;
    setSubmitting(true);
    try {
      await create({ data: { venueId, sectionId: sectionId || null, description } });
      toast.success("Incident logged. AI classification applied.");
      setDescription("");
      qc.invalidateQueries({ queryKey: ["incidents", venueId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to log incident");
    } finally {
      setSubmitting(false);
    }
  };

  const setStatus = async (
    id: string,
    status: "new" | "dispatched" | "in_progress" | "resolved",
  ) => {
    try {
      await updateStatus({ data: { id, status } });
      qc.invalidateQueries({ queryKey: ["incidents", venueId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
      <section aria-labelledby="report" className="space-y-4">
        <div>
          <h1 id="report" className="text-2xl font-bold tracking-tight">
            Staff console
          </h1>
          <p className="text-sm text-muted-foreground">
            Log incidents. Look up SOPs. Triage assignments.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Report an incident</h2>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Venue</span>
            <select
              value={venueId}
              onChange={(e) => setVenueId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            >
              {(venues ?? []).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Section (optional)</span>
            <select
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            >
              <option value="">— none —</option>
              {(sections ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} · {s.nearest_gate}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">What happened?</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={1000}
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              placeholder="e.g. Fan fainted in section 112, near aisle 4. Companion is with them."
            />
          </label>
          <button
            type="submit"
            disabled={submitting || !description.trim()}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {submitting ? "Classifying…" : "Log incident (AI classifies)"}
          </button>
        </form>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">SOP lookup</h2>
            <select
              value={sopKind}
              onChange={(e) => setSopKind(e.target.value)}
              className="rounded-md border border-input bg-background px-2 py-1 text-xs"
              aria-label="SOP kind"
            >
              {(sops ?? []).map((s: SopRow) => (
                <option key={s.id} value={s.kind}>
                  {s.title}
                </option>
              ))}
            </select>
          </div>
          {sop && (
            <div className="space-y-2 text-sm">
              <h3 className="font-semibold">{sop.title}</h3>
              <p className="whitespace-pre-wrap text-muted-foreground">{sop.body}</p>
              <p className="text-xs">
                <span className="font-medium">Escalate to:</span> {sop.escalation}
              </p>
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="board" className="space-y-3">
        <div className="flex items-center gap-2">
          <ListTodo className="h-5 w-5 text-primary" aria-hidden />
          <h2 id="board" className="text-lg font-semibold">
            Incident board
          </h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {(["new", "dispatched", "in_progress", "resolved"] as const).map((col) => {
            const items = (incidents ?? []).filter((i) => i.status === col);
            return (
              <div key={col} className="rounded-xl border border-border bg-card p-3">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {col.replace("_", " ")} · {items.length}
                </h3>
                <ul className="space-y-2">
                  {items.map((i) => (
                    <li
                      key={i.id}
                      className="rounded-md border border-border bg-background p-2 text-xs"
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span className="font-semibold">{i.kind}</span>
                        <SeverityBadge severity={i.severity} />
                      </div>
                      <p className="mb-2 line-clamp-3 text-muted-foreground">{i.description}</p>
                      <div className="flex flex-wrap gap-1">
                        {(["new", "dispatched", "in_progress", "resolved"] as const)
                          .filter((s) => s !== col)
                          .map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setStatus(i.id, s)}
                              className="rounded border border-border px-1.5 py-0.5 text-[10px] hover:bg-accent"
                            >
                              → {s.replace("_", " ")}
                            </button>
                          ))}
                      </div>
                    </li>
                  ))}
                  {items.length === 0 && (
                    <li className="text-xs text-muted-foreground">No items.</li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const color =
    severity === "critical"
      ? "bg-destructive text-destructive-foreground"
      : severity === "high"
        ? "bg-warning text-warning-foreground"
        : severity === "medium"
          ? "bg-accent text-accent-foreground"
          : "bg-muted text-muted-foreground";
  return (
    <span className={"rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase " + color}>
      {severity}
    </span>
  );
}
