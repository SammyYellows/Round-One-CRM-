"use client";

import { useActionState, useState } from "react";
import type { Day } from "@/lib/availability";
import { bookSlot, type BookState } from "./actions";

const tz = "Europe/London";
const fmtTime = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true });
const fmtDow = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short" });
const fmtDate = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short" });

export default function SlotPicker({ token, days }: { token: string; days: Day[] }) {
  const [state, action, pending] = useActionState<BookState, FormData>(bookSlot, {});
  const firstOpen = days.findIndex((d) => d.slots.some((s) => s.available));
  const [dayIdx, setDayIdx] = useState(Math.max(0, firstOpen));
  const [slot, setSlot] = useState("");
  const day = days[dayIdx];

  if (!days.length) return <p className="sub">No times available right now – we&apos;ll be in touch on WhatsApp.</p>;

  return (
    <form action={action}>
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="slot" value={slot} />
      <div className="days">
        {days.map((d, i) => {
          const date = new Date(d.key + "T12:00:00Z");
          return (
            <button
              type="button"
              key={d.key}
              className={`day-btn ${i === dayIdx ? "selected" : ""}`}
              onClick={() => {
                setDayIdx(i);
                setSlot("");
              }}
            >
              <small>{fmtDow.format(date)}</small>
              {fmtDate.format(date)}
            </button>
          );
        })}
      </div>
      <div className="slots">
        {day.slots.map((s) => (
          <button
            type="button"
            key={s.start}
            disabled={!s.available}
            className={`slot ${slot === s.start ? "selected" : ""}`}
            onClick={() => setSlot(s.start)}
          >
            {fmtTime.format(new Date(s.start)).replace(" ", "")}
          </button>
        ))}
      </div>
      {state.error && <p className="error">{state.error}</p>}
      <div style={{ marginTop: 20 }}>
        <button className="btn" disabled={!slot || pending}>
          {pending ? "Booking…" : "Book consultation"}
        </button>
      </div>
    </form>
  );
}
