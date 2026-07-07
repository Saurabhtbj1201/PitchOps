import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createGeminiProvider, DEFAULT_CHAT_MODEL } from "@/lib/ai-gateway.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CreateInput = z.object({
  venueId: z.string().uuid(),
  sectionId: z.string().uuid().nullable().optional(),
  description: z.string().min(3).max(1000),
});

export const createIncident = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CreateInput.parse(data))
  .handler(async ({ data, context }) => {
    // Ask Gemini to classify the incident into kind + severity
    const gemini = createGeminiProvider();
    const { text } = await generateText({
      model: gemini(DEFAULT_CHAT_MODEL),
      prompt: `Classify this stadium incident report. Respond with JSON only, no code fences:
{"kind": one of "medical" | "crowd" | "lost_child" | "accessibility" | "weather" | "security" | "other",
 "severity": one of "low" | "medium" | "high" | "critical",
 "priority_reason": "one sentence"}

Report: """${data.description}"""`,
    });

    const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
    let classification: { kind: string; severity: string; priority_reason: string } = {
      kind: "other",
      severity: "medium",
      priority_reason: "Auto-classified fallback.",
    };
    try {
      classification = JSON.parse(trimmed);
    } catch {}

    const { data: inserted, error } = await context.supabase
      .from("incidents")
      .insert({
        venue_id: data.venueId,
        section_id: data.sectionId ?? null,
        kind: classification.kind,
        severity: classification.severity,
        status: "new",
        reporter_id: context.userId,
        description: data.description,
        ai_classification: classification,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return inserted;
  });

const UpdateInput = z.object({
  id: z.string().uuid(),
  status: z.enum(["new", "dispatched", "in_progress", "resolved"]),
});

export const updateIncidentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => UpdateInput.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("incidents")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
