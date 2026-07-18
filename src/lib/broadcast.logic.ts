import { generateText } from "ai";
import { createGeminiProvider, DEFAULT_CHAT_MODEL } from "@/lib/ai-gateway.server";
import { LANGUAGE_NAMES } from "@/lib/languages";

import { SupabaseClient } from "@supabase/supabase-js";

export interface TranslateBroadcastData {
  text: string;
  targets: string[];
  tone: "calm" | "urgent" | "celebratory";
}

export async function executeTranslateBroadcast(
  data: TranslateBroadcastData,
  context: { supabase: SupabaseClient; userId: string },
) {
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
  } catch (err) {
    console.warn("Failed to parse translations JSON", err);
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
}
