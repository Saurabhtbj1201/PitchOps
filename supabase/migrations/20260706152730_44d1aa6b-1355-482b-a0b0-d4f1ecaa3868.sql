
-- Roles
CREATE TYPE public.app_role AS ENUM ('fan', 'volunteer', 'ops');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'ops'));

-- Profiles
CREATE TABLE public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  language TEXT NOT NULL DEFAULT 'en',
  accessibility_prefs JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own profile" ON public.profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Handle new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'fan') ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Venues
CREATE TABLE public.venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  capacity INT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.venues TO authenticated;
GRANT ALL ON public.venues TO service_role;
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read venues" ON public.venues FOR SELECT TO authenticated USING (true);

-- Sections
CREATE TABLE public.sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  tier TEXT NOT NULL,
  capacity INT NOT NULL,
  accessible BOOLEAN NOT NULL DEFAULT false,
  nearest_gate TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sections TO authenticated;
GRANT ALL ON public.sections TO service_role;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read sections" ON public.sections FOR SELECT TO authenticated USING (true);

-- Venue metrics
CREATE TABLE public.venue_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  occupancy_pct INT NOT NULL,
  ingress_rate INT NOT NULL,
  egress_rate INT NOT NULL,
  gate_wait_s INT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (section_id)
);
GRANT SELECT ON public.venue_metrics TO authenticated;
GRANT ALL ON public.venue_metrics TO service_role;
ALTER TABLE public.venue_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read metrics" ON public.venue_metrics FOR SELECT TO authenticated USING (true);
CREATE POLICY "ops write metrics" ON public.venue_metrics FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'ops'))
  WITH CHECK (public.has_role(auth.uid(), 'ops'));

-- Incidents
CREATE TABLE public.incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.sections(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'new',
  reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  ai_classification JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.incidents TO authenticated;
GRANT ALL ON public.incidents TO service_role;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff and ops read incidents" ON public.incidents FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'volunteer') OR public.has_role(auth.uid(), 'ops') OR reporter_id = auth.uid());
CREATE POLICY "staff and ops create incidents" ON public.incidents FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'volunteer') OR public.has_role(auth.uid(), 'ops') OR reporter_id = auth.uid());
CREATE POLICY "staff and ops update incidents" ON public.incidents FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'volunteer') OR public.has_role(auth.uid(), 'ops'));

-- SOPs
CREATE TABLE public.sops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  escalation TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sops TO authenticated;
GRANT ALL ON public.sops TO service_role;
ALTER TABLE public.sops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read sops" ON public.sops FOR SELECT TO authenticated USING (true);

-- Broadcasts
CREATE TABLE public.broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  source_text TEXT NOT NULL,
  tone TEXT NOT NULL DEFAULT 'calm',
  translations JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.broadcasts TO authenticated;
GRANT ALL ON public.broadcasts TO service_role;
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read broadcasts" ON public.broadcasts FOR SELECT TO authenticated USING (true);
CREATE POLICY "ops write broadcasts" ON public.broadcasts FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'ops') AND author_id = auth.uid());

-- Chat threads & messages
CREATE TABLE public.chat_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_context TEXT NOT NULL,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_threads TO authenticated;
GRANT ALL ON public.chat_threads TO service_role;
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own threads" ON public.chat_threads FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Seed venues + sections + SOPs
INSERT INTO public.venues (id, name, city, country, capacity, latitude, longitude) VALUES
  ('11111111-1111-1111-1111-111111111111', 'MetLife Stadium', 'East Rutherford', 'USA', 82500, 40.8135, -74.0745),
  ('22222222-2222-2222-2222-222222222222', 'Estadio Azteca', 'Mexico City', 'Mexico', 87000, 19.3029, -99.1505);

INSERT INTO public.sections (venue_id, label, tier, capacity, accessible, nearest_gate) VALUES
  ('11111111-1111-1111-1111-111111111111', '101', 'Lower', 3200, true, 'Gate A'),
  ('11111111-1111-1111-1111-111111111111', '112', 'Lower', 3100, false, 'Gate B'),
  ('11111111-1111-1111-1111-111111111111', '215', 'Mezzanine', 2800, false, 'Gate C'),
  ('11111111-1111-1111-1111-111111111111', '330', 'Upper', 2600, true, 'Gate D'),
  ('22222222-2222-2222-2222-222222222222', 'A1', 'Lower', 3400, true, 'Puerta 1'),
  ('22222222-2222-2222-2222-222222222222', 'B2', 'Mezzanine', 2900, false, 'Puerta 2'),
  ('22222222-2222-2222-2222-222222222222', 'C3', 'Upper', 2700, true, 'Puerta 3');

INSERT INTO public.sops (kind, title, body, escalation) VALUES
  ('medical', 'Fan Fainted / Unconscious', 'Clear a 2m radius. Send closest medical team to the section. Do not move the fan unless danger. Note section, seat, and time. Keep companions calm.', 'Medical Ops Lead + Section Marshal'),
  ('crowd', 'Gate Overcrowding (>85% wait time)', 'Open overflow lane at the neighboring gate. Broadcast rerouting message in local + English. Deploy 2 volunteers to redirect flow. Slow ticket scanning temporarily.', 'Crowd Ops Lead'),
  ('lost_child', 'Lost Child Report', 'Take child to nearest Family Meeting Point. Record description + location last seen. Broadcast to all marshals via radio. Never leave the child alone.', 'Safeguarding Lead'),
  ('accessibility', 'Wheelchair Route Blocked', 'Identify the blockage. Redirect fan via nearest accessible concourse. Log a facilities ticket to clear the route.', 'Accessibility Lead'),
  ('weather', 'Severe Weather Warning', 'Suspend outdoor queueing. Move fans into covered concourses. Broadcast calm shelter-in-place message. Monitor forecast every 5 minutes.', 'Venue Duty Manager'),
  ('security', 'Suspicious Package', 'Do not approach. Clear a 30m radius. Notify security immediately with exact location. Preserve calm — do not announce publicly until cleared.', 'Head of Security');

-- Seed initial metrics per section (safe starting values)
INSERT INTO public.venue_metrics (section_id, occupancy_pct, ingress_rate, egress_rate, gate_wait_s)
SELECT id, 45, 12, 2, 90 FROM public.sections;

-- Enable realtime for metrics + incidents
ALTER PUBLICATION supabase_realtime ADD TABLE public.venue_metrics;
ALTER PUBLICATION supabase_realtime ADD TABLE public.incidents;
