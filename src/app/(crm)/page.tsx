"use client";

import { useIsManager } from "@/components/StaffContext";
import Link from "next/link";
import { BarList, ColumnChart, Meter, Sparkline } from "@/components/charts";
import { demoAdLink } from "@/lib/engine";
import { ago, dayTime, gbp, isSameDay, longDate, time } from "@/lib/format";
import { daily, funnelCounts, showRate, sourceCounts, weekLoad } from "@/lib/metrics";
import { useStore } from "@/lib/store";
import { sumMetrics } from "@/lib/types";

const shortDay = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

export default function TodayPage() {
  // Staff logins don't see gym-wide money: ad spend and cost per trial (Sammy, 10/10/2026).
  const manager = useIsManager();
  const { s, now, act, live } = useStore();

  // ---- Numbers ----
  const days28 = daily(s, now, 28);
  const last14 = days28.slice(-14);
  const last7 = days28.slice(-7);
  const prev7 = days28.slice(-14, -7);
  const sum = (xs: { leads: number }[]) => xs.reduce((n, d) => n + d.leads, 0);
  const leads7 = sum(last7);
  const leadsPrev7 = sum(prev7);
  const trials7 = last7.reduce((n, d) => n + d.trials, 0);
  const show = showRate(s);
  const meta = sumMetrics(s.campaigns.flatMap((c) => c.ads));
  const avgLeads = sum(days28) / days28.length;

  // How far people have got: everyone enquired, fewer reached each later step.
  const f = funnelCounts(s);
  const funnel = [
    { key: "lead", label: "Enquired", value: f.enquired },
    { key: "contacted", label: "Replied to", value: f.replied },
    { key: "booked", label: "Booked a trial", value: f.booked },
    { key: "done", label: "Did the trial", value: f.attended },
    { key: "sold", label: "Sold", value: f.sold },
  ].map((f, i, arr) => ({ ...f, note: i === 0 ? undefined : `${arr[i - 1].value ? Math.round((f.value / arr[i - 1].value) * 100) : 0}% of previous` }));

  const topAds = s.campaigns
    .flatMap((c) => c.ads)
    .filter((a) => a.trials > 0)
    .sort((a, b) => b.trials - a.trials || a.spend / a.trials - b.spend / b.trials)
    .slice(0, 5)
    .map((a) => ({ key: a.id, label: a.name, value: a.trials, note: manager ? `${gbp(a.spend / a.trials)} per trial` : undefined }));

  const week = weekLoad(s, now);

  // ---- Lists ----
  const trials = s.contacts.filter((c) => c.stage === "booked" && c.trialAt).sort((a, b) => Date.parse(a.trialAt!) - Date.parse(b.trialAt!));
  const trialsToday = trials.filter((c) => isSameDay(Date.parse(c.trialAt!), now)).length;
  const waiting = s.contacts.filter((c) => s.messages.filter((m) => m.contactId === c.id).at(-1)?.dir === "in");
  const openTasks = s.tasks.filter((t) => !t.done);

  const change = leadsPrev7 ? Math.round(((leads7 - leadsPrev7) / leadsPrev7) * 100) : 0;
  const tiles = [
    { label: "Leads, last 7 days", value: String(leads7), note: `${change >= 0 ? "Up" : "Down"} ${Math.abs(change)}% on the week before`, spark: last14.map((d) => d.leads) },
    { label: "Trials, last 7 days", value: String(trials7), note: `${trialsToday} more booked for today`, spark: last14.map((d) => d.trials) },
    { label: "Trial show-up rate", value: `${Math.round(show.rate * 100)}%`, note: `${show.attended} of ${show.total} turned up`, meter: show.rate },
    manager
      ? { label: "Meta cost per trial", value: meta.trials ? gbp(meta.spend / meta.trials) : "–", note: `${gbp(meta.spend)} spent, last 30 days`, spark: last14.map((d) => d.spend) }
      : { label: "Trials coming up", value: String(trials.length), note: `${trialsToday} of them today` },
  ];

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">{longDate(now)}</div>
          <h1 className="h h1">Today</h1>
        </div>
        <div className="actions">
          {!live && <span className="chip">Prototype · sample data</span>}
          <a className="btn btn-ghost" href={demoAdLink("free-trial")} target="_blank" rel="noreferrer">Open trial form</a>
          <Link className="btn btn-red" href="/calendar">Book a trial</Link>
        </div>
      </header>

      <div className="grid stats4">
        {tiles.map((t) => (
          <div key={t.label} className="card pad" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="eyebrow">{t.label}</div>
            <div className="h num" style={{ fontSize: 48, lineHeight: 1 }}>{t.value}</div>
            {"meter" in t && t.meter !== undefined ? <Meter value={t.meter} label={t.label} /> : <Sparkline values={t.spark ?? []} />}
            <div className="small muted">{t.note}</div>
          </div>
        ))}
      </div>

      <div className="grid cols-dash">
        <section className="card pad">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
            <h2 className="h h2">Leads per day</h2>
            <span className="small muted">Last 4 weeks · today in white</span>
          </div>
          <ColumnChart
            height={220}
            unit="leads"
            summary={`Leads per day for the last 28 days. ${sum(days28)} in total, about ${avgLeads.toFixed(1)} a day.`}
            avg={avgLeads}
            data={days28.map((d, i) => ({
              key: d.key,
              value: d.leads,
              tip: shortDay(d.date),
              emphasis: d.isToday,
              label: i % 7 === 6 || d.isToday ? new Date(d.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "",
            }))}
          />
        </section>

        <section className="card pad">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
            <h2 className="h h2">Trial funnel</h2>
            <Link href="/pipeline" className="small">Pipeline</Link>
          </div>
          <BarList rows={funnel} summary="How far people in the CRM have got, from enquiry to joining" />
        </section>
      </div>

      <div className="grid cols-dash3">
        <section className="card pad">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
            <h2 className="h h3">Where leads come from</h2>
            <Link href="/contacts" className="small">Contacts</Link>
          </div>
          <BarList
            summary="Contacts by lead source"
            rows={sourceCounts(s).map((r) => ({ key: r.id, label: r.label, value: r.value, note: `${Math.round((r.value / Math.max(1, s.contacts.length)) * 100)}%` }))}
          />
        </section>

        <section className="card pad">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
            <h2 className="h h3">Ads booking trials</h2>
            <Link href="/ads" className="small">Meta ads</Link>
          </div>
          <BarList summary="Trials booked per ad, last 30 days" rows={topAds} />
        </section>

        <section className="card pad">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
            <h2 className="h h3">Trials this week</h2>
            <Link href="/calendar" className="small">Calendar</Link>
          </div>
          <ColumnChart
            height={170}
            unit="trials booked"
            summary={`Trials in the calendar this week, Monday to Sunday: ${week.map((w) => w.value).join(", ")}.`}
            data={week.map((w) => ({
              key: w.key,
              value: w.value,
              tip: shortDay(w.date),
              emphasis: w.isToday,
              label: new Date(w.date).toLocaleDateString("en-GB", { weekday: "short" }),
            }))}
          />
        </section>
      </div>

      <div className="grid cols-today">
        <section className="card">
          <div className="card-head">
            <h2 className="h h2">Needs you</h2>
            <span className="small muted">{openTasks.length + waiting.length} things</span>
          </div>
          {waiting.map((c) => (
            <div key={c.id} className="row">
              <span className="chip chip-light" style={{ width: 96, flexShrink: 0 }}>WhatsApp</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="strong">{c.name} is waiting for a reply</div>
                <div className="small muted">
                  {s.messages.filter((m) => m.contactId === c.id).at(-1)?.text.slice(0, 70)}
                </div>
              </div>
              <Link className="btn btn-ghost btn-sm" href={`/contacts/${c.id}`}>Reply</Link>
            </div>
          ))}
          {openTasks.map((t) => (
            <div key={t.id} className="row">
              <span className="chip chip-red" style={{ width: 96, flexShrink: 0 }}>Task</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="strong">{t.text}</div>
                <div className="small muted">{ago(t.at, now)}</div>
              </div>
              {t.contactId && <Link className="btn btn-ghost btn-sm" href={`/contacts/${t.contactId}`}>Open</Link>}
              <button className="btn btn-ghost btn-sm" onClick={() => act("completeTask", t.id)}>Done</button>
            </div>
          ))}
          {openTasks.length + waiting.length === 0 && <div className="empty">Nothing waiting on you.</div>}
        </section>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <section className="card">
            <div className="card-head">
              <h2 className="h h2">Upcoming trials</h2>
              <Link href="/calendar" className="small">Calendar</Link>
            </div>
            {trials.slice(0, 6).map((c) => (
              <Link key={c.id} href={`/contacts/${c.id}`} className="row" style={{ textDecoration: "none" }}>
                <div className="h num" style={{ fontSize: 20, width: 96, flexShrink: 0 }}>
                  {isSameDay(Date.parse(c.trialAt!), now) ? time(c.trialAt!) : dayTime(c.trialAt!)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }} className="strong">{c.name}</div>
                <span className="small muted">{ago(c.trialAt!, now)}</span>
              </Link>
            ))}
            {trials.length === 0 && <div className="empty">No trials booked.</div>}
          </section>

          <section className="card">
            <div className="card-head"><h2 className="h h2">Recent activity</h2></div>
            {s.events.slice(0, 8).map((e) => (
              <div key={e.id} className="row" style={{ paddingTop: 12, paddingBottom: 12 }}>
                <div style={{ flex: 1, minWidth: 0, fontSize: 14 }}>
                  <span className="strong">{EVENT_LABEL[e.type]}</span> <span className="muted">{e.detail}</span>
                </div>
                <div className="faint" style={{ fontSize: 12, flexShrink: 0 }}>{ago(e.at, now)}</div>
              </div>
            ))}
          </section>
        </div>
      </div>
    </>
  );
}

const EVENT_LABEL: Record<string, string> = {
  "contact.created": "New contact",
  "form.submitted": "Form submitted",
  "stage.changed": "Stage changed",
  "tag.added": "Tagged",
  "whatsapp.sent": "WhatsApp sent",
  "whatsapp.received": "WhatsApp received",
  "email.sent": "Email sent",
  "email.received": "Email received",
  "email.replied": "Email reply sent",
  "task.created": "Task created",
  "automation.stopped": "Automation ended",
  "appointment.booked": "Trial booked",
  "appointment.updated": "Calendar",
};
