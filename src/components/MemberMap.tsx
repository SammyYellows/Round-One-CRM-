"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";

// Where members come from (Sammy, 15/10/2026): a circle per postcode area,
// bigger the more active members live there. Areas only, never addresses.
// Leaflet with OpenStreetMap tiles (agreed with Sammy as a new dependency).

interface Area { area: string; members: number; at: [number, number] | null }
interface MapData { activeMembers: number; withArea: number; areas: Area[] }

const GYM: [number, number] = [51.4545, -2.5879]; // Bristol, until the circles set the view

export function MemberMap() {
  const box = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<MapData | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/members/map", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Couldn’t load the map"))))
      .then(setData)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => {
    if (!data || !box.current) return;
    let map: import("leaflet").Map | undefined;
    let gone = false;
    import("leaflet").then((L) => {
      if (gone || !box.current) return;
      const red = getComputedStyle(document.documentElement).getPropertyValue("--red").trim();
      map = L.map(box.current, { scrollWheelZoom: false }).setView(GYM, 11);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 16, attribution: "© OpenStreetMap contributors" }).addTo(map);
      const placed = data.areas.filter((a) => a.at);
      const most = Math.max(1, ...placed.map((a) => a.members));
      for (const a of placed) {
        L.circleMarker(a.at!, { radius: 6 + 24 * Math.sqrt(a.members / most), color: red, fillColor: red, fillOpacity: 0.45, weight: 1 })
          .bindTooltip(`${a.area}: ${a.members} member${a.members === 1 ? "" : "s"}`)
          .addTo(map);
      }
      // Fit the areas most members come from; a few far-off ones shouldn't zoom the map out to the whole country.
      const core = placed.filter((a) => a.members >= 2);
      const fit = (core.length >= 3 ? core : placed).map((a) => a.at!);
      if (fit.length) map.fitBounds(L.latLngBounds(fit), { padding: [24, 24], maxZoom: 13 });
    });
    return () => { gone = true; map?.remove(); };
  }, [data]);

  return (
    <section className="card" style={{ marginBottom: 24 }}>
      <div className="card-head">
        <div>
          <div className="eyebrow">Active members by postcode area</div>
          <h2 className="h h3">Where members come from</h2>
        </div>
      </div>
      {err ? (
        <div className="empty">{err}</div>
      ) : (
        <>
          <div ref={box} className="member-map" style={{ height: 380, background: "var(--char)" }} aria-label="Map of where members live, by postcode area" />
          <div style={{ padding: "12px 22px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
            {data && (
              <div className="small muted">
                {data.withArea} of {data.activeMembers} active members have a postcode on TeamUp. Bigger circle, more members.
                {data.withArea === 0 && " Postcodes come in with the next TeamUp sync."}
              </div>
            )}
            {data && data.areas.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {data.areas.slice(0, 12).map((a) => <span key={a.area} className="chip">{a.area} · {a.members}</span>)}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
