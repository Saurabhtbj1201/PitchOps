import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { executeGenerateOpsBrief } from "./ops.logic";

const OpsBriefInput = z.object({
  venueId: z.string().uuid(),
});

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

    return executeGenerateOpsBrief(data, context);
  });
