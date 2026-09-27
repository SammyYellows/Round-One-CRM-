"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { gbp } from "@/lib/format";
import { useStore } from "@/lib/store";
import { AdMetrics, sumMetrics } from "@/lib/types";

// Spend, impressions, clicks and leads will come from the Meta Marketing API
// (nightly sync, per ad). Trials and sales come from the CRM, matched on the
// ad each contact came from.

type SortKey = "name" | "spend" | "leads" | "cpl" | "trials" | "cpt" | "sold" | "cps";

const COLS: { key: SortKey; label: string }[] = [
  { key: "spend", label: "Spend" },
  { key: "leads", label: "Leads" },
  { key: "cpl", label: "Per lead" },
  { key: "trials", label: "Trials" },
  { key: "cpt", label: "Per trial" },
  { key: "sold", label: "Sold" },
  { key: "cps", label: "Per sale" },
];

const per = (a: number, b: number) => (b ? a / b : Infinity);
const money = (n: number) => (Number.isFinite(n) ? gbp(n, 2) : "–");
const value = (m: AdMetrics, k: SortKey) =>
  k === "cpl" ? per(m.spend, m.leads) : k === "cpt" ? per(m.spend, m.trials) : k === "cps" ? per(m.spend, m.sold) : k === "name" ? 0 : m[k];

