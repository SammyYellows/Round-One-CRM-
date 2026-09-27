// Public: someone booking (or moving) their free trial from their booking
// page. The slot is checked against the calendar's hours and what's booked
// at the moment of saving, so two people can't take the last place.

import { isBookable } from "@/lib/availability";
import { applyAction } from "@/lib/server/state";

export const dynamic = "force-dynamic";

class Refused extends Error {}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = (await req.json().catch(() => null)) as { start?: unknown } | null;
  const start = typeof body?.start === "string" ? body.start : "";
  if (!start || Number.isNaN(Date.parse(start))) return Response.json({ error: "Pick a time first." }, { status: 400 });

  try {
    await applyAction("bookTrial", [params.id, start], (s) => {
      if (!s.contacts.some((c) => c.id === params.id)) throw new Refused("We can’t find that booking link.");
      const cal = s.calendars.find((c) => c.bookTrial);
      if (!cal || !isBookable(cal, s.appointments, start, Date.now())) throw new Refused("Sorry, that time has just gone. Please pick another.");
    });
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof Refused) return Response.json({ error: e.message }, { status: 409 });
    console.error("[book]", params.id, e);
    return Response.json({ error: "We couldn’t book that. Please try again." }, { status: 500 });
  }
}
