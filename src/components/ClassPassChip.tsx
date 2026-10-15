import { CLASSPASS_LABEL, isClassPass } from "@/lib/types";

/** "ClassPass (paid)" next to someone booked through ClassPass, so nobody charges them at the door. */
export function ClassPassChip({ email }: { email?: string | null }) {
  if (!isClassPass(email)) return null;
  return <span className="chip chip-light" style={{ height: 20, fontSize: 10, marginLeft: 6 }} title="Booked and paid through ClassPass: don’t charge them">{CLASSPASS_LABEL}</span>;
}
