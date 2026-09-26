"use client";

// Prototype-only store: the whole CRM lives in localStorage so it can be
// played with before the backend exists. Other tabs stay in sync, so you can
// submit the public form in one tab and watch the lead land in another.
// When Supabase is ready, replace this with fetches to src/app/api/*.

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { nowMs, tick } from "./engine";
import { seed } from "./seed";
import { State } from "./types";

// Bump VERSION (and State.version in types.ts) whenever the data shape
// changes. Saved or in-memory data from an older shape is thrown away and
// replaced with fresh sample data, rather than crashing a page.
const VERSION = 3;
const KEY = `round-one-crm:v${VERSION}`;

interface Store {
  s: State;
  now: number;
  act: (fn: (draft: State) => void) => void;
  reset: () => void;
}

const Ctx = createContext<Store | null>(null);

function isCurrent(x: unknown): x is State {
  const v = x as State | null;
  return !!v && v.version === VERSION && Array.isArray(v.history) && Array.isArray(v.campaigns) && v.campaigns.every((c) => Array.isArray(c.ads));
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (isCurrent(parsed)) return parsed;
    }
  } catch {
    // fall through to fresh sample data
  }
  return seed(Date.now());
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [s, setS] = useState<State | null>(null);

  useEffect(() => {
    setS(load());
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEY || !e.newValue) return;
      try {
        const next = JSON.parse(e.newValue);
        if (isCurrent(next)) setS(next);
      } catch {
        // ignore a half-written value from another tab
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // A tab that was open across an update can hold old-shape data in memory.
  useEffect(() => {
    if (s && !isCurrent(s)) setS(seed(Date.now()));
  }, [s]);

  useEffect(() => {
    if (!isCurrent(s)) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      // storage full or blocked: the prototype keeps working in memory
    }
  }, [s]);

  const act = useCallback((fn: (draft: State) => void) => {
    setS((prev) => {
      if (!prev) return prev;
      const d = structuredClone(prev);
      fn(d);
      tick(d);
      return d;
    });
  }, []);

  // Run anything that has come due, and keep relative times fresh.
  useEffect(() => {
    const t = setInterval(() => act(() => {}), 30000);
    return () => clearInterval(t);
  }, [act]);

  const reset = useCallback(() => setS(seed(Date.now())), []);

  if (!isCurrent(s)) return <div className="loading">Loading</div>;
  return <Ctx.Provider value={{ s, now: nowMs(s), act, reset }}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore must be used inside StoreProvider");
  return v;
}
