export function now() { return Date.now(); }

export async function upsertUser(db, chat) {
  const t = now();
  await db.prepare(`INSERT INTO users (chat_id, first_name, last_name, username, first_seen, last_seen, start_count)
    VALUES (?, ?, ?, ?, ?, ?, 0)
    ON CONFLICT(chat_id) DO UPDATE SET
      first_name = excluded.first_name, last_name = excluded.last_name,
      username = excluded.username, last_seen = excluded.last_seen`)
    .bind(chat.chat_id, chat.first_name || null, chat.last_name || null, chat.username || null, t, t).run();
}
export async function getUser(db, chat_id) { return db.prepare(`SELECT * FROM users WHERE chat_id = ?`).bind(chat_id).first(); }
export async function incrementStartCount(db, chat_id) { await db.prepare(`UPDATE users SET start_count = start_count + 1, last_seen = ? WHERE chat_id = ?`).bind(now(), chat_id).run(); }
export async function setUserLang(db, chat_id, lang) { await db.prepare(`UPDATE users SET lang = ? WHERE chat_id = ?`).bind(lang, chat_id).run(); }
export async function countUsers(db) { const row = await db.prepare(`SELECT COUNT(*) AS c FROM users`).first(); return row?.c || 0; }

export async function upsertGroup(db, chat) {
  const t = now();
  await db.prepare(`INSERT INTO groups (chat_id, title, username, first_seen, last_seen, interactions)
    VALUES (?, ?, ?, ?, ?, 1)
    ON CONFLICT(chat_id) DO UPDATE SET
      title = excluded.title, username = excluded.username, last_seen = excluded.last_seen,
      interactions = interactions + 1`)
    .bind(chat.chat_id, chat.title || null, chat.username || null, t, t).run();
}
export async function countGroups(db) { const row = await db.prepare(`SELECT COUNT(*) AS c FROM groups`).first(); return row?.c || 0; }

export async function getUiState(db, chat_id) {
  const row = await db.prepare(`SELECT * FROM ui_state WHERE chat_id = ?`).bind(chat_id).first();
  if (!row) return null;
  return { ...row, ctx: safeParse(row.ctx_json, {}), history: safeParse(row.history, []) };
}
export async function saveUiState(db, chat_id, { message_id, menu, page = 0, ctx = {}, history = [] }) {
  await db.prepare(`INSERT INTO ui_state (chat_id, message_id, menu, page, ctx_json, history, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(chat_id) DO UPDATE SET
      message_id = excluded.message_id, menu = excluded.menu, page = excluded.page,
      ctx_json = excluded.ctx_json, history = excluded.history, updated_at = excluded.updated_at`)
    .bind(chat_id, message_id ?? null, menu, page, JSON.stringify(ctx), JSON.stringify(history), now()).run();
}
function safeParse(str, fallback) { try { return JSON.parse(str ?? ""); } catch { return fallback; } }

export async function getAgainCooldown(db, chat_id) { return db.prepare(`SELECT * FROM again_cooldown WHERE chat_id = ?`).bind(chat_id).first(); }
export async function touchAgainCooldown(db, chat_id) {
  const t = now();
  await db.prepare(`INSERT INTO again_cooldown (chat_id, last_used, use_count) VALUES (?, ?, 1)
    ON CONFLICT(chat_id) DO UPDATE SET last_used = excluded.last_used, use_count = use_count + 1`).bind(chat_id, t).run();
}

export async function checkAndLockCallback(db, chat_id, buttonId, debounceMs) {
  const t = now();
  const row = await db.prepare(`SELECT * FROM callback_locks WHERE chat_id = ?`).bind(chat_id).first();
  if (row && row.processing === 1 && t - row.last_ts < 8000) return { allowed: false, reason: "busy" };
  if (row && t - row.last_ts < debounceMs && row.last_button === buttonId) return { allowed: false, reason: "duplicate" };
  await db.prepare(`INSERT INTO callback_locks (chat_id, last_button, last_ts, processing) VALUES (?, ?, ?, 1)
    ON CONFLICT(chat_id) DO UPDATE SET last_button = excluded.last_button, last_ts = excluded.last_ts, processing = 1`).bind(chat_id, buttonId, t).run();
  return { allowed: true };
}
export async function unlockCallback(db, chat_id) { await db.prepare(`UPDATE callback_locks SET processing = 0 WHERE chat_id = ?`).bind(chat_id).run(); }

export async function getSetting(db, key, fallback = null) { const row = await db.prepare(`SELECT value FROM settings WHERE key = ?`).bind(key).first(); return row ? row.value : fallback; }
export async function setSetting(db, key, value) { await db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).bind(key, String(value)).run(); }
export async function allSettings(db) { const { results } = await db.prepare(`SELECT key, value FROM settings`).all(); return results || []; }

export async function logEvent(db, event, chat_id = null) { await db.prepare(`INSERT INTO stats_log (event, chat_id, ts) VALUES (?, ?, ?)`).bind(event, chat_id, now()).run(); }
export async function countEvent(db, event, sinceMs = null) {
  if (sinceMs) {
    const row = await db.prepare(`SELECT COUNT(*) AS c FROM stats_log WHERE event = ? AND ts >= ?`).bind(event, now() - sinceMs).first();
    return row?.c || 0;
  }
  const row = await db.prepare(`SELECT COUNT(*) AS c FROM stats_log WHERE event = ?`).bind(event).first();
  return row?.c || 0;
}
export async function logError(db, scope, message) {
  try {
    await db.prepare(`INSERT INTO error_log (scope, message, ts) VALUES (?, ?, ?)`).bind(scope, String(message).slice(0, 500), now()).run();
    await db.prepare(`DELETE FROM error_log WHERE id NOT IN (SELECT id FROM error_log ORDER BY ts DESC LIMIT 200)`).run();
  } catch {}
}
export async function recentErrors(db, limit = 10) { const { results } = await db.prepare(`SELECT * FROM error_log ORDER BY ts DESC LIMIT ?`).bind(limit).all(); return results || []; }
