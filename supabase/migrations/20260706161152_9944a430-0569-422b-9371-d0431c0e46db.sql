
DROP POLICY IF EXISTS "authenticated read broadcasts" ON public.broadcasts;
CREATE POLICY "volunteer or ops read broadcasts" ON public.broadcasts FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'volunteer'::app_role) OR public.has_role(auth.uid(), 'ops'::app_role));

DROP POLICY IF EXISTS "authenticated read sections" ON public.sections;
CREATE POLICY "volunteer or ops read sections" ON public.sections FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'volunteer'::app_role) OR public.has_role(auth.uid(), 'ops'::app_role));

DROP POLICY IF EXISTS "authenticated read venues" ON public.venues;
CREATE POLICY "volunteer or ops read venues" ON public.venues FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'volunteer'::app_role) OR public.has_role(auth.uid(), 'ops'::app_role));

DROP POLICY IF EXISTS "authenticated read sops" ON public.sops;
CREATE POLICY "ops read sops" ON public.sops FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'ops'::app_role));

DROP POLICY IF EXISTS "authenticated read metrics" ON public.venue_metrics;
CREATE POLICY "ops read metrics" ON public.venue_metrics FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'ops'::app_role));

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND _user_id = auth.uid()
  )
$$;
