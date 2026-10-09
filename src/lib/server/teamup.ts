// TeamUp's API (https://goteamup.com/api/v2), server-only. TeamUp is Round
// One's membership system and stays the source of truth: the CRM only reads
// from it (docs/teamup-members.md). Needs TEAMUP_M2M_TOKEN (a machine-to-
// machine token made in TeamUp's dashboard) and TEAMUP_PROVIDER_ID.

import { CustomerInput, MemberInput } from "@/lib/engine";
import type { Membership } from "@/lib/types";

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

/**
 * The CRM's one write into TeamUp so far (improvement item 15, Sammy
 * 08/10/2026: "both"): put a membership on hold from today, open-ended,
 * which also cuts their Kisi door access. Always behind a confirm on the
 * screen; TeamUp stays the place to take the hold off again.
 */
export async function holdMembership(customerMembershipId: string, startDate: string): Promise<{ id: string }> {
  const res = await fetch(`${BASE}/customer_membership_holds`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.TEAMUP_M2M_TOKEN}`, "Teamup-Provider-ID": process.env.TEAMUP_PROVIDER_ID ?? "", Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ customer_membership: Number(customerMembershipId), start_date: startDate, end_date: null, prorate_usage: true }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(`TeamUp ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  return { id: String(json.id ?? "") };
}

/** One GET, for callers that page themselves (attendance.ts). Takes a path or a full "next" URL. */
export const fetchJson = (path: string, params: Record<string, string> = {}) => get(path, params);

/**
 * Every page of a list endpoint (100 per page). The first page says how
 * many there are, so the rest are fetched four at a time rather than one
 * after another (TeamUp allows 250 requests a minute).
 */
