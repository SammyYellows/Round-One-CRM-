"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { moveStage } from "../actions";

export type BoardCard = { id: number; name: string; source: string; value: number; nextAppt: string | null; stageChangedAt: string };
type Column = { key: string; label: string; color: string; cards: BoardCard[]; value: number };

const money = (p: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(p / 100);
const apptFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default function Board({ columns }: { columns: Column[] }) {
  const [, start] = useTransition();
  const [over, setOver] = useState<string | null>(null);
  const [cols, move] = useOptimistic(columns, (state, { id, to }: { id: number; to: string }) => {
    const card = state.flatMap((c) => c.cards).find((c) => c.id === id);
    if (!card) return state;
    return state.map((c) => ({
      ...c,
      cards: c.key === to ? [card, ...c.cards.filter((x) => x.id !== id)] : c.cards.filter((x) => x.id !== id),
    }));
  });

  return (
    <div className="board">
      {cols.map((col) => (
        <div
          key={col.key}
          className={`col ${over === col.key ? "drop" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(col.key);
          }}
          onDragLeave={() => setOver(null)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(null);
            const id = Number(e.dataTransfer.getData("text/plain"));
            if (!id || col.cards.some((c) => c.id === id)) return;
            start(async () => {
              move({ id, to: col.key });
              await moveStage(id, col.key);
            });
          }}
        >
          <div className="col-head" style={{ borderTopColor: col.color }}>
            <b>{col.label}</b>
            <div className="count">
              {col.cards.length} opportunities · {money(col.value)}
            </div>
          </div>
          {col.cards.map((c) => (
            <div key={c.id} className="lead-card" draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", String(c.id))}>
              <Link href={`/admin/leads/${c.id}`} className="name">
                {c.name}
              </Link>
              <div className="meta">
                <span>Source:</span>
                <span>{c.source}</span>
                <span>Value:</span>
                <span>{money(c.value)}</span>
              </div>
              {c.nextAppt && (
                <div style={{ marginTop: 6 }}>
                  <span className="badge" style={{ background: "#e0f2fe", color: "#0369a1" }}>
                    📅 {apptFmt.format(new Date(c.nextAppt))}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