export default function AdsPage() {
  const { s, live } = useStore();
  const [group, setGroup] = useState<"ad" | "campaign">("ad");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "cpt", dir: 1 });
  const [open, setOpen] = useState<string[]>([]);

  const t = sumMetrics(s.campaigns.flatMap((c) => c.ads));
  const people = (adId: string) => s.contacts.filter((c) => c.adId === adId).length;

  const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1).replace(/\.0$/, "")}%` : "–");
  const stats = [
    { label: "Spend", value: gbp(t.spend), rule: "var(--red)" },
    { label: "Leads", value: String(t.leads), rule: "var(--line)" },
    { label: "Cost per lead", value: money(per(t.spend, t.leads)), rule: "var(--line)" },
    { label: "Cost per trial", value: money(per(t.spend, t.trials)), rule: "var(--line)" },
    { label: "Cost per sale", value: t.sold ? gbp(t.spend / t.sold) : "–", rule: "var(--white)" },
  ];
  const funnel = [
    { label: "Impressions", value: t.impressions.toLocaleString("en-GB"), rate: "People who saw an ad" },
    { label: "Clicks", value: t.clicks.toLocaleString("en-GB"), rate: `${pct(t.clicks, t.impressions)} of impressions` },
    { label: "Leads", value: String(t.leads), rate: `${pct(t.leads, t.clicks)} of clicks` },
    { label: "Trials", value: String(t.trials), rate: `${pct(t.trials, t.leads)} of leads` },
    { label: "Sold", value: String(t.sold), rate: `${pct(t.sold, t.trials)} of trials` },
  ];

  const cmp = (a: AdMetrics & { name: string }, b: AdMetrics & { name: string }) => {
    if (sort.key === "name") return a.name.localeCompare(b.name) * sort.dir;
    const va = value(a, sort.key);
    const vb = value(b, sort.key);
    if (va === vb) return 0;
    // Missing cost-per values ("–") always sink to the bottom.
    if (!Number.isFinite(va)) return 1;
    if (!Number.isFinite(vb)) return -1;
    return (va - vb) * sort.dir;
  };

  const ads = s.campaigns.flatMap((c) => c.ads.map((a) => ({ ...a, campaign: c.name }))).sort(cmp);
  const campaigns = s.campaigns.map((c) => ({ ...c, ...sumMetrics(c.ads) })).sort(cmp);

  const clickSort = (key: SortKey) =>
    setSort((cur) => (cur.key === key ? { key, dir: cur.dir === 1 ? -1 : 1 } : { key, dir: key === "name" || key.startsWith("cp") ? 1 : -1 }));
  const arrow = (key: SortKey) => (sort.key === key ? (sort.dir === 1 ? " ↑" : " ↓") : "");

  const Cells = ({ m }: { m: AdMetrics }) => (
    <>
      <div className="r">{gbp(m.spend)}</div>
      <div className="r">{m.leads}</div>
      <div className="r">{money(per(m.spend, m.leads))}</div>
      <div className="r">{m.trials}</div>
      <div className="r">{money(per(m.spend, m.trials))}</div>
      <div className="r">{m.sold}</div>
      <div className="r">{money(per(m.spend, m.sold))}</div>
    </>
  );

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">Last 30 days · {live ? "spend appears once Meta is connected" : "sample figures until Meta is connected"}</div>
          <h1 className="h h1">Meta ads</h1>
        </div>
      </header>

      <div className="grid stats5">
        {stats.map((st) => (
          <div key={st.label} className="card pad" style={{ display: "flex", flexDirection: "column", gap: 10, borderTop: `3px solid ${st.rule}` }}>
            <div className="eyebrow">{st.label}</div>
            <div className="h num" style={{ fontSize: 44, lineHeight: 1 }}>{st.value}</div>
          </div>
        ))}
      </div>

      <section className="card pad" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
          <h2 className="h" style={{ fontSize: 24 }}>From ad to sale</h2>
          <span className="small muted">Trials and sales come from the CRM, matched to the exact ad each person came from</span>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 4 }}>
          {funnel.map((f) => (
            <div key={f.label} style={{ background: "var(--char)", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 6 }}>
              <div className="eyebrow">{f.label}</div>
              <div className="h num" style={{ fontSize: 32, lineHeight: 1 }}>{f.value}</div>
              <div className="muted" style={{ fontSize: 12 }}>{f.rate}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-head" style={{ alignItems: "center", flexWrap: "wrap" }}>
          <h2 className="h" style={{ fontSize: 24 }}>{group === "ad" ? "Ads" : "Campaigns"}</h2>
          <div className="actions" style={{ gap: 8 }}>
            <span className="eyebrow">Show by</span>
            <button className={`fchip ${group === "ad" ? "on" : ""}`} aria-pressed={group === "ad"} onClick={() => setGroup("ad")}>Ad</button>
            <button className={`fchip ${group === "campaign" ? "on" : ""}`} aria-pressed={group === "campaign"} onClick={() => setGroup("campaign")}>Campaign</button>
          </div>
        </div>
        <div className="trow thead" style={{ borderTop: 0 }}>
          <button className="th" onClick={() => clickSort("name")}>{group === "ad" ? "Ad" : "Campaign"}{arrow("name")}</button>
          {COLS.map((c) => (
            <button key={c.key} className="th r" onClick={() => clickSort(c.key)} aria-label={`Sort by ${c.label}`}>
              {c.label}{arrow(c.key)}
            </button>
          ))}
        </div>

        {group === "ad" &&
          ads.map((a) => (
            <div key={a.id} className="trow">
              <div style={{ minWidth: 0 }}>
                <div className="strong">{a.name} <span className="chip" style={{ height: 20, fontSize: 10, marginLeft: 4 }}>{a.format}</span></div>
                <div className="faint" style={{ fontSize: 12 }}>
                  {a.campaign} · {a.adset} · <Link href={`/contacts?ad=${a.id}`} style={{ color: "var(--muted)" }}>{people(a.id)} in CRM</Link>
                </div>
              </div>
              <Cells m={a} />
            </div>
          ))}

        {group === "campaign" &&
          campaigns.map((c) => {
            const isOpen = open.includes(c.utm);
            return (
              <Fragment key={c.utm}>
                <div className="trow">
                  <button
                    className="link-btn"
                    style={{ textAlign: "left", textDecoration: "none", fontSize: 14 }}
                    aria-expanded={isOpen}
                    onClick={() => setOpen((o) => (isOpen ? o.filter((x) => x !== c.utm) : [...o, c.utm]))}
                  >
                    {isOpen ? "▾" : "▸"} {c.name}
                    <span className="faint" style={{ display: "block", fontSize: 12, fontWeight: 400, marginLeft: 16 }}>{c.ads.length} ads · {c.utm}</span>
                  </button>
                  <Cells m={c} />
                </div>
                {isOpen &&
                  [...c.ads].sort(cmp).map((a) => (
                    <div key={a.id} className="trow" style={{ background: "var(--char)" }}>
                      <div style={{ paddingLeft: 20, minWidth: 0 }}>
                        <div>{a.name}</div>
                        <div className="faint" style={{ fontSize: 12 }}>
                          {a.adset} · {a.format} · <Link href={`/contacts?ad=${a.id}`} style={{ color: "var(--muted)" }}>{people(a.id)} in CRM</Link>
                        </div>
                      </div>
                      <Cells m={a} />
                    </div>
                  ))}
              </Fragment>
            );
          })}

        <div className="trow ttotal">
          <div>All ads</div>
          <Cells m={t} />
        </div>
      </section>
    </>
  );
}
