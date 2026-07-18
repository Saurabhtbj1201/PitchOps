import { generateText } from "ai";
import { createGeminiProvider, DEFAULT_CHAT_MODEL } from "@/lib/ai-gateway.server";
import { SupabaseClient } from "@supabase/supabase-js";

export interface GenerateOpsBriefData {
  venueId: string;
}

interface MetricWithSection {
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
}

interface IncidentRow {
  kind: string;
  severity: string;
  status: string;
  description: string;
  created_at: string;
}

export async function executeGenerateOpsBrief(
  data: GenerateOpsBriefData,
  context: { supabase: SupabaseClient; userId: string },
) {
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

  const metricsSummary = ((metrics as unknown as MetricWithSection[]) ?? [])
    .map(
      (m: MetricWithSection) =>
        `- Section ${m.sections?.label} (${m.sections?.tier}, ${m.sections?.nearest_gate}${m.sections?.accessible ? ", accessible" : ""}): occupancy ${m.occupancy_pct}%, ingress ${m.ingress_rate}/min, egress ${m.egress_rate}/min, gate wait ${m.gate_wait_s}s`,
    )
    .join("\n");

  const incidentsSummary =
    ((incidents as unknown as IncidentRow[]) ?? []).length === 0
      ? "No open incidents."
      : ((incidents as unknown as IncidentRow[]) ?? [])
          .map(
            (i: IncidentRow) =>
              `- [${i.severity}] ${i.kind}: ${i.description} (status: ${i.status})`,
          )
          .join("\n");

  const avgOccupancy = ((metrics as unknown as MetricWithSection[]) ?? []).length
    ? Math.round(
        ((metrics as unknown as MetricWithSection[]) ?? []).reduce(
          (s: number, m: MetricWithSection) => s + m.occupancy_pct,
          0,
        ) / ((metrics as unknown as MetricWithSection[]) ?? []).length,
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
  } catch (err) {
    console.warn("Failed to parse Gemini ops brief JSON", err);
    return {
      summary: text,
      risks: [] as string[],
      recommendations: [] as { action: string; why: string; priority: string }[],
    };
  }
}
