const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'anime-sync.db');

// sql.js wrapper providing better-sqlite3-compatible API
let db = null;
let sql = null;

function saveDb() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function getDb() {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  return db;
}

// Prepare wrapper that mimics better-sqlite3's .get(), .all(), .run()
function createPrepareWrapper(sqlStr) {
  return {
    get: (...params) => {
      const s = getDb();
      try {
        s.prepare(sqlStr);
        const stmt = s.prepare(sqlStr);
        stmt.bind(params);
        if (stmt.step()) {
          const result = stmt.getAsObject();
          stmt.free();
          return result;
        }
        stmt.free();
        return undefined;
      } catch (e) {
        // For simple queries, fallback to exec
        const res = s.exec(sqlStr);
        if (res.length > 0) {
          const cols = res[0].columns;
          const vals = res[0].values;
          if (vals.length > 0) {
            const row = {};
            cols.forEach((c, i) => { row[c] = vals[0][i]; });
            return row;
          }
        }
        return undefined;
      }
    },
    all: (...params) => {
      const s = getDb();
      try {
        const stmt = s.prepare(sqlStr);
        stmt.bind(params);
        const results = [];
        while (stmt.step()) {
          results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
      } catch (e) {
        // Fallback: try exec
        try {
          const res = s.exec(sqlStr);
          if (res.length > 0) {
            const cols = res[0].columns;
            return res[0].values.map(vals => {
              const row = {};
              cols.forEach((c, i) => { row[c] = vals[i]; });
              return row;
            });
          }
        } catch (e2) {}
        return [];
      }
    },
    run: (...params) => {
      const s = getDb();
      try {
        s.run(sqlStr, params);
        saveDb();
        // Get number of changes
        const changes = s.getRowsModified();
        return { changes };
      } catch (e) {
        // Fallback: exec
        s.exec(sqlStr);
        saveDb();
        return { changes: 0 };
      }
    },
  };
}

// Initialize database
async function initDb() {
  if (db) return db;

  sql = await initSqlJs();

  // Load existing DB or create new one
  try {
    const buf = fs.readFileSync(DB_PATH);
    db = new sql.Database(buf);
  } catch {
    db = new sql.Database();
  }

  // Enable WAL mode and foreign keys
  db.run('PRAGMA journal_mode=WAL');
  db.run('PRAGMA foreign_keys=ON');

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user' CHECK(role IN ('user','admin')),
      avatar TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      banned INTEGER DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      owner_id TEXT NOT NULL,
      anime_id TEXT DEFAULT '',
      anime_title TEXT DEFAULT '',
      episode_id TEXT DEFAULT '',
      episode_number INTEGER DEFAULT 1,
      video_url TEXT DEFAULT '',
      is_public INTEGER DEFAULT 1,
      max_users INTEGER DEFAULT 20,
      current_time REAL DEFAULT 0,
      paused INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS room_members (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS bans (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      banned_by TEXT NOT NULL,
      reason TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS user_videos (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      video_url TEXT NOT NULL,
      thumbnail_url TEXT DEFAULT '',
      file_path TEXT DEFAULT '',
      file_size INTEGER DEFAULT 0,
      is_public INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS invite_codes (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      created_by TEXT NOT NULL,
      used_by TEXT,
      used INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (used_by) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT DEFAULT ''
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS room_bans (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      banned_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS room_mutes (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      muted_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Migrate: add permission columns to rooms if missing
  try { db.run('ALTER TABLE rooms ADD COLUMN allow_pause_all INTEGER DEFAULT 1'); } catch (e) {}
  try { db.run('ALTER TABLE rooms ADD COLUMN allow_rate_all INTEGER DEFAULT 1'); } catch (e) {}
  try { db.run('ALTER TABLE rooms ADD COLUMN playback_rate REAL DEFAULT 1'); } catch (e) {}
  try { db.run('ALTER TABLE rooms ADD COLUMN category_id TEXT DEFAULT \'\''); } catch (e) {}
  try { db.run('ALTER TABLE users ADD COLUMN email TEXT DEFAULT \'\''); } catch (e) {}

  // Default settings
  const defaults = {
    site_name: '轩昂の小破站',
    site_icon: '',
    site_background: '',
    blur_amount: '10',
    home_title: '一起同步看番',
    home_subtitle: '创建房间，邀请朋友，同步观看动漫',
    allow_video_upload: '1',
    require_invite_code: '1',
    require_email_verify: '0',
    smtp_host: '',
    smtp_port: '465',
    smtp_user: '',
    smtp_pass: '',
    smtp_secure: '1',
    smtp_from: '',
    smtp_proxy: '',
  };
  for (const [k, v] of Object.entries(defaults)) {
    try {
      const stmt = db.prepare('SELECT 1 FROM settings WHERE key = ?');
      stmt.bind([k]);
      const exists = stmt.step();
      stmt.free();
      if (!exists) {
        db.run('INSERT INTO settings (key, value) VALUES (?, ?)', [k, v]);
      }
    } catch (e) {
      db.run('INSERT INTO settings (key, value) VALUES (?, ?)', [k, v]);
    }
  }

  // 迁移：旧的 blur_amount=0（组件模糊功能上线前的默认值）改为 10
  try {
    const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
    stmt.bind(['blur_amount']);
    if (stmt.step()) {
      const val = stmt.getAsObject().value;
      if (val === '0') {
        db.run("UPDATE settings SET value = '10' WHERE key = 'blur_amount'");
      }
    }
    stmt.free();
  } catch (e) {}

  saveDb();

  // Create wrapper with prepare method
  const wrapper = {
    prepare: createPrepareWrapper,
    exec: (s) => getDb().exec(s),
    _db: db,
  };

  return wrapper;
}

module.exports = { initDb, getDb: () => {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  return { prepare: createPrepareWrapper, exec: (s) => getDb().exec(s), _db: db };
}};