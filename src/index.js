import { RubikaClient } from "./rubika/client.js";
import { buildEvent } from "./core/session.js";
import { isValidUpdate, isWebhookPathValid, isOwner } from "./core/security.js";
import { handleMessage } from "./handlers/message.js";
import { handleCallback } from "./handlers/callback.js";
import { logError, getSetting, setSetting } from "./core/db.js";
import { MAX_UPDATE_AGE_SEC } from "./config.js";

const MONITOR_FLAG_KEY = "api_recovery_monitor_done";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/") return json({ status: "ok", service: "rubika-bot", time: new Date().toISOString() });
    if (request.method === "GET" && url.pathname === "/setup") return handleSetup(request, env);
    if (request.method === "GET" && url.pathname === "/debug-api") return handleDebugApi(request, env);
    if (request.method === "POST" && (url.pathname === "/webhook" || url.pathname.startsWith("/webhook/"))) return handleWebhook(request, env, ctx, url);
    return json({ status: "not_found" }, 404);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runRecoveryCheck(env));
  },
};

// Keep retrying on scheduled runs until all three webhook types are accepted.
// An earlier version marked the task as complete before registering endpoints.
async function runRecoveryCheck(env) {
  const db = env.DB;
  if (!env.BOT_TOKEN || !db) return;

  const alreadyDone = await getSetting(db, MONITOR_FLAG_KEY, "0");
  if (alreadyDone === "1") return;

  const client = new RubikaClient(env.BOT_TOKEN);
  try {
    await client.getMe();
  } catch (err) {
    await logError(db, "scheduled.apiHealth", err?.message || String(err));
    return;
  }

  // Recover gracefully if the old misspelled value remains in the deployed binding.
  const publicHost = env.PUBLIC_HOST === "userbotrubrika.hosseinasgari898989.workers.dev"
    ? "userbotrubika.hosseinasgari898989.workers.dev"
    : env.PUBLIC_HOST;

  if (!env.WEBHOOK_SECRET || !publicHost) {
    await logError(db, "scheduled.autoSetup", "WEBHOOK_SECRET or PUBLIC_HOST is not configured");
    return;
  }

  const webhookUrl = "https://" + publicHost + "/webhook/" + env.WEBHOOK_SECRET;
  let webhookOk = true;
  for (const type of ["ReceiveUpdate", "ReceiveInlineMessage", "ReceiveQuery"]) {
    try {
      await client.updateBotEndpoint(webhookUrl, type);
    } catch (err) {
      webhookOk = false;
      await logError(db, "scheduled.autoSetup", err?.message || String(err));
    }
  }

  if (!webhookOk) return;

  // Only remember success after every endpoint registration succeeded.
  await setSetting(db, MONITOR_FLAG_KEY, "1");
  if (env.OWNER_ID) {
    try {
      await client.sendMessage(
        env.OWNER_ID,
        "✅ اتصال API روبیکا برقرار شد و هر سه Webhook با موفقیت ثبت شدند. حالا /start را امتحان کن."
      );
    } catch (err) {
      await logError(db, "scheduled.notifyOwner", err?.message || String(err));
    }
  }
}

async function handleWebhook(request, env, ctx, url) {
  if (!env.BOT_TOKEN) return json({ status: "error", message: "BOT_TOKEN secret not configured" }, 500);
  const trustedWebhookPath = isWebhookPathValid(env, url);
  const legacyWebhookPath = url.pathname === "/webhook" || url.pathname === "/webhook/inline" || url.pathname === "/webhook/query";
  if (!trustedWebhookPath && !legacyWebhookPath) return json({ status: "error", message: "invalid webhook path" }, 403);
  let update;
  try { update = await request.json(); } catch { return json({ status: "error", message: "invalid JSON" }, 400); }
  if (!isValidUpdate(update)) return json({ status: "ignored" });
  const msgTime = Number(update.new_message?.time || update.inline_message?.time || 0);
  if (msgTime && Date.now() / 1000 - msgTime > MAX_UPDATE_AGE_SEC) return json({ status: "ignored_stale" });
  const client = new RubikaClient(env.BOT_TOKEN);
  const db = env.DB;
  const event = buildEvent(update, client, db, env);
  if (!event) return json({ status: "ignored" });
  // Legacy Rubika endpoints have been observed calling /webhook and /webhook/inline.
  // Accept these paths for compatibility, but never grant owner privileges without the secret path.
  if (!trustedWebhookPath) event.isOwnerFlag = false;
  const work = (async () => {
    try {
      if (event.kind === "message") await handleMessage(event);
      else if (event.kind === "callback") await handleCallback(event);
    } catch (err) {
      try { await logError(db, "webhook.dispatch", err?.stack || err?.message || String(err)); } catch {}
    }
  })();
  if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(work); else await work;
  return json({ status: "ok" });
}

async function handleSetup(request, env) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!env.WEBHOOK_SECRET || key !== env.WEBHOOK_SECRET) return json({ status: "error", message: "unauthorized: pass ?key=<WEBHOOK_SECRET>" }, 401);
  if (!env.BOT_TOKEN) return json({ status: "error", message: "BOT_TOKEN not configured" }, 500);
  const webhookUrl = url.origin + "/webhook/" + env.WEBHOOK_SECRET;
  const client = new RubikaClient(env.BOT_TOKEN);
  const results = {};
  for (const type of ["ReceiveUpdate", "ReceiveInlineMessage", "ReceiveQuery"]) {
    try { results[type] = await client.updateBotEndpoint(webhookUrl, type); }
    catch (err) { results[type] = { error: err.message }; }
  }
  return json({ status: "ok", webhook_url: webhookUrl, results });
}

async function handleDebugApi(request, env) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!env.WEBHOOK_SECRET || key !== env.WEBHOOK_SECRET) return json({ status: "error", message: "unauthorized: pass ?key=<WEBHOOK_SECRET>" }, 401);
  if (!env.BOT_TOKEN) return json({ status: "error", message: "BOT_TOKEN not configured" }, 500);
  const client = new RubikaClient(env.BOT_TOKEN);
  const started = Date.now();
  try {
    await client.getMe();
    return json({ status: "ok", message: "Rubika API reachable and token accepted", latency_ms: Date.now() - started });
  } catch (err) {
    return json({ status: "error", message: "Rubika API call failed", api_method: err.method || "getMe", http_status: err.status ?? null, content_type: err.contentType || "unknown", detail: err.detail || err.message, latency_ms: Date.now() - started }, 502);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
}