async function list(path: string, params: Record<string, string> = {}): Promise<Json[]> {
  const first = await get(path, { page_size: "100", page: "1", ...params });
  const out: Json[] = [...((first.results as Json[]) ?? [])];
  const total = Number(first.count ?? out.length) || out.length;
  const pages = Math.ceil(total / 100);
  for (let from = 2; from <= pages; from += 4) {
    const batch = await Promise.all(Array.from({ length: Math.min(4, pages - from + 1) }, (_, i) => get(path, { page_size: "100", page: String(from + i), ...params })));
    for (const pg of batch) out.push(...((pg.results as Json[]) ?? []));
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
// TeamUp keeps a membership row after the customer is deleted, with the name
// "(Deleted Customer)" and no details. Nothing to contact; leave them out.
const isDeletedPlaceholder = (name: string, email: string) => !email && /deleted customer/i.test(name);

export function readMembership(row: Json, categories: Map<string, string>): MemberInput | null {
  const customer = obj(row.customer);
  const membership = obj(row.membership);
  const customerId = idOf(row.customer);
  if (!customerId) return null;
  if (isDeletedPlaceholder(str(customer.name, customer.full_name, `${str(customer.first_name)} ${str(customer.last_name)}`), str(customer.email))) return null;
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
    cancelling: row.is_set_for_cancellation === true,
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
  const name = str(row.name, row.full_name, `${first} ${last}`.trim());
  if (isDeletedPlaceholder(name, str(row.email, row.email_address))) return null;
  return {
    customerId,
    name,
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

/**
 * Failed payments, from two places in TeamUp: each payment subscription's
 * retry_count (attempts that failed), keyed by subscription id, which a
 * customer_membership row points at; and unpaid invoices, keyed by payer.
 * An unpaid invoice is "open" or, once TeamUp has given up retrying the
 * card, "retry_failed" (found 08/10/2026: that is where a failed payment
 * actually ends up). £0 invoices are ignored.
 */
type Owed = NonNullable<Membership["owed"]>;

export async function fetchPaymentInfo(): Promise<{ retries: Map<string, number>; owed: Map<string, Owed> }> {
  const [subs, open, retryFailed] = await Promise.all([list("/payment_subscriptions"), list("/invoices", { status: "open" }), list("/invoices", { status: "retry_failed" })]);
  const retries = new Map(subs.map((x) => [idOf(x.id), Number(x.retry_count ?? 0) || 0]));
  const owed = new Map<string, Owed>();
  for (const inv of [...open, ...retryFailed]) {
    const payer = idOf(inv.payer);
    const amount = Number(obj(inv.total_amount_due).decimal ?? 0) || 0;
    if (!payer || amount <= 0) continue;
    const cur = owed.get(payer) ?? { count: 0, total: 0, invoices: [] };
    cur.count++;
    cur.total = Math.round((cur.total + amount) * 100) / 100;
    const due = String(inv.due_date ?? "").slice(0, 10);
    if (due && (!cur.since || due < cur.since)) cur.since = due;
    if (due && (!cur.latest || due > cur.latest)) cur.latest = due;
    cur.invoices!.push({ id: idOf(inv.id), due, amount, status: String(inv.status) === "retry_failed" ? "retry_failed" : "open" });
    owed.set(payer, cur);
  }
  // Newest first, at most two years' worth per person.
  for (const o of owed.values()) o.invoices = o.invoices!.sort((a, b) => b.due.localeCompare(a.due)).slice(0, 24);
  return { retries, owed };
}

/** Payment info in a shape that survives a trip through JSON (the staged sync keeps it between calls). */
export type PaymentInfoJson = { retries: Record<string, number>; owed: Record<string, Owed> };
export const paymentInfoToJson = (p: { retries: Map<string, number>; owed: Map<string, Owed> }): PaymentInfoJson => ({ retries: Object.fromEntries(p.retries), owed: Object.fromEntries(p.owed) });

/**
 * Everyone with a membership in TeamUp, plus the raw rows for the audit
 * copy. Pass `payments` (from fetchPaymentInfo, possibly read in an earlier
 * stage) to attach failed-payment counts; without it they're left at 0 and
 * filled in by `attachPayments`.
 */
export async function fetchMembers(payments?: PaymentInfoJson): Promise<{ members: MemberInput[]; raw: { id: string; customer_id: string; raw: Json }[] }> {
  const [cats, rows] = await Promise.all([list("/membership_categories"), list("/customer_memberships", { expand: "customer,membership" })]);
  const categories = new Map(cats.map((c) => [idOf(c.id), String(c.name ?? "")]));
  const members: MemberInput[] = [];
  const raw: { id: string; customer_id: string; raw: Json }[] = [];
  for (const row of rows) {
    const m = readMembership(row, categories);
    if (!m) continue;
    m.paymentSubscriptionId = idOf(row.payment_subscription) || undefined;
    members.push(m);
    raw.push({ id: idOf(row.id) || `${m.customerId}-${m.membershipName}`, customer_id: m.customerId, raw: row });
  }
  if (payments) attachPayments(members, payments);
  return { members, raw };
}

/** Puts failed-payment counts and unpaid invoices onto memberships. */
export function attachPayments(members: MemberInput[], payments: PaymentInfoJson) {
  for (const m of members) {
    m.paymentRetries = (m.paymentSubscriptionId && payments.retries[m.paymentSubscriptionId]) || 0;
    m.owed = payments.owed[m.customerId];
  }
}

/** One customer's memberships, for a webhook nudge. */
export async function fetchCustomerMembers(customerId: string): Promise<MemberInput[]> {
  const cats = await list("/membership_categories");
  const categories = new Map(cats.map((c) => [idOf(c.id), String(c.name ?? "")]));
  const [rows, payments] = await Promise.all([list("/customer_memberships", { expand: "customer,membership", customer: customerId }), fetchPaymentInfo()]);
  const members = rows.map((r) => { const m = readMembership(r, categories); if (m) m.paymentSubscriptionId = idOf(r.payment_subscription) || undefined; return m; }).filter((m): m is MemberInput => !!m);
  attachPayments(members, paymentInfoToJson(payments));
  return members;
}
