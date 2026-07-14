import { useMemo } from "react";

type Section = {
  id: string;
  label: string;
  tier: string;
  accessible: boolean;
  nearest_gate: string;
};

type Metric = { section_id: string; occupancy_pct: number; gate_wait_s?: number };

export function StadiumMap({
  sections,
  metrics,
  highlightedSectionId,
  onSelect,
}: {
  sections: Section[];
  metrics: Metric[];
  highlightedSectionId?: string;
  onSelect?: (id: string) => void;
}) {
  const byId = useMemo(() => new Map(metrics.map((m) => [m.section_id, m])), [metrics]);

  const positions = useMemo(() => {
    const n = sections.length || 1;
    return sections.map((s, i) => {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      const rx = 170;
      const ry = 110;
      return {
        section: s,
        cx: 250 + rx * Math.cos(angle),
        cy: 150 + ry * Math.sin(angle),
      };
    });
  }, [sections]);

  const color = (pct: number) => {
    if (pct >= 85) return "var(--color-destructive)";
    if (pct >= 65) return "var(--color-warning)";
    return "var(--color-success)";
  };

  return (
    <svg
      viewBox="0 0 500 300"
      role="img"
      aria-label="Stadium section map showing live occupancy for each section"
      className="mt-2 h-64 w-full"
    >
      <title>Stadium map</title>
      <desc>Green sections are below 65% occupancy, amber up to 85%, red above 85%.</desc>
      <ellipse cx="250" cy="150" rx="200" ry="130" fill="var(--color-secondary)" opacity="0.4" />
      <rect
        x="200"
        y="120"
        width="100"
        height="60"
        rx="4"
        fill="var(--color-success)"
        opacity="0.55"
      />
      <text x="250" y="155" textAnchor="middle" fill="currentColor" fontSize="12" opacity="0.7">
        PITCH
      </text>
      {positions.map(({ section, cx, cy }) => {
        const m = byId.get(section.id);
        const pct = m?.occupancy_pct ?? 40;
        const active = section.id === highlightedSectionId;
        return (
          <g
            key={section.id}
            transform={`translate(${cx - 22} ${cy - 14})`}
            onClick={() => onSelect?.(section.id)}
            style={{ cursor: onSelect ? "pointer" : "default" }}
          >
            <rect
              width="44"
              height="28"
              rx="6"
              fill={color(pct)}
              opacity={active ? 1 : 0.85}
              stroke={active ? "var(--color-primary)" : "none"}
              strokeWidth={active ? 2.5 : 0}
            />
            <text
              x="22"
              y="13"
              textAnchor="middle"
              fill="var(--color-primary-foreground)"
              fontSize="10"
              fontWeight="700"
            >
              {section.label}
            </text>
            <text
              x="22"
              y="24"
              textAnchor="middle"
              fill="var(--color-primary-foreground)"
              fontSize="8"
            >
              {pct}%
            </text>
            {section.accessible && <circle cx="40" cy="4" r="4" fill="var(--color-primary)" />}
          </g>
        );
      })}
    </svg>
  );
}
