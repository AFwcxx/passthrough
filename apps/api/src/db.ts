import { DatabaseSync } from "node:sqlite";
import { dirname } from "node:path";
import { mkdirSync } from "node:fs";
import type { Settings } from "@passthrough/shared";
export function openDb(path: string) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`CREATE TABLE IF NOT EXISTS history(id INTEGER PRIMARY KEY,transfer_id TEXT,timestamp TEXT,label TEXT,saved_filename TEXT,mime_type TEXT,byte_size INTEGER,action TEXT,save_result TEXT,clipboard_result TEXT,error_message TEXT);
  CREATE TABLE IF NOT EXISTS library_files(id INTEGER PRIMARY KEY,uploaded_at TEXT NOT NULL,filename TEXT NOT NULL,mime_type TEXT NOT NULL,byte_size INTEGER NOT NULL,content BLOB NOT NULL);
  CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
  INSERT OR IGNORE INTO settings VALUES('defaultAction','save'); INSERT OR IGNORE INTO settings VALUES('historyPageSize','20');`);
  return db;
}
export function getSettings(db: DatabaseSync): Settings {
  const rows = db.prepare("SELECT key,value FROM settings").all() as {
    key: string;
    value: string;
  }[];
  const values = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    defaultAction: values.defaultAction as Settings["defaultAction"],
    historyPageSize: Number(values.historyPageSize),
  };
}
