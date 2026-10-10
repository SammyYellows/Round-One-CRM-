"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext } from "react";
import { isManagementPath, isManagerRole } from "@/lib/roles";

// The signed-in staff member, for showing or hiding management-only things.
// The server checks again for every change; this only keeps screens tidy.

type StaffInfo = { name: string; role: string } | undefined;
const Ctx = createContext<StaffInfo>(undefined);

export function StaffProvider({ staff, children }: { staff: StaffInfo; children: React.ReactNode }) {
  return <Ctx.Provider value={staff}>{children}</Ctx.Provider>;
}

export const useStaff = () => useContext(Ctx);
/** True for Owner and Manager logins, and in the prototype (no login at all). */
export const useIsManager = () => { const s = useContext(Ctx); return !s || isManagerRole(s.role); };

/** Stops staff logins opening management screens by typing the address. */
export function RoleGate({ children }: { children: React.ReactNode }) {
  const path = usePathname() ?? "/";
  const manager = useIsManager();
  if (!manager && isManagementPath(path)) {
    return (
      <div className="card pad" style={{ maxWidth: 520 }}>
        <div className="label" style={{ margin: 0 }}>Management only</div>
        <p className="small muted">This screen is for management logins. If you need something from it, ask a manager, or ask Champ.</p>
        <Link href="/" className="btn btn-ghost btn-sm">Back to Today</Link>
      </div>
    );
  }
  return <>{children}</>;
}
