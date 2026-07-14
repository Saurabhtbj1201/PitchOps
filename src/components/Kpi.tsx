import React from "react";

export function Kpi({
  label,
  value,
  accent,
  compact,
}: {
  label: string;
  value: string;
  accent?: "ok" | "warn";
  compact?: boolean;
}) {
  return (
    <div
      className={
        "rounded-xl border border-border bg-card " +
        (compact ? "p-2" : "p-4") +
        (accent === "warn" ? " ring-2 ring-warning/40" : "")
      }
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={"mt-0.5 font-bold " + (compact ? "text-lg" : "text-2xl")}>{value}</div>
    </div>
  );
}
