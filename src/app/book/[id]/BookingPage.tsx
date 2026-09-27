"use client";

import { useState } from "react";
import { Day, bookableDays, slotLabel, slotTime } from "@/lib/availability";
import { nowMs } from "@/lib/engine";
import { GYM } from "@/lib/gym";
import { StoreProvider, useStore } from "@/lib/store";

// Pick a day, then a time. Same light look as the public form.

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--black)", display: "flex", justifyContent: "center", alignItems: "center", padding: 16 }}>
      <div className="runner" style={{ width: "100%", maxWidth: 480, minHeight: "min(720px, calc(100vh - 32px))" }}>
        <div className="runner-top">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo.avif" alt="Round One" width={64} style={{ display: "block", height: "auto" }} />
          <span>Book your intro meeting</span>
        </div>
        <div className="runner-body">{children}</div>
      </div>
    </div>
  );
}

function Picker({
  first, days, booked, onBook,
}: {
  first?: string;
  days: Day[];
  booked?: string;
  onBook: (start: string) => Promise<string | null>; // an error message, or null when booked
}) {
  const [dayKey, setDayKey] = useState(days.find((d) => d.slots.some((s) => s.free))?.key);
  const [chosen, setChosen] = useState<string>();
  const [done, setDone] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const day = days.find((d) => d.key === dayKey);
  const hello = first && /^\p{L}/u.test(first) ? `Hi ${first}. ` : "";

  if (done) {
    return (
      <>
        <div className="h" style={{ fontSize: 40 }}>You’re booked in</div>
        <div className="q">{slotLabel(done)}</div>
        <div className="help">Your intro meeting is in person at our HQ: {GYM.address}.</div>
        <div className="help">We’ll send you a confirmation on WhatsApp and by email.</div>
      </>
    );
  }

  const book = async () => {
    if (!chosen) return;
    setBusy(true);
    setError(undefined);
    const err = await onBook(chosen);
    setBusy(false);
    if (err) {
      setError(err);
      setChosen(undefined);
    } else setDone(chosen);
  };

  return (
    <>
      <div className="q">{hello}Pick a time for your intro meeting.</div>
      <div className="help">
        It’s in person at our HQ, {GYM.address}. We’ll chat about your goals, show you around and run through how everything works.
      </div>
      {booked && <div className="help"><strong>You’re already booked in for {slotLabel(booked)}.</strong> Pick another time to move it.</div>}

      {days.length === 0 ? (
        <div className="help">There are no times to book online at the moment. Reply to our WhatsApp message and we’ll find you one.</div>
      ) : (
        <>
          <div role="group" aria-label="Day" style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
            {days.map((d) => {
              const any = d.slots.some((s) => s.free);
              return (
                <button
                  key={d.key}
                  type="button"
                  className={`opt ${d.key === dayKey ? "on" : ""}`}
                  style={{ width: "auto", flexShrink: 0, flexDirection: "column", alignItems: "flex-start", justifyContent: "center", gap: 0, padding: "6px 12px" }}
                  disabled={!any}
                  aria-pressed={d.key === dayKey}
                  onClick={() => { setDayKey(d.key); setChosen(undefined); }}
                >
                  <span style={{ fontWeight: 600 }}>{d.label.split(" ")[0]}</span>
                  <span style={{ fontSize: 13 }}>{d.label.split(" ").slice(1).join(" ")}</span>
                </button>
              );
            })}
          </div>
          {day && (
            <div role="group" aria-label={`Times on ${day.label}`} className="slots">
              {day.slots.filter((s) => s.free).map((s) => (
                <button key={s.start} type="button" className={`opt ${chosen === s.start ? "on" : ""}`} aria-pressed={chosen === s.start} onClick={() => setChosen(s.start)}>
                  {slotTime(s.start)}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {error && <div className="err" role="alert">{error}</div>}
      <div style={{ flex: 1 }} />
      <button className="btn btn-red" disabled={!chosen || busy} onClick={book}>
        {busy ? "Booking" : chosen ? `Book ${slotLabel(chosen)}` : "Pick a time"}
      </button>
    </>
  );
}

/** Live: the booking is checked and saved on the server. */
export function BookingPage({ contactId, first, days, booked }: { contactId: string; first?: string; days: Day[]; booked?: string }) {
  const onBook = async (start: string) => {
    const res = await fetch(`/api/book/${contactId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ start }) }).catch(() => null);
    if (res?.ok) return null;
    const json = (await res?.json().catch(() => null)) as { error?: string } | null;
    return json?.error ?? "We couldn’t book that. Please check your connection and try again.";
  };
  return <Shell><Picker first={first} days={days} booked={booked} onBook={onBook} /></Shell>;
}

function LocalBooking({ contactId }: { contactId: string }) {
  const { s, act } = useStore();
  const c = s.contacts.find((x) => x.id === contactId);
  const cal = s.calendars.find((x) => x.bookTrial);
  if (!c || !cal) return <div className="help">We can’t find that booking link.</div>;
  const days = bookableDays(cal, s.appointments, nowMs(s));
  const booked = c.trialAt && Date.parse(c.trialAt) > nowMs(s) ? c.trialAt : undefined;
  return <Picker first={c.name.split(" ")[0]} days={days} booked={booked} onBook={async (start) => { act("bookTrial", c.id, start); return null; }} />;
}

/** Local prototype: books against the sample data in this browser. */
export function LocalBookingPage({ contactId }: { contactId: string }) {
  return (
    <StoreProvider local>
      <Shell><LocalBooking contactId={contactId} /></Shell>
    </StoreProvider>
  );
}
