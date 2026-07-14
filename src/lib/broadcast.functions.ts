import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createGeminiProvider, DEFAULT_CHAT_MODEL } from "@/lib/ai-gateway.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { LANGUAGE_NAMES } from "@/lib/languages";

const TranslateInput = z.object({
  text: z.string().min(1).max(2000),
  targets: z.array(z.string()).min(1).max(10),
  tone: z.enum(["calm", "urgent", "celebratory"]).default("calm"),
});

export const translateBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => TranslateInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: isOps } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "ops",
    });
    if (!isOps) throw new Error("Forbidden: ops role required");

    const langList = data.targets
      .map((code) => `${code} (${LANGUAGE_NAMES[code] ?? code})`)
      .join(", ");

    const prompt = `Translate the following stadium PA announcement into these languages: ${langList}.
Preserve meaning. Use a ${data.tone} tone (calm = reassuring, urgent = short imperative sentences, celebratory = warm and enthusiastic).
Return a JSON object mapping the language code to the translation, e.g. { "es": "…", "fr": "…" }. Respond with JSON only, no code fences.

Announcement:
"""
${data.text}
"""`;

    // Use Google Gemini directly via @ai-sdk/google
    const gemini = createGeminiProvider();
    const { text } = await generateText({
      model: gemini(DEFAULT_CHAT_MODEL),
      prompt,
    });

    const trimmed = text
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```$/, "")
      .trim();
    let translations: Record<string, string> = {};
    try {
      translations = JSON.parse(trimmed);
    } catch {
      translations = { en: data.text };
    }

    // Persist broadcast
    const { error } = await context.supabase.from("broadcasts").insert({
      author_id: context.userId,
      source_text: data.text,
      tone: data.tone,
      translations,
    });
    if (error) console.error("insert broadcast", error);

    return { translations };
  });
