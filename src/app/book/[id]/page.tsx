import { notFound } from "next/navigation";
import { bookableDays } from "@/lib/availability";
import { db } from "@/lib/server/supabase";
import { supabaseConfigured } from "@/lib/supabase/env";
import { Appointment, CalendarDef } from "@/lib/types";
import { BookingPage, LocalBookingPage } from "./BookingPage";

// Someone's own booking page, linked from the end of the trial form and from
// the "Book meeting" button in WhatsApp messages. No login: the link itself
// (their contact id, which can't be guessed) is what lets them in.
export const dynamic = "force-dynamic";

export default async function Book({ params }: { params: { id: string } }) {
  if (!supabaseConfigured()) return <LocalBookingPage contactId={params.id} />;

  const [{ data: contact }, { data: cal }, { data: appts }] = await Promise.all([
    db().from("contacts").select("id, name, trial_at").eq("id", params.id).maybeSingle(),
    db().from("calendars").select("id, name, duration_min, style, book_trial, availability").eq("book_trial", true).limit(1).maybeSingle(),
    db().from("appointments").select("id, contact_id, calendar_id, start, end, status").in("status", ["booked", "confirmed"]).gte("end", new Date().toISOString()),
  ]);
  if (!contact || !cal) notFound();

  const calendar: CalendarDef = { id: cal.id, name: cal.name, durationMin: cal.duration_min, style: cal.style, bookTrial: true, availability: cal.availability ?? undefined };
  const booked = (appts ?? []).map((a) => ({ id: a.id, contactId: a.contact_id, calendarId: a.calendar_id, start: a.start, end: a.end, status: a.status }) as Appointment);
  const upcoming = contact.trial_at && Date.parse(contact.trial_at) > Date.now() ? (contact.trial_at as string) : undefined;

  return (
    <BookingPage
      contactId={contact.id}
      first={(contact.name as string).split(" ")[0]}
      days={bookableDays(calendar, booked, Date.now())}
      booked={upcoming}
    />
  );
}
