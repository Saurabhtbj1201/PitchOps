import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { executeTranslateBroadcast } from "./broadcast.logic";

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

    return executeTranslateBroadcast(data, context);
  });
