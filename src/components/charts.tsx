"use client";

// Small, dependency-free charts in Round One's style: one series per chart,
// brand red marks, recessive grey grid, square ends, 2px gaps between bars,
// hover tooltips, and a hidden table for screen readers.

import { useEffect, useRef, useState } from "react";

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

const niceMax = (v: number) => {
  if (v <= 0) return 1;
  const step = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / step;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * step;
};

export interface ColumnDatum {
  key: string;
  label: string; // x-axis label (may be blank to skip)
  tip: string; // tooltip heading
  value: number;
  emphasis?: boolean; // e.g. today
}

/** Column chart with a crosshair-style hover tooltip on each column. */
export function ColumnChart({
  data, height = 200, format = String, unit, summary, avg,
}: {
  data: ColumnDatum[];
  height?: number;
  format?: (n: number) => string;
  unit: string;
  summary: string;
  avg?: number; // draws a dashed average line with a label
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const padL = 32, padB = 22, padT = 8;
  const plotW = Math.max(0, width - padL);
  const plotH = height - padB - padT;
  const max = niceMax(Math.max(...data.map((d) => d.value), avg ?? 0));
  const ticks = [0, max / 2, max];
  const slot = data.length ? plotW / data.length : 0;
  const gap = 2;
  const barW = Math.max(1, slot - gap);
  const y = (v: number) => padT + plotH - (v / max) * plotH;
  const h = hover !== null ? data[hover] : null;

  return (
    <div ref={ref} className="chart" style={{ height }} onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={summary}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={width} y1={y(t)} y2={y(t)} className="grid-line" />
              <text x={padL - 6} y={y(t) + 4} textAnchor="end" className="axis-text">{format(t)}</text>
            </g>
          ))}
          {data.map((d, i) => {
            const x = padL + i * slot + gap / 2;
            return (
              <g key={d.key}>
                <rect
                  x={x} y={y(d.value)} width={barW} height={Math.max(0, plotH + padT - y(d.value))}
                  className={`bar ${d.emphasis ? "bar-em" : ""} ${hover !== null && hover !== i ? "bar-dim" : ""}`}
                />
                {d.label && <text x={x + barW / 2} y={height - 6} textAnchor="middle" className="axis-text">{d.label}</text>}
                {/* Hit target: the whole column, taller than the bar. */}
                <rect x={padL + i * slot} y={padT} width={slot} height={plotH} fill="transparent" onMouseEnter={() => setHover(i)} />
              </g>
            );
          })}
          {avg !== undefined && avg > 0 && (
            <g pointerEvents="none">
              <line x1={padL} x2={width} y1={y(avg)} y2={y(avg)} className="avg-line" />
              <text x={width - 4} y={y(avg) - 5} textAnchor="end" className="axis-text">avg {format(Math.round(avg * 10) / 10)}</text>
            </g>
          )}
        </svg>
      )}
      {h && hover !== null && (
        <div
          className="tip"
          style={{ left: Math.min(Math.max(padL + hover * slot + slot / 2, 60), width - 60), top: Math.max(0, y(h.value) - 52) }}
        >
          <div className="tip-h">{h.tip}</div>
          <div><strong>{format(h.value)}</strong> {unit}</div>
        </div>
      )}
      <table className="sr-only">
        <caption>{summary}</caption>
        <tbody>{data.map((d) => <tr key={d.key}><th>{d.tip}</th><td>{format(d.value)} {unit}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

/** Tiny trend line for a stat tile. Decorative: the tile states the number. */
export function Sparkline({ values, height = 36 }: { values: number[]; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => [(i / Math.max(1, values.length - 1)) * (width - 6) + 3, height - 4 - (v / max) * (height - 10)]);
  const last = pts[pts.length - 1];
  return (
    <div ref={ref} style={{ height }} aria-hidden="true">
      {width > 0 && pts.length > 1 && (
        <svg width={width} height={height}>
          <polyline points={pts.map((p) => p.join(",")).join(" ")} className="spark" />
          <rect x={last[0] - 4} y={last[1] - 4} width={8} height={8} className="spark-dot" />
        </svg>
      )}
    </div>
  );
}

/** Horizontal bars with direct labels. Good for few categories. */
export function BarList({
  rows, format = String, summary, max: fixedMax,
}: {
  rows: { key: string; label: string; value: number; note?: string; href?: string }[];
  format?: (n: number) => string;
  summary: string;
  max?: number;
}) {
  const max = fixedMax ?? Math.max(...rows.map((r) => r.value), 1);
  return (
    <div role="list" aria-label={summary} className="barlist">
      {rows.map((r) => (
        <div key={r.key} role="listitem" className="barlist-row">
          <div className="barlist-top">
            <span>{r.label}</span>
            <span className="num"><strong>{format(r.value)}</strong>{r.note ? <span className="faint"> · {r.note}</span> : null}</span>
          </div>
          <div className="barlist-track">
            <div className="barlist-fill" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** A single proportion, drawn as a filled bar with the big number beside it. */
export function Meter({ value, label }: { value: number; label: string }) {
  const pct = Math.round(value * 100);
  return (
    <div role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={label} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="barlist-track" style={{ height: 14 }}>
        <div className="barlist-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
