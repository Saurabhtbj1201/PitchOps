import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { executeCreateIncident, executeUpdateIncidentStatus } from "./incidents.logic";

const CreateInput = z.object({
  venueId: z.string().uuid(),
  sectionId: z.string().uuid().nullable().optional(),
  description: z.string().min(3).max(1000),
});

export const createIncident = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => CreateInput.parse(data))
  .handler(async ({ data, context }) => {
    return executeCreateIncident(data, context);
  });

const UpdateInput = z.object({
  id: z.string().uuid(),
  status: z.enum(["new", "dispatched", "in_progress", "resolved"]),
});

export const updateIncidentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => UpdateInput.parse(data))
  .handler(async ({ data, context }) => {
    return executeUpdateIncidentStatus(data, context);
  });
