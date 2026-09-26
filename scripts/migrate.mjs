// Applies any new SQL files in supabase/migrations to a Supabase project, in
// filename order, and records each one so it only ever runs once.
//
//   SUPABASE_ACCESS_TOKEN=sbp_... SUPABASE_PROJECT_REF=abc123 npm run db:migrate
//
// Uses the Supabase Management API, so it needs no database password and no
// extra packages. SUPABASE_DEV_PROJECT_REF is used if SUPABASE_PROJECT_REF is
// not set.

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF || process.env.SUPABASE_DEV_PROJECT_REF;
if (!token || !ref) {
  console.error("Set SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF first.");
  process.exit(1);
}

async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${body}`);
  return body ? JSON.parse(body) : [];
}

const dir = join(process.cwd(), "supabase", "migrations");
const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

// Kept outside the public schema, so the Data API never exposes it.
await query(`
  create schema if not exists ops;
  create table if not exists ops.migrations (name text primary key, applied_at timestamptz not null default now());
`);
const done = new Set((await query("select name from ops.migrations")).map((r) => r.name));

let applied = 0;
for (const file of files) {
  if (done.has(file)) continue;
  const sql = await readFile(join(dir, file), "utf8");
  const name = file.replaceAll("'", "''");
  await query(`begin;\n${sql}\ninsert into ops.migrations (name) values ('${name}');\ncommit;`);
  console.log(`Applied ${file}`);
  applied++;
}
console.log(applied ? `${applied} migration(s) applied to ${ref}.` : `Nothing to apply; ${ref} is up to date.`);
