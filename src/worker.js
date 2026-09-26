export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // دریافت پیام‌های روبیکا (Webhook)
    if (url.pathname === '/webhook' && request.method === 'POST') {
      try {
        const payload = await request.json();
        const update = payload?.update || payload;
        await handleUpdate(update, env, request);
        return new Response('OK', { status: 200 });
      } catch (e) {
        console.error('Webhook error:', e);
        return new Response('Internal Error', { status: 500 });
      }
    }

    // ثبت/بررسی Webhook
    if (url.pathname === '/setup') {
      const result = await registerWebhook(env);
      return new Response(JSON.stringify(result), {
        status: result.ok ? 200 : 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

    // بررسی سلامت (Health Check)
    if (url.pathname === '/health') {
      // ثبت خودکار Webhook با استفاده از Secret موجود در Cloudflare.
      ctx.waitUntil(registerWebhook(env));
      return new Response('OK', { status: 200 });
    }

    return new Response('Not Found', { status: 404 });
  },

  // Cron Trigger برای بیدار نگه داشتن Worker
  async scheduled(event, env, ctx) {
    // هر ۱۰ دقیقه Webhook را دوباره ثبت/تأیید می‌کنیم تا اتصال ربات پایدار بماند.
    ctx.waitUntil(registerWebhook(env));
  }
};

async function handleUpdate(update, env, request) {
  const db = env.DB;
  const BOT_TOKEN = env.RUBIKA_TOKEN;
  const API_BASE = `https://botapi.rubika.ir/v3/${BOT_TOKEN}`;

  const message =
    update.message ||
    update.new_message ||
    update.edited_message ||
    {};

  const chatId = update.chat_id || message.chat_id;
  const userId = message.sender_id || update.sender_id;
  const text = (message.text || '').trim();
  const command = text.toLowerCase();

  if (!chatId) return;

  // StartedBot را معادل اولین /start در نظر می‌گیریم.
  const isStart = command === '/start' || update.type === 'StartedBot';
  const isAgain = command === '/again';

  if (!isStart && !isAgain) return;

  try {
    await ensureRequestStateTable(db);

    const state = await getRequestState(db, chatId);

    // /start تکراری باید کاملاً بی‌پاسخ باشد؛ حتی API اطلاعات چت هم صدا زده نشود.
    if (isStart && state) return;

    // /again فقط برای چتی مجاز است که قبلاً /start شده باشد.
    if (isAgain) {
      if (!state) return;

      const now = Math.floor(Date.now() / 1000);
      const lastRequestAt = state.last_again_at || state.started_at || 0;
      const cooldownSeconds = 12 * 60 * 60;

      if (now - lastRequestAt < cooldownSeconds) {
        return;
      }
    }

    // فقط وقتی درخواست واقعاً مجاز است، نوع چت را تشخیص بده.
    let chatType =
      message.chat_type ||
      update.chat_type ||
      null;

    let chatInfo = {};
    if (!chatType) {
      chatInfo = await getChatInfo(chatId, BOT_TOKEN, API_BASE);
      chatType =
        chatInfo.type ||
        chatInfo.chat_type ||
        chatInfo.chat?.type ||
        chatInfo.chat?.chat_type ||
        null;
    }

    if (isStart) {
      if (chatType === 'Group') {
        await sendInitialGroupInfo(db, chatId, chatInfo, BOT_TOKEN, API_BASE);
      } else {
        await sendInitialUserInfo(db, chatId, userId, BOT_TOKEN, API_BASE);
      }

      await createRequestState(db, chatId);
      return;
    }

    const now = Math.floor(Date.now() / 1000);

    if (chatType === 'Group') {
      await sendAgainGroupInfo(db, chatId, chatInfo, BOT_TOKEN, API_BASE);
    } else {
      await sendAgainUserInfo(db, chatId, userId, BOT_TOKEN, API_BASE);
    }

    await markAgainRequest(db, chatId, now);
  } catch (e) {
    console.error('Update processing error:', e);

    // فقط در تلاش واقعی برای شروع اولیه، خطا را به کاربر اعلام می‌کنیم.
    // /startهای بعدی و /againهای زودهنگام عمداً بی‌پاسخ می‌مانند.
    if (isStart) {
      await sendMessage(
        chatId,
        '❌ دریافت اطلاعات انجام نشد. لطفاً چند لحظه بعد دوباره /start را بفرستید.',
        BOT_TOKEN,
        API_BASE
      );
    }
  }
}

// ==================== توابع کمکی ====================

async function ensureRequestStateTable(db) {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS bot_request_state (
      chat_id TEXT PRIMARY KEY,
      started_at INTEGER NOT NULL,
      last_again_at INTEGER
    )`
  ).run();
}

async function getRequestState(db, chatId) {
  const result = await db.prepare(
    `SELECT chat_id, started_at, last_again_at
     FROM bot_request_state
     WHERE chat_id = ?`
  ).bind(chatId).first();

  return result || null;
}

async function createRequestState(db, chatId) {
  const now = Math.floor(Date.now() / 1000);

  await db.prepare(
    `INSERT OR IGNORE INTO bot_request_state
     (chat_id, started_at, last_again_at)
     VALUES (?, ?, NULL)`
  ).bind(chatId, now).run();
}

async function markAgainRequest(db, chatId, now) {
  await db.prepare(
    `UPDATE bot_request_state
     SET last_again_at = ?
     WHERE chat_id = ?`
  ).bind(now, chatId).run();
}

async function sendInitialUserInfo(db, chatId, userId, token, apiBase) {
  if (!userId) {
    throw new Error('Private chat is missing sender_id.');
  }

  const chat = await getChatInfo(chatId, token, apiBase);

  const savedUserId = chat.user_id || userId;
  const firstName = chat.first_name || '';
  const lastName = chat.last_name || '';
  const usernameValue = chat.username || '';

  if (!savedUserId) {
    throw new Error('Rubika getChat returned no user_id.');
  }

  await db.prepare(
    `INSERT OR REPLACE INTO users
     (user_id, username, first_name, last_name, ip_address, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`
  ).bind(
    savedUserId,
    usernameValue,
    firstName,
    lastName,
    'unknown'
  ).run();

  const fullName =
    [firstName, lastName]
      .filter(Boolean)
      .join(' ') || 'نام ثبت نشده';

  const username = usernameValue
    ? `@${usernameValue.replace(/^@/, '')}`
    : 'ندارد';

  const message =
    `✅ اطلاعات شما:

👤 نام: ${fullName}
📛 نام کاربری: ${username}
🆔 شناسه کاربری: ${savedUserId}`;

  const sent = await sendMessage(chatId, message, token, apiBase);
  if (!sent) throw new Error('Failed to send private user information.');
}

async function sendAgainUserInfo(db, chatId, userId, token, apiBase) {
  await sendInitialUserInfo(db, chatId, userId, token, apiBase);
}

async function sendInitialGroupInfo(db, chatId, chatInfo, token, apiBase) {
  const freshGroupInfo = await getChatInfo(chatId, token, apiBase);

  const title =
    freshGroupInfo.title ||
    freshGroupInfo.name ||
    'نام گروه ثبت نشده';

  const memberCount =
    freshGroupInfo.member_count ??
    freshGroupInfo.members_count ??
    0;

  await db.prepare(
    `INSERT OR REPLACE INTO groups
     (group_id, group_name, member_count, created_at)
     VALUES (?, ?, ?, datetime('now'))`
  ).bind(
    chatId,
    title,
    Number(memberCount) || 0
  ).run();

  const message =
    `✅ اطلاعات گروه:

👥 نام گروه: ${title}
🆔 شناسه گروه: ${chatId}
👤 تعداد اعضا: ${Number(memberCount) || 0}`;

  const sent = await sendMessage(chatId, message, token, apiBase);
  if (!sent) throw new Error('Failed to send group information.');
}

async function sendAgainGroupInfo(db, chatId, chatInfo, token, apiBase) {
  await sendInitialGroupInfo(db, chatId, chatInfo, token, apiBase);
}

async function getChatInfo(chatId, token, apiBase) {
  if (!chatId) throw new Error('Missing chatId.');

  const resp = await fetch(`${apiBase}/getChat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId })
  });

  const bodyText = await resp.text();

  let data;
  try {
    data = JSON.parse(bodyText);
  } catch (_) {
    throw new Error(`Invalid Rubika getChatInfo response: HTTP ${resp.status}`);
  }

  if (!resp.ok) {
    throw new Error(
      `Rubika getChatInfo failed: HTTP ${resp.status} ${bodyText}`
    );
  }

  const payload = data?.data || data?.result || data;

  if (payload?.chat) {
    return payload.chat;
  }

  if (payload?.chat_id || payload?.chat_type || payload?.user_id || payload?.title) {
    return payload;
  }

  throw new Error(`Rubika getChat returned no chat object: ${bodyText}`);
}

