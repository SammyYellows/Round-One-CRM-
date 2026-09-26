import { notFound } from "next/navigation";
import { Brand } from "../../Brand";
import { availableDays } from "@/lib/availability";
import { GYM } from "@/lib/config";
import { getLeadByToken, upcomingAppointment } from "@/lib/leads";
import { formatSlot } from "@/lib/time";
import { cancelBooking, confirmBooking } from "./actions";
import SlotPicker from "./SlotPicker";

export const dynamic = "force-dynamic";

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const lead = getLeadByToken(token);
  if (!lead || !lead.qualified) notFound();
  const appt = upcomingAppointment(lead.id);

  if (appt && sp.reschedule !== "1") {
    return (
      <main className="public">
        <Brand />
        <div className="panel">
          <div className="tick">✓</div>
          <h1>{sp.booked ? `You're booked in, ${lead.first_name}!` : `See you soon, ${lead.first_name}!`}</h1>
          <p className="sub">
            Your {GYM.consultationName.toLowerCase()} is on <b>{formatSlot(appt.starts_at)}</b> at {GYM.address}.
            {appt.status === "confirmed" ? " ✅ Confirmed." : ""}
          </p>
          <p className="sub">We&apos;ll send you a reminder on WhatsApp. Wear comfy clothes and bring some water 💧</p>
          <div className="row">
            {appt.status === "booked" && (
              <form action={confirmBooking}>
                <input type="hidden" name="token" value={token} />
                <button className="btn">Confirm I&apos;ll be there</button>
              </form>
            )}
            <a className="btn btn-ghost" href={`/book/${token}?reschedule=1`}>
              Change time
            </a>
            <form action={cancelBooking}>
              <input type="hidden" name="token" value={token} />
              <button className="btn btn-ghost">Cancel</button>
            </form>
          </div>
        </div>
      </main>
    );
  }

  const days = availableDays();
  return (
    <main className="public">
      <Brand />
      <div className="panel">
        {sp.new ? (
          <>
            <h1>Great news {lead.first_name} – you&apos;re eligible! 🎉</h1>
            <p className="sub">Pick a time for your free 30-minute consultation with one of our coaches.</p>
          </>
        ) : sp.cancelled ? (
          <>
            <h1>Your consultation has been cancelled</h1>
            <p className="sub">No problem – pick a new time whenever you&apos;re ready.</p>
          </>
        ) : (
          <>
            <h1>Book your free consultation</h1>
            <p className="sub">Pick a time that suits you, {lead.first_name}.</p>
          </>
        )}
        <SlotPicker token={token} days={days} />
      </div>
    </main>
  );
}
