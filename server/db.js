import { DatabaseSync } from 'node:sqlite'
import { openCloudDatabase } from './cloud-db.js'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { QUESTION_DURATION_SECONDS } from '../shared/timer.js'

export const id = () => randomUUID()
export const now = () => new Date().toISOString()

export function openDatabase(path, cloud = null) {
  if (!cloud && path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true })
  const db = cloud ? openCloudDatabase(cloud) : new DatabaseSync(path)
  // Hosted instances share a migrated database; avoid repeating network schema checks.
  const schemaVersion = 20261021
  if (cloud) {
    try { if (db.prepare("SELECT value FROM settings WHERE key = 'schema_version'").get()?.value === String(schemaVersion)) return db }
    catch (error) { if (!/no such table/i.test(error.message)) throw error }
  }
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, subject TEXT NOT NULL,
      brief TEXT NOT NULL, concepts TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY, assignment_id TEXT NOT NULL REFERENCES assignments(id),
      concept TEXT NOT NULL, text TEXT NOT NULL, approved INTEGER NOT NULL DEFAULT 0,
      source TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY, assignment_id TEXT NOT NULL REFERENCES assignments(id),
      student TEXT NOT NULL, filename TEXT NOT NULL, text TEXT NOT NULL,
      analysis TEXT NOT NULL, mode TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY, submission_id TEXT NOT NULL REFERENCES submissions(id),
      status TEXT NOT NULL, bank TEXT NOT NULL, current TEXT NOT NULL,
      question_started_at TEXT, response_ended_at TEXT,
      duration INTEGER NOT NULL DEFAULT ${QUESTION_DURATION_SECONDS}, created_at TEXT NOT NULL, completed_at TEXT,
      language TEXT NOT NULL DEFAULT 'en', defence_skipped INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS answers (
      id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id),
      question_id TEXT NOT NULL, position INTEGER NOT NULL, question TEXT NOT NULL,
      concept TEXT NOT NULL, source TEXT NOT NULL, transcript TEXT NOT NULL,
      method TEXT NOT NULL, status TEXT NOT NULL, explanation TEXT NOT NULL,
      question_started_at TEXT NOT NULL, response_ended_at TEXT NOT NULL,
      response_seconds REAL NOT NULL, timer_expired INTEGER NOT NULL,
      UNIQUE(session_id, question_id)
    );
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY, session_id TEXT NOT NULL UNIQUE REFERENCES sessions(id),
      summary TEXT NOT NULL, strengths TEXT NOT NULL, review_areas TEXT NOT NULL,
      mode TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS transfer_assessments (
      session_id TEXT NOT NULL REFERENCES sessions(id), pair_id TEXT NOT NULL,
      result TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(session_id, pair_id)
    );
    CREATE TABLE IF NOT EXISTS activity_events (
      id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id),
      type TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS activity_session ON activity_events(session_id);
    CREATE INDEX IF NOT EXISTS questions_assignment ON questions(assignment_id);
    CREATE INDEX IF NOT EXISTS answers_session ON answers(session_id);
  `)
  const columns = db.prepare('PRAGMA table_info(sessions)').all().map(column => column.name)
  if (!columns.includes('language')) db.exec("ALTER TABLE sessions ADD COLUMN language TEXT NOT NULL DEFAULT 'en'")
  if (!columns.includes('defence_skipped')) db.exec('ALTER TABLE sessions ADD COLUMN defence_skipped INTEGER NOT NULL DEFAULT 0')
  const tableColumns = new Map([['sessions', new Set(columns)]])
  const migrate = (table, name, definition) => {
    if (!tableColumns.has(table)) tableColumns.set(table, new Set(db.prepare('PRAGMA table_info(' + table + ')').all().map(c => c.name)))
    const known = tableColumns.get(table)
    if (!known.has(name)) { db.exec('ALTER TABLE ' + table + ' ADD COLUMN ' + name + ' ' + definition); known.add(name) }
  }
  migrate('assignments', 'deleted_at', 'TEXT')
  migrate('assignments', 'challenge_mode', "TEXT NOT NULL DEFAULT 'standard'")
  migrate('assignments', 'concept_count', 'INTEGER NOT NULL DEFAULT 2')
  migrate('assignments', 'challenge_concepts', "TEXT NOT NULL DEFAULT '[]'")
  migrate('assignments', 'question_limit', 'INTEGER NOT NULL DEFAULT 6')
  migrate('sessions', 'question_limit', 'INTEGER NOT NULL DEFAULT 6')
  migrate('assignments', 'instructions_text', "TEXT NOT NULL DEFAULT ''")
  migrate('assignments', 'instructions_filename', "TEXT NOT NULL DEFAULT ''")
  migrate('assignments', 'rubric', "TEXT NOT NULL DEFAULT '[]'")
  migrate('assignments', 'reference_answer', "TEXT NOT NULL DEFAULT ''")
  migrate('reports', 'grading_result', "TEXT NOT NULL DEFAULT 'null'")
  migrate('reports', 'grade_review', "TEXT NOT NULL DEFAULT 'null'")
  migrate('sessions', 'meeting', "TEXT NOT NULL DEFAULT '{}'")
  migrate('activity_events', 'details', "TEXT NOT NULL DEFAULT '{}'")
  migrate('assignments', 'response_seconds', 'INTEGER NOT NULL DEFAULT 45')
  migrate('assignments', 'timing_mode', "TEXT NOT NULL DEFAULT 'adaptive'")
  migrate('sessions', 'timing_mode', "TEXT NOT NULL DEFAULT 'fixed'")
  if (!db.prepare('PRAGMA table_info(sessions)').all().some(c => c.name === 'base_duration')) {
    db.exec('ALTER TABLE sessions ADD COLUMN base_duration INTEGER NOT NULL DEFAULT 45')
    db.exec('UPDATE sessions SET base_duration = duration')
  }
  migrate('assignments', 'status', "TEXT NOT NULL DEFAULT 'open'")
  migrate('sessions', 'challenge_mode', "TEXT NOT NULL DEFAULT 'standard'")
  migrate('reports', 'transfer_summary', "TEXT NOT NULL DEFAULT 'null'")
  migrate('sessions', 'parent_session_id', 'TEXT REFERENCES sessions(id)')
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS sessions_follow_up ON sessions(parent_session_id) WHERE parent_session_id IS NOT NULL')
  migrate('submissions', 'archived', 'INTEGER NOT NULL DEFAULT 0')
  migrate('submissions', 'showcase_kind', "TEXT NOT NULL DEFAULT ''")
  migrate('answers', 'evidence_quote', "TEXT NOT NULL DEFAULT ''")
  migrate('answers', 'rubric', "TEXT NOT NULL DEFAULT '{}'")
  migrate('reports', 'concept_evidence', "TEXT NOT NULL DEFAULT '[]'")
  migrate('reports', 'review_status', "TEXT NOT NULL DEFAULT 'pending'")
  migrate('reports', 'teacher_notes', "TEXT NOT NULL DEFAULT ''")
  migrate('reports', 'feedback', "TEXT NOT NULL DEFAULT ''")
  migrate('reports', 'reviewed_at', 'TEXT')
  migrate('reports', 'released_at', 'TEXT')
  migrate('reports', 'evidence_hash', "TEXT NOT NULL DEFAULT ''")
  migrate('reports', 'receipt_created_at', 'TEXT')
  if (cloud) db.prepare("INSERT INTO settings (key,value) VALUES ('schema_version',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(String(schemaVersion))
  return db
}

export function transaction(db, fn) {
  db.exec('BEGIN IMMEDIATE')
  try { const value = fn(); db.exec('COMMIT'); return value }
  catch (error) { db.exec('ROLLBACK'); throw error }
}

export function seed(db) {
  if (db.prepare('SELECT COUNT(*) AS count FROM assignments').get().count) return
  const assignmentId = 'sample-python'
  db.prepare('INSERT INTO assignments (id, title, subject, brief, concepts, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    assignmentId, 'Python: a smarter reading list', 'Computer science',
    'Build a reading-list application in Python. Explain your choice of data structures, search approach, and how you tested the program.',
    JSON.stringify(['Dictionaries', 'Search complexity', 'Testing']), now(),
  )
  for (const [concept, text] of [
    ['Dictionaries', 'Why did you store your books in a dictionary instead of a list?'],
    ['Search complexity', 'How does looking up a book by its ISBN work in your program?'],
    ['Testing', 'How did you check that your program handles a book that is not in the reading list?'],
  ]) db.prepare('INSERT INTO questions VALUES (?, ?, ?, ?, ?, ?, ?)').run(id(), assignmentId, concept, text, 1, 'teacher', now())
}
