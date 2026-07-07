const path = require('path');
const Database = require('better-sqlite3');

const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'data.sqlite3');

const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS trips (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    destination TEXT NOT NULL,
    startDate TEXT NOT NULL,
    endDate TEXT NOT NULL,
    travelers INTEGER NOT NULL,
    currency TEXT NOT NULL,
    budgetTotal REAL NOT NULL,
    updatedAt INTEGER NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0
  );
`);

module.exports = db;