async function registerWebhook(env) {
  const token = env.RUBIKA_TOKEN;
  const webhookUrl =
    env.WEBHOOK_URL ||
    'https://userbotrubika.hosseinasgari898989.workers.dev/webhook';

  if (!token) {
    const result = {
      ok: false,
      error: 'RUBIKA_TOKEN secret is missing.'
    };
    console.error('Webhook registration skipped:', result.error);
    return result;
  }

  try {
    const resp = await fetch(`https://botapi.rubika.ir/v3/${token}/updateBotEndpoints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        type: 'ReceiveUpdate'
      })
    });

    const body = await resp.text();
    let data = body;
    try {
      data = JSON.parse(body);
    } catch (_) {}

    if (!resp.ok) {
      throw new Error(`Rubika webhook registration failed: HTTP ${resp.status} ${body}`);
    }

    console.log('Rubika Webhook registered:', webhookUrl, data);
    return {
      ok: true,
      webhookUrl,
      response: data
    };
  } catch (e) {
    console.error('Webhook registration error:', e);
    return {
      ok: false,
      webhookUrl,
      error: e instanceof Error ? e.message : String(e)
    };
  }
}

async function sendMessage(chatId, text, token, apiBase) {
  if (!chatId || !token) {
    console.error('sendMessage missing chatId or token.');
    return false;
  }

  try {
    const resp = await fetch(`${apiBase}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text })
    });

    const body = await resp.text();

    if (!resp.ok) {
      console.error('sendMessage HTTP error:', resp.status, body);
      return false;
    }

    let data = null;
    try {
      data = JSON.parse(body);
    } catch (_) {}

    if (data?.status && data.status !== 'OK') {
      console.error('sendMessage API error:', data);
      return false;
    }

    return true;
  } catch (e) {
    console.error('sendMessage error:', e);
    return false;
  }
}

