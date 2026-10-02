-- Rubika Pro Bot — D1 Schema (migration 0001)

CREATE TABLE IF NOT EXISTS users (
    chat_id     TEXT PRIMARY KEY,
    first_name  TEXT,
    last_name   TEXT,
    username    TEXT,
    lang        TEXT NOT NULL DEFAULT 'fa',
    first_seen  INTEGER NOT NULL,
    last_seen   INTEGER NOT NULL,
    start_count INTEGER NOT NULL DEFAULT 0,
    is_banned   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users (last_seen);

CREATE TABLE IF NOT EXISTS groups (
    chat_id       TEXT PRIMARY KEY,
    title         TEXT,
    username      TEXT,
    first_seen    INTEGER NOT NULL,
    last_seen     INTEGER NOT NULL,
    interactions  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_groups_last_seen ON groups (last_seen);

CREATE TABLE IF NOT EXISTS ui_state (
    chat_id     TEXT PRIMARY KEY,
    message_id  TEXT,
    menu        TEXT NOT NULL DEFAULT 'main',
    page        INTEGER NOT NULL DEFAULT 0,
    ctx_json    TEXT NOT NULL DEFAULT '{}',
    history     TEXT NOT NULL DEFAULT '[]',
    updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS again_cooldown (
    chat_id     TEXT PRIMARY KEY,
    last_used   INTEGER NOT NULL,
    use_count   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS callback_locks (
    chat_id     TEXT PRIMARY KEY,
    last_button TEXT,
    last_ts     INTEGER NOT NULL,
    processing  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stats_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    event       TEXT NOT NULL,
    chat_id     TEXT,
    ts          INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_stats_event_ts ON stats_log (event, ts);

CREATE TABLE IF NOT EXISTS error_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    scope       TEXT NOT NULL,
    message     TEXT NOT NULL,
    ts          INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_error_ts ON error_log (ts);

INSERT OR IGNORE INTO settings (key, value) VALUES ('feature_group_stats', '1');
INSERT OR IGNORE INTO settings (key, value) VALUES ('feature_tools_menu', '1');
INSERT OR IGNORE INTO settings (key, value) VALUES ('maintenance_mode', '0');
