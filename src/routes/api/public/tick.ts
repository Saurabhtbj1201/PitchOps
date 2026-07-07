import { createFileRoute } from "@tanstack/react-router";

// Matchday telemetry simulator — public endpoint that jitters occupancy,
// ingress/egress rates, and gate waits for each section. Called on demand
// from the Ops "Simulate matchday tick" button so demos are reproducible.
export const Route = createFileRoute("/api/public/tick")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: metrics, error } = await supabaseAdmin
          .from("venue_metrics")
          .select("id, section_id, occupancy_pct, ingress_rate, egress_rate, gate_wait_s");
        if (error) return new Response(error.message, { status: 500 });

        const updates = (metrics ?? []).map((m) => {
          const flux = () => Math.floor(Math.random() * 11) - 5;
          const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
          return {
            id: m.id,
            section_id: m.section_id,
            occupancy_pct: clamp(m.occupancy_pct + flux(), 20, 99),
            ingress_rate: clamp(m.ingress_rate + flux(), 0, 40),
            egress_rate: clamp(m.egress_rate + flux(), 0, 25),
            gate_wait_s: clamp(m.gate_wait_s + flux() * 6, 20, 600),
            updated_at: new Date().toISOString(),
          };
        });

        for (const u of updates) {
          await supabaseAdmin.from("venue_metrics").update(u).eq("id", u.id);
        }
        return Response.json({ updated: updates.length });
      },
    },
  },
});
