import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
fs.mkdirSync(path.join(root, 'data'), { recursive: true });
const db = new Database(path.join(root, 'data', 'memong.db'));
db.pragma('foreign_keys = ON');
db.exec(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, must_change_password INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS cases (id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL CHECK(category IN ('criminal','drugs')), subcategory TEXT NOT NULL CHECK(subcategory IN ('arrest','release')), case_date TEXT, created_by INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(created_by) REFERENCES users(id));
CREATE TABLE IF NOT EXISTS images (id INTEGER PRIMARY KEY, case_id INTEGER NOT NULL, filename TEXT NOT NULL, original_name TEXT NOT NULL, mime_type TEXT NOT NULL, size INTEGER NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(case_id) REFERENCES cases(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, action TEXT NOT NULL, case_id INTEGER, details TEXT, created_at TEXT NOT NULL, FOREIGN KEY(user_id) REFERENCES users(id));
CREATE INDEX IF NOT EXISTS idx_cases_name ON cases(name); CREATE INDEX IF NOT EXISTS idx_images_case ON images(case_id);`);
try { db.exec('ALTER TABLE cases ADD COLUMN case_date TEXT'); } catch (error) { if (!String(error.message).includes('duplicate column')) throw error; }
db.exec("UPDATE cases SET case_date = created_at WHERE case_date IS NULL");
export const now = () => new Date().toISOString();
export default db;
