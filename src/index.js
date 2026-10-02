import { RubikaClient } from "./rubika/client.js";
import { buildEvent } from "./core/session.js";
import { isValidUpdate, isWebhookPathValid } from "./core/security.js";
import { handleMessage } from "./handlers/message.js";
import { handleCallback } from "./handlers/callback.js";
import { logError } from "./core/db.js";
import { MAX_UPDATE_AGE_SEC } from "./config.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return json({ status: "ok", service: "rubika-bot", time: new Date().toISOString() });
    }

    if (request.method === "GET" && url.pathname === "/setup") {
      return handleSetup(request, env);
    }

    if (request.method === "POST" && url.pathname.startsWith("/webhook/")) {
      return handleWebhook(request, env, ctx, url);
    }

    return json({ status: "not_found" }, 404);
  },
};

async function handleWebhook(request, env, ctx, url) {
  if (!env.BOT_TOKEN) return json({ status: "error", message: "BOT_TOKEN secret not configured" }, 500);
  if (!isWebhookPathValid(env, url)) return json({ status: "error", message: "invalid webhook path" }, 403);

  let update;
  try {
    update = await request.json();
  } catch {
    return json({ status: "error", message: "invalid JSON" }, 400);
  }

  if (!isValidUpdate(update)) return json({ status: "ignored" });

  const msgTime = Number(update.new_message?.time || update.inline_message?.time || 0);
  if (msgTime && Date.now() / 1000 - msgTime > MAX_UPDATE_AGE_SEC) {
    return json({ status: "ignored_stale" });
  }

  const client = new RubikaClient(env.BOT_TOKEN);
  const db = env.DB;
  const event = buildEvent(update, client, db, env);
  if (!event) return json({ status: "ignored" });

  const work = (async () => {
    try {
      if (event.kind === "message") await handleMessage(event);
      else if (event.kind === "callback") await handleCallback(event);
    } catch (err) {
      try {
        await logError(db, "webhook.dispatch", err?.stack || err?.message || String(err));
      } catch {}
    }
  })();

  if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(work);
  else await work;

  return json({ status: "ok" });
}

async function handleSetup(request, env) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!env.WEBHOOK_SECRET || key !== env.WEBHOOK_SECRET) {
    return json({ status: "error", message: "unauthorized: pass ?key=<WEBHOOK_SECRET>" }, 401);
  }
  if (!env.BOT_TOKEN) return json({ status: "error", message: "BOT_TOKEN not configured" }, 500);

  const webhookUrl = `${url.origin}/webhook/${env.WEBHOOK_SECRET}`;
  const client = new RubikaClient(env.BOT_TOKEN);
  const results = {};
  for (const type of ["ReceiveUpdate", "ReceiveInlineMessage", "ReceiveQuery"]) {
    try { results[type] = await client.updateBotEndpoint(webhookUrl, type); }
    catch (err) { results[type] = { error: err.message }; }
  }
  return json({ status: "ok", webhook_url: webhookUrl, results });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
