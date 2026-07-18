export interface Venue {
  id: string;
  name: string;
  city: string;
  country: string;
  capacity: number;
  latitude: number;
  longitude: number;
  created_at: string;
}

export interface Section {
  id: string;
  venue_id: string;
  label: string;
  tier: string;
  capacity: number;
  accessible: boolean;
  nearest_gate: string;
  created_at: string;
}

export interface Metric {
  id: string;
  section_id: string;
  occupancy_pct: number;
  ingress_rate: number;
  egress_rate: number;
  gate_wait_s: number;
  updated_at: string;
}

export interface Incident {
  id: string;
  venue_id: string;
  section_id: string | null;
  kind: string;
  severity: string;
  status: string;
  reporter_id: string | null;
  assignee_id: string | null;
  description: string;
  ai_classification: {
    kind: string;
    severity: string;
    priority_reason: string;
  } | null;
  created_at: string;
  updated_at: string;
}

export interface SopRow {
  id: string;
  kind: string;
  title: string;
  body: string;
  escalation: string;
  created_at: string;
}

export interface Broadcast {
  id: string;
  author_id: string | null;
  source_text: string;
  tone: string;
  translations: Record<string, string>;
  created_at: string;
}
