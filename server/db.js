import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

export const id = () => randomUUID()
export const now = () => new Date().toISOString()

export function openDatabase(path) {
  if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true })
  const db = new DatabaseSync(path)
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
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
      duration INTEGER NOT NULL DEFAULT 60, created_at TEXT NOT NULL, completed_at TEXT
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
    CREATE INDEX IF NOT EXISTS questions_assignment ON questions(assignment_id);
    CREATE INDEX IF NOT EXISTS answers_session ON answers(session_id);
  `)
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
  db.prepare('INSERT INTO assignments VALUES (?, ?, ?, ?, ?, ?)').run(
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
