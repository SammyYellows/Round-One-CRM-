// Sales pipeline stages, mirroring the existing GymGrow "Sales Pipeline".

export const STAGES = [
  { key: "lead", label: "Lead", color: "#4fa8f7" },
  { key: "booked", label: "Booked", color: "#22c8e5" },
  { key: "confirmed", label: "Confirmed", color: "#8b9cf7" },
  { key: "attended", label: "Attended", color: "#a78bfa" },
  { key: "missed", label: "Missed", color: "#5b7cf5" },
  { key: "intro", label: "Intro Programme", color: "#67e0f0" },
  { key: "recurring", label: "Recurring", color: "#38bdf8" },
  { key: "did_not_convert", label: "Did not Convert", color: "#94a3b8" },
  { key: "won", label: "Won", color: "#34d399" },
  { key: "unqualified", label: "Not Qualified", color: "#f87171" },
] as const;

export type StageKey = (typeof STAGES)[number]["key"];

export const STAGE_KEYS = STAGES.map((s) => s.key) as StageKey[];

// Stages shown as pipeline columns (unqualified leads live in the lead list only).
export const PIPELINE_STAGES = STAGE_KEYS.filter((k) => k !== "unqualified");

// The "happy path" used for the funnel chart.
export const FUNNEL_STAGES: StageKey[] = ["lead", "booked", "confirmed", "attended", "intro", "recurring", "won"];

export function stageInfo(key: string) {
  return STAGES.find((s) => s.key === key) ?? STAGES[0];
}

export function isStage(key: string): key is StageKey {
  return (STAGE_KEYS as string[]).includes(key);
}
