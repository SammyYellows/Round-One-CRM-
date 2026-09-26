// Business configuration for Round 1 Fitness.
// Everything the gym is likely to tweak (questions, qualification rules,
// opening hours for consultations) lives here so it can be changed in one place.

export const GYM = {
  name: "Round 1 Fitness",
  city: "Bristol",
  address: "Round 1 Fitness, Bristol",
  timezone: "Europe/London",
  consultationName: "Free consultation",
};

export const APP_URL = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

// ---------------------------------------------------------------------------
// Consultation availability (what the public booking calendar offers)
// ---------------------------------------------------------------------------

export const AVAILABILITY = {
  slotMinutes: 30,
  // How many people can be booked into the same slot (e.g. two coaches).
  capacityPerSlot: 2,
  // Earliest a lead can book, relative to now.
  minNoticeHours: 2,
  // How far ahead the booking page shows.
  daysAhead: 14,
  // Opening windows per weekday (0 = Sunday), local UK time, [start, end).
  hours: {
    0: [],
    1: [["11:00", "20:00"]],
    2: [["11:00", "20:00"]],
    3: [["11:00", "20:00"]],
    4: [["11:00", "20:00"]],
    5: [["11:00", "18:00"]],
    6: [["09:00", "12:00"]],
  } as Record<number, [string, string][]>,
};

// ---------------------------------------------------------------------------
// Qualification questionnaire (linked from Instagram)
// ---------------------------------------------------------------------------

export type QuestionOption = {
  value: string;
  label: string;
  // Choosing this option means the lead is not a fit right now.
  disqualify?: boolean;
};

export type Question = {
  key: string;
  title: string;
  subtitle?: string;
  options: QuestionOption[];
};

export const QUESTIONS: Question[] = [
  {
    key: "goal",
    title: "What's your main goal?",
    options: [
      { value: "lose_weight", label: "Lose weight & tone up" },
      { value: "fitness", label: "Get fitter & stronger" },
      { value: "learn_boxing", label: "Learn to box properly" },
      { value: "confidence", label: "Confidence & stress relief" },
      { value: "compete", label: "Train to compete" },
    ],
  },
  {
    key: "experience",
    title: "Have you boxed or trained before?",
    options: [
      { value: "none", label: "Never – complete beginner" },
      { value: "some", label: "A little – a few sessions" },
      { value: "regular", label: "Yes – I train regularly" },
    ],
  },
  {
    key: "frequency",
    title: "How many times a week could you train?",
    options: [
      { value: "1", label: "Once a week" },
      { value: "2-3", label: "2–3 times a week" },
      { value: "4+", label: "4+ times a week" },
    ],
  },
  {
    key: "start",
    title: "When would you like to start?",
    options: [
      { value: "asap", label: "As soon as possible" },
      { value: "month", label: "Within the next month" },
      { value: "browsing", label: "Just having a look for now" },
    ],
  },
  {
    key: "location",
    title: `Are you based in or near ${GYM.city}?`,
    options: [
      { value: "yes", label: `Yes – I can get to the gym` },
      { value: "no", label: "No – I'm not local", disqualify: true },
    ],
  },
  {
    key: "age",
    title: "Are you 16 or over?",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No", disqualify: true },
    ],
  },
  {
    key: "investment",
    title: "Our coached programmes are an investment in yourself.",
    subtitle: "If it's the right fit, are you in a position to invest in your fitness right now?",
    options: [
      { value: "yes", label: "Yes – I'm ready to commit" },
      { value: "maybe", label: "Possibly – I'd like to know more" },
      { value: "no", label: "No – not at the moment", disqualify: true },
    ],
  },
];

export function questionLabel(key: string): string {
  return QUESTIONS.find((q) => q.key === key)?.title ?? key;
}

export function answerLabel(key: string, value: string): string {
  const q = QUESTIONS.find((q) => q.key === key);
  return q?.options.find((o) => o.value === value)?.label ?? value;
}

/** Returns null when qualified, otherwise a human readable reason. */
export function disqualifyReason(answers: Record<string, string>): string | null {
  for (const q of QUESTIONS) {
    const opt = q.options.find((o) => o.value === answers[q.key]);
    if (opt?.disqualify) return `${q.title} → ${opt.label}`;
  }
  return null;
}
