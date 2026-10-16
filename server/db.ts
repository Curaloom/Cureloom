import Database from 'better-sqlite3';

export type DB = Database.Database;

// The nine tables from the build brief, plus `practice` for the operator's
// client practices and `demo` for the demo clock and other prototype-only
// settings. A few columns go beyond the brief where the walkthroughs need them
// (call scheduling, flag acknowledgement deadline, task kind, eligibility
// verification); each is marked below.

/** Bump when the schema changes: an older database file is rebuilt from the seed. */
export const SCHEMA_VERSION = 2;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS practice (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  phone TEXT NOT NULL,
  physician TEXT NOT NULL,
  care_manager TEXT NOT NULL,
  simulated INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS patient (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  practice_id INTEGER NOT NULL REFERENCES practice(id),
  care_manager TEXT NOT NULL,
  mrn TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  dob TEXT NOT NULL,
  phone TEXT NOT NULL,
  state TEXT NOT NULL,
  coverage TEXT NOT NULL CHECK (coverage IN ('traditional', 'advantage')),
  is_qmb INTEGER NOT NULL DEFAULT 0,
  qualifying_codes TEXT NOT NULL DEFAULT '[]',
  last_visit_date TEXT,
  caregiver_name TEXT,
  caregiver_phone TEXT,
  preferred_language TEXT NOT NULL DEFAULT 'English',
  prefers_human INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('eligible_unconfirmed', 'confirmed', 'consented', 'active',
    'ineligible', 'needs_visit', 'opted_out', 'paused')),
  ineligible_reason TEXT,
  program TEXT CHECK (program IN ('ccm', 'apcm')),
  -- beyond the brief: eligibility verification and the documented risk basis
  coverage_verified_on TEXT,
  qmb_verified_on TEXT,
  risk_note TEXT,
  risk_note_by TEXT,
  risk_note_at TEXT
);

CREATE TABLE IF NOT EXISTS consent (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patient(id),
  method TEXT NOT NULL CHECK (method IN ('at_visit', 'nurse_phone')),
  consent_date TEXT NOT NULL,
  captured_by TEXT NOT NULL,
  explained_availability INTEGER NOT NULL DEFAULT 0,
  explained_cost_sharing INTEGER NOT NULL DEFAULT 0,
  explained_one_practitioner INTEGER NOT NULL DEFAULT 0,
  explained_right_to_stop INTEGER NOT NULL DEFAULT 0,
  automated_calls_ok INTEGER NOT NULL DEFAULT 0,
  texts_ok INTEGER NOT NULL DEFAULT 0,
  revoked_at TEXT
);

CREATE TABLE IF NOT EXISTS call_setup (
  patient_id INTEGER PRIMARY KEY REFERENCES patient(id),
  readings TEXT NOT NULL DEFAULT '[]',
  symptoms_to_watch TEXT NOT NULL DEFAULT '[]',
  targets TEXT NOT NULL DEFAULT '{}',
  ehr_plan_reviewed_on TEXT
);

CREATE TABLE IF NOT EXISTS call (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patient(id),
  kind TEXT NOT NULL CHECK (kind IN ('ai', 'nurse')),
  -- beyond the brief: scheduling, so calls can be planned, retried and cancelled
  status TEXT NOT NULL DEFAULT 'done' CHECK (status IN ('scheduled', 'in_progress', 'done', 'cancelled')),
  scheduled_for TEXT,
  attempt INTEGER NOT NULL DEFAULT 1,
  purpose TEXT,
  started_at TEXT,
  ended_at TEXT,
  outcome TEXT CHECK (outcome IN ('completed', 'no_answer', 'declined', 'escalated', 'opted_out')),
  answered_by TEXT CHECK (answered_by IN ('patient', 'caregiver')),
  transcript TEXT NOT NULL DEFAULT '[]',
  answers TEXT,
  flag TEXT NOT NULL DEFAULT 'none' CHECK (flag IN ('none', 'concern', 'urgent')),
  -- beyond the brief: the nurse's own summary, and when she reviewed an AI call
  nurse_note TEXT,
  reviewed_at TEXT
);

CREATE TABLE IF NOT EXISTS task (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patient(id),
  title TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  due TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
  -- beyond the brief: what kind of work, when, and from which call
  kind TEXT NOT NULL DEFAULT 'other',
  created_at TEXT NOT NULL,
  closed_at TEXT,
  close_note TEXT,
  call_id INTEGER
);

CREATE TABLE IF NOT EXISTS flag (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patient(id),
  call_id INTEGER,
  level TEXT NOT NULL CHECK (level IN ('concern', 'urgent')),
  rule TEXT NOT NULL,
  raised_at TEXT NOT NULL,
  acknowledged_at TEXT,
  resolved_at TEXT,
  note TEXT,
  -- beyond the brief: plain-language summary, 911/988, and the acknowledgement deadline
  summary TEXT NOT NULL DEFAULT '',
  escalation TEXT,
  ack_due_at TEXT
);

CREATE TABLE IF NOT EXISTS time_entry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patient(id),
  user TEXT NOT NULL,
  activity TEXT NOT NULL CHECK (activity IN ('consent_call', 'nurse_call', 'call_review', 'ehr_chart_review', 'ehr_med_review',
    'ehr_care_plan_review', 'coordination', 'education', 'documentation', 'practitioner_review')),
  outcome TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT NOT NULL,
  seconds INTEGER NOT NULL,
  counts INTEGER NOT NULL,
  call_id INTEGER
);

CREATE TABLE IF NOT EXISTS month_close (
  patient_id INTEGER NOT NULL REFERENCES patient(id),
  month TEXT NOT NULL,
  note_text TEXT,
  filed_at TEXT,
  attested_at TEXT,
  billing_status TEXT NOT NULL CHECK (billing_status IN ('ready', 'held')),
  held_reason TEXT,
  code TEXT,
  amount REAL,
  PRIMARY KEY (patient_id, month)
);

CREATE TABLE IF NOT EXISTS event (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  actor TEXT NOT NULL,
  patient_id INTEGER,
  type TEXT NOT NULL,
  detail TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS demo (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS event_patient ON event (patient_id, id);
CREATE INDEX IF NOT EXISTS event_type ON event (type);
CREATE INDEX IF NOT EXISTS call_patient ON call (patient_id);
CREATE INDEX IF NOT EXISTS call_sched ON call (kind, status, scheduled_for);
CREATE INDEX IF NOT EXISTS task_patient ON task (patient_id);
CREATE INDEX IF NOT EXISTS flag_patient ON flag (patient_id);
CREATE INDEX IF NOT EXISTS time_patient ON time_entry (patient_id);
CREATE INDEX IF NOT EXISTS consent_patient ON consent (patient_id);
CREATE INDEX IF NOT EXISTS patient_practice ON patient (practice_id);
`;

/** Tables in the order they can be cleared and refilled. */
export const TABLES = [
  'event',
  'month_close',
  'time_entry',
  'flag',
  'task',
  'call',
  'call_setup',
  'consent',
  'patient',
  'practice',
  'demo',
] as const;

export function openDb(file: string): DB {
  const db = new Database(file);
  if (file !== ':memory:') db.pragma('journal_mode = WAL');
  if (Number(db.pragma('user_version', { simple: true })) !== SCHEMA_VERSION) {
    // An older prototype database: drop it and let the service reseed.
    for (const t of TABLES) db.exec(`DROP TABLE IF EXISTS ${t}`);
    db.pragma(`user_version = ${SCHEMA_VERSION}`);
  }
  db.exec(SCHEMA);
  return db;
}
