import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createGeminiProvider, DEFAULT_CHAT_MODEL } from "@/lib/ai-gateway.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Section joined on venue_metrics query */
type MetricWithSection = {
  occupancy_pct: number;
  ingress_rate: number;
  egress_rate: number;
  gate_wait_s: number;
  sections: {
    label: string;
    tier: string;
    nearest_gate: string;
    accessible: boolean;
  } | null;
};

/** Incident row from the database */
type IncidentRow = {
  kind: string;
  severity: string;
  status: string;
  description: string;
  created_at: string;
};

const OpsBriefInput = z.object({
  venueId: z.string().uuid(),
});

// Structured Ops brief — kept as free-text JSON parsed manually to stay
// within the "no constraint-heavy schemas" rule from ai-sdk knowledge.
/**
 * Generates an AI-powered Ops Brief for the control room.
 * Synthesizes live section metrics, open incidents, and sustainability KPIs
 * into actionable risks and prioritized recommendations using Google Gemini.
 * @param {OpsBriefInput} data - The venue UUID to generate the brief for.
 * @returns A structured JSON object containing summary, risks, and recommendations.
 */
export const generateOpsBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => OpsBriefInput.parse(data))
  .handler(async ({ data, context }) => {
    // Verify caller is ops
    const { data: isOps } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "ops",
    });
    if (!isOps) throw new Error("Forbidden: ops role required");

    const [{ data: venue }, { data: metrics }, { data: incidents }] = await Promise.all([
      context.supabase.from("venues").select("*").eq("id", data.venueId).maybeSingle(),
      context.supabase
        .from("venue_metrics")
        .select("*, sections!inner(label, tier, nearest_gate, venue_id, accessible)")
        .eq("sections.venue_id", data.venueId),
      context.supabase
        .from("incidents")
        .select("kind, severity, status, description, created_at")
        .eq("venue_id", data.venueId)
        .neq("status", "resolved")
        .order("created_at", { ascending: false })
        .limit(15),
    ]);

    const metricsSummary = (metrics ?? ([] as MetricWithSection[]))
      .map(
        (m: MetricWithSection) =>
          `- Section ${m.sections?.label} (${m.sections?.tier}, ${m.sections?.nearest_gate}${m.sections?.accessible ? ", accessible" : ""}): occupancy ${m.occupancy_pct}%, ingress ${m.ingress_rate}/min, egress ${m.egress_rate}/min, gate wait ${m.gate_wait_s}s`,
      )
      .join("\n");

    const incidentsSummary =
      (incidents ?? ([] as IncidentRow[])).length === 0
        ? "No open incidents."
        : (incidents ?? ([] as IncidentRow[]))
            .map(
              (i: IncidentRow) =>
                `- [${i.severity}] ${i.kind}: ${i.description} (status: ${i.status})`,
            )
            .join("\n");

    const avgOccupancy = (metrics ?? ([] as MetricWithSection[])).length
      ? Math.round(
          (metrics ?? ([] as MetricWithSection[])).reduce(
            (s: number, m: MetricWithSection) => s + m.occupancy_pct,
            0,
          ) / (metrics ?? ([] as MetricWithSection[])).length,
        )
      : 0;

    const kpis = {
      energyKwh: 12400 + avgOccupancy * 45,
      waterM3: 380 + Math.round(avgOccupancy * 1.8),
      wasteDiversionPct: Math.max(45, 80 - Math.round(avgOccupancy / 5)),
      transitPct: 62,
    };

    const prompt = `Venue: ${venue?.name ?? "Unknown"} — ${venue?.city ?? ""}, capacity ${venue?.capacity ?? "?"}.

LIVE SECTION METRICS:
${metricsSummary || "No metrics."}

OPEN INCIDENTS:
${incidentsSummary}

SUSTAINABILITY KPIs (Estimated):
Energy Consumption: ${kpis.energyKwh} kWh
Water Usage: ${kpis.waterM3} m³
Waste Diversion: ${kpis.wasteDiversionPct}%
Transit Share: ${kpis.transitPct}%

Produce a JSON object with EXACTLY this shape:
{
  "summary": "one paragraph plain-language overview (max 3 sentences)",
  "risks": ["short risk 1", "short risk 2", ...],
  "recommendations": [
    { "action": "concrete action", "why": "specific metric/incident/sustainability KPI it is based on", "priority": "high" | "medium" | "low" }
  ]
}
Base every risk and recommendation on a specific number from the metrics, an incident, or a sustainability KPI above. For example, if energy is high, recommend mitigating action. Respond with the JSON only, no code fences.`;

    // Use Google Gemini directly via @ai-sdk/google
    const gemini = createGeminiProvider();
    const model = gemini(DEFAULT_CHAT_MODEL);

    const { text } = await generateText({
      model,
      prompt,
    });

    // Best-effort JSON parse — strip both ```json and plain ``` fences
    const trimmed = text
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```$/, "")
      .trim();
    try {
      return JSON.parse(trimmed) as {
        summary: string;
        risks: string[];
        recommendations: { action: string; why: string; priority: string }[];
      };
    } catch {
      return {
        summary: text,
        risks: [] as string[],
        recommendations: [] as { action: string; why: string; priority: string }[],
      };
    }
  });
