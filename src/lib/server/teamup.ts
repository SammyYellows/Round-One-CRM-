// TeamUp's API (https://goteamup.com/api/v2), server-only. TeamUp is Round
// One's membership system and stays the source of truth: the CRM only reads
// from it (docs/teamup-members.md). Needs TEAMUP_M2M_TOKEN (a machine-to-
// machine token made in TeamUp's dashboard) and TEAMUP_PROVIDER_ID.

import { CustomerInput, MemberInput } from "@/lib/engine";

const BASE = "https://goteamup.com/api/v2";

export const teamupConfigured = () => Boolean(process.env.TEAMUP_M2M_TOKEN && process.env.TEAMUP_PROVIDER_ID);

type Json = Record<string, unknown>;

async function get(path: string, params: Record<string, string> = {}, attempt = 0): Promise<Json> {
  const url = new URL(path.startsWith("http") ? path : `${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.TEAMUP_M2M_TOKEN}`, "Teamup-Provider-ID": process.env.TEAMUP_PROVIDER_ID ?? "", Accept: "application/json" },
    cache: "no-store",
  });
  if (res.status === 429 && attempt < 4) {
    // 250 requests a minute per caller; back off and try again.
    await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
    return get(path, params, attempt + 1);
  }
  if (!res.ok) throw new Error(`TeamUp ${res.status} for ${url.pathname}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as Json;
}

/** Every page of a list endpoint (100 per page). */
async function list(path: string, params: Record<string, string> = {}): Promise<Json[]> {
  const out: Json[] = [];
  let page: Json | null = await get(path, { page_size: "100", ...params });
  while (page) {
    out.push(...((page.results as Json[]) ?? []));
    page = typeof page.next === "string" ? await get(page.next) : null;
  }
  return out;
}

// TeamUp objects come back as an id or, when expanded, the object itself.
const idOf = (v: unknown): string => (v && typeof v === "object" ? String((v as Json).id ?? "") : v == null ? "" : String(v));
const obj = (v: unknown): Json => (v && typeof v === "object" ? (v as Json) : {});
const str = (...vals: unknown[]) => {
  for (const v of vals) if (typeof v === "string" && v.trim()) return v.trim();
  return "";
};
const iso = (v: unknown) => {
  if (typeof v !== "string" || !v) return undefined;
  const t = Date.parse(v);
  return Number.isNaN(t) ? undefined : new Date(t).toISOString();
};

/**
 * Reads one TeamUp customer_membership (with its customer and membership
 * expanded) into what the engine needs. Field names are read with fallbacks
 * because TeamUp's docs don't list them; see the raw copies in teamup_members
 * if something looks wrong.
 */
export function readMembership(row: Json, categories: Map<string, string>): MemberInput | null {
  const customer = obj(row.customer);
  const membership = obj(row.membership);
  const customerId = idOf(row.customer);
  if (!customerId) return null;
  const first = str(customer.first_name, customer.given_name);
  const last = str(customer.last_name, customer.family_name);
  const name = str(customer.name, customer.full_name, `${first} ${last}`.trim());
  const categoryId = idOf(membership.category ?? membership.membership_category);
  const category = str(obj(membership.category).name, categories.get(categoryId), "Uncategorised");
  // Real values seen on Round One's account (05/10/2026): active, hold,
  // cancelled, completed (a prepaid plan such as the 28 Day Program that ran
  // to its end). TeamUp's customer records carry no phone number, so phone
  // stays empty and matching is on TeamUp id or email.
  const rawStatus = str(row.status, row.state).toLowerCase();
  const onHold = rawStatus.includes("hold") || rawStatus.includes("pause") || row.is_on_hold === true || row.on_hold === true;
  const ended =
    rawStatus.includes("expir") || rawStatus.includes("cancel") || rawStatus.includes("complet") || rawStatus.includes("inactive") ||
    rawStatus.includes("ended") || row.is_active === false || row.active === false || !!row.canceled_at || !!row.cancelled_at;
  return {
    customerId,
    id: idOf(row.id),
    name,
    email: str(customer.email, customer.email_address).toLowerCase(),
    phone: str(customer.phone_number, customer.mobile_phone, customer.mobile, customer.phone, customer.telephone),
    membershipName: str(membership.name, "Membership"),
    category,
    status: ended ? "ended" : onHold ? "on_hold" : "active",
    createdAt: iso(customer.created_at),
    startedAt: iso(row.start_date ?? row.starts_at ?? row.started_at ?? row.created_at),
    endsAt: iso(row.expiration_date ?? row.expires_at ?? row.end_date ?? row.ends_at ?? row.renewal_date ?? row.next_payment_date ?? row.renews_at),
  };
}

/** One TeamUp customer row (with or without a membership). */
export function readCustomer(row: Json): CustomerInput | null {
  const customerId = idOf(row.id);
  if (!customerId) return null;
  const first = str(row.first_name, row.given_name);
  const last = str(row.last_name, row.family_name);
  return {
    customerId,
    name: str(row.name, row.full_name, `${first} ${last}`.trim()),
    email: str(row.email, row.email_address).toLowerCase(),
    phone: str(row.phone_number, row.mobile_phone, row.mobile, row.phone),
    status: str(row.status) || undefined,
    createdAt: iso(row.created_at),
  };
}

/** Every customer in TeamUp, members or not. */
export async function fetchCustomers(): Promise<CustomerInput[]> {
  const rows = await list("/customers");
  return rows.map(readCustomer).filter((c): c is CustomerInput => !!c);
}

/** Everyone with a membership in TeamUp, plus the raw rows for the audit copy. */
export async function fetchMembers(): Promise<{ members: MemberInput[]; raw: { id: string; customer_id: string; raw: Json }[] }> {
  const cats = await list("/membership_categories");
  const categories = new Map(cats.map((c) => [idOf(c.id), String(c.name ?? "")]));
  const rows = await list("/customer_memberships", { expand: "customer,membership" });
  const members: MemberInput[] = [];
  const raw: { id: string; customer_id: string; raw: Json }[] = [];
  for (const row of rows) {
    const m = readMembership(row, categories);
    if (!m) continue;
    members.push(m);
    raw.push({ id: idOf(row.id) || `${m.customerId}-${m.membershipName}`, customer_id: m.customerId, raw: row });
  }
  return { members, raw };
}

/** One customer's memberships, for a webhook nudge. */
export async function fetchCustomerMembers(customerId: string): Promise<MemberInput[]> {
  const cats = await list("/membership_categories");
  const categories = new Map(cats.map((c) => [idOf(c.id), String(c.name ?? "")]));
  const rows = await list("/customer_memberships", { expand: "customer,membership", customer: customerId });
  return rows.map((r) => readMembership(r, categories)).filter((m): m is MemberInput => !!m);
}
