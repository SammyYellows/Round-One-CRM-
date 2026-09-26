import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "crm.db");

declare global {
  // eslint-disable-next-line no-var
  var __crmDb: Database.Database | undefined;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'Instagram',
  campaign TEXT,
  stage TEXT NOT NULL DEFAULT 'lead',
  value_pence INTEGER NOT NULL DEFAULT 0,
  qualified INTEGER NOT NULL DEFAULT 1,
  disqualify_reason TEXT,
  answers_json TEXT NOT NULL DEFAULT '{}',
  whatsapp_opt_in INTEGER NOT NULL DEFAULT 1,
  -- set once a WhatsApp message fails to deliver; later messages go by SMS
  sms_fallback INTEGER NOT NULL DEFAULT 0,
  last_inbound_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  stage_changed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS leads_stage ON leads(stage);
CREATE INDEX IF NOT EXISTS leads_phone ON leads(phone);
CREATE INDEX IF NOT EXISTS leads_email ON leads(email);

CREATE TABLE IF NOT EXISTS stage_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS stage_history_lead ON stage_history(lead_id);

CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  -- booked | confirmed | attended | no_show | cancelled
  status TEXT NOT NULL DEFAULT 'booked',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS appointments_starts ON appointments(starts_at);
CREATE INDEX IF NOT EXISTS appointments_lead ON appointments(lead_id);

CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  -- form | stage | note | booking | message_out | message_in | automation
  type TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS activities_lead ON activities(lead_id);

CREATE TABLE IF NOT EXISTS enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  workflow TEXT NOT NULL,
  appointment_id INTEGER,
  -- branch taken by conditional steps, e.g. 'cancelled' vs 'no_show'
  variant TEXT,
  -- active | completed | removed
  status TEXT NOT NULL DEFAULT 'active',
  enrolled_at TEXT NOT NULL,
  ended_at TEXT
);
CREATE INDEX IF NOT EXISTS enrollments_lead ON enrollments(lead_id);

CREATE TABLE IF NOT EXISTS scheduled_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  enrollment_id INTEGER NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  workflow TEXT NOT NULL,
  step TEXT NOT NULL,
  -- whatsapp | sms | email | internal
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  send_at TEXT NOT NULL,
  -- pending | sending | sent | failed | cancelled | skipped
  status TEXT NOT NULL DEFAULT 'pending',
  body TEXT,
  error TEXT,
  provider_id TEXT,
  sent_at TEXT
);
CREATE INDEX IF NOT EXISTS scheduled_provider ON scheduled_messages(provider_id);
CREATE INDEX IF NOT EXISTS scheduled_due ON scheduled_messages(status, send_at);
`;

export function db(): Database.Database {
  if (!globalThis.__crmDb) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    const d = new Database(DB_PATH);
    d.pragma("journal_mode = WAL");
    d.pragma("foreign_keys = ON");
    d.exec(SCHEMA);
    globalThis.__crmDb = d;
  }
  return globalThis.__crmDb;
}

export const nowIso = () => new Date().toISOString();
