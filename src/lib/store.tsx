"use client";

// The CRM's data for the staff screens. Two modes:
//
// - Live (Supabase settings present): data comes from /api/state. A change
//   such as act("setStage", id, stage) shows on screen straight away, is sent
//   to /api/actions, and the server's saved version then replaces it.
// - Local (no Supabase settings, e.g. a fresh clone): the original prototype.
//   Sample data in localStorage, with the prototype clock and Reset.
//
// Pages don't need to know which mode they're in; they call act() either way.

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { ActionArgs, ActionName, runAction } from "./actions";
import { nowMs, tick } from "./engine";
import { seed } from "./seed";
import { State } from "./types";

export const LIVE = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

// Bump VERSION (and State.version in types.ts) whenever the data shape
// changes. Saved or in-memory data from an older shape is thrown away and
// replaced with fresh sample data, rather than crashing a page.
const VERSION = 5;
const KEY = `round-one-crm:v${VERSION}`;

type Act = <N extends ActionName>(name: N, ...args: ActionArgs<N>) => void;

interface Store {
  s: State;
  now: number;
  act: Act;
  reset: () => void;
  live: boolean;
}

const Ctx = createContext<Store | null>(null);

function isCurrent(x: unknown): x is State {
  const v = x as State | null;
  return !!v && v.version === VERSION && Array.isArray(v.history) && Array.isArray(v.campaigns) && v.campaigns.every((c) => Array.isArray(c.ads));
}

/** A copy of the state with any automation steps that are now due run. */
function advance(prev: State) {
  const d = structuredClone(prev);
  tick(d);
  return d;
}

/** Apply a change to a copy of the state, then run anything now due. */
function applied<N extends ActionName>(prev: State, name: N, args: ActionArgs<N>) {
  const d = structuredClone(prev);
  runAction(d, name, args);
  tick(d);
  return d;
}

// ---- Local prototype ------------------------------------------------------

function loadLocal(): State {
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

function useLocalStore(): Store | null {
  const [s, setS] = useState<State | null>(null);

  useEffect(() => {
    setS(loadLocal());
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

  const act = useCallback<Act>((name, ...args) => setS((prev) => (prev ? applied(prev, name, args) : prev)), []);

  // Run anything that has come due, and keep relative times fresh.
  useEffect(() => {
    const t = setInterval(() => setS((prev) => (prev ? advance(prev) : prev)), 30000);
    return () => clearInterval(t);
  }, []);

  const reset = useCallback(() => setS(seed(Date.now())), []);
  return isCurrent(s) ? { s, now: nowMs(s), act, reset, live: false } : null;
}

// ---- Live (Supabase) ------------------------------------------------------

function useLiveStore(onError: (msg: string) => void): Store | null {
  const [s, setS] = useState<State | null>(null);
  const pending = useRef(0);
  const queue = useRef<Promise<void>>(Promise.resolve());

  const fetchState = useCallback(async () => {
    const res = await fetch("/api/state", { cache: "no-store" });
    if (res.status === 401) {
      window.location.href = "/login";
      return;
    }
    if (!res.ok) throw new Error(`Couldn’t load the CRM (${res.status}).`);
    const next = await res.json();
    // Don't overwrite changes still on their way to the server.
    if (pending.current === 0 && isCurrent(next)) setS(next);
  }, []);

  const refresh = useCallback(() => {
    fetchState().catch((e) => onError(e.message));
  }, [fetchState, onError]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);

  const act = useCallback<Act>(
    (name, ...args) => {
      // Show the change straight away...
      setS((prev) => (prev ? applied(prev, name, args) : prev));
      // ...then save it. Changes are sent one at a time, in order.
      pending.current += 1;
      queue.current = queue.current.then(async () => {
        let failed = false;
        try {
          const res = await fetch("/api/actions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, args }),
          });
          const body = await res.json().catch(() => null);
          if (!res.ok) throw new Error(body?.error ?? "Couldn’t save that change.");
          // Only the last change in the queue replaces the screen with the saved version.
          if (pending.current === 1 && isCurrent(body)) setS(body);
        } catch (e) {
          failed = true;
          onError(e instanceof Error ? e.message : "Couldn’t save that change.");
        } finally {
          pending.current -= 1;
        }
        if (failed) await fetchState().catch(() => undefined);
      });
    },
    [fetchState, onError],
  );

  return isCurrent(s) ? { s, now: nowMs(s), act, reset: () => undefined, live: true } : null;
}

// ---- Provider -------------------------------------------------------------

function ErrorBar({ msg, onClose }: { msg: string; onClose: () => void }) {
  return (
    <div role="alert" style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 50, background: "var(--red-btn)", color: "var(--white)", padding: "12px 24px", display: "flex", gap: 16, alignItems: "center", justifyContent: "space-between" }}>
      <span className="small">{msg} We’ve reloaded the latest version.</span>
      <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
    </div>
  );
}

function LiveProvider({ children }: { children: React.ReactNode }) {
  const [error, setError] = useState<string | null>(null);
  const store = useLiveStore(setError);
  if (!store) return <div className="loading">{error ?? "Loading"}</div>;
  return (
    <Ctx.Provider value={store}>
      {children}
      {error && <ErrorBar msg={error} onClose={() => setError(null)} />}
    </Ctx.Provider>
  );
}

function LocalProvider({ children }: { children: React.ReactNode }) {
  const store = useLocalStore();
  if (!store) return <div className="loading">Loading</div>;
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function StoreProvider({ children, local }: { children: React.ReactNode; local?: boolean }) {
  return LIVE && !local ? <LiveProvider>{children}</LiveProvider> : <LocalProvider>{children}</LocalProvider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore must be used inside StoreProvider");
  return v;
}
