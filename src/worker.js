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

  // روبیکا در Webhookهای جدید، پیام را داخل new_message/edited_message
  // و chat_id را در سطح خود Update ارسال می‌کند؛ ساختار قدیمی هم پشتیبانی می‌شود.
  const message =
    update.message ||
    update.new_message ||
    update.edited_message ||
    {};

  const chatId = update.chat_id || message.chat_id;
  const userId = message.sender_id || update.sender_id;
  const text = message.text || '';

  // chat_type همیشه در Webhook وجود ندارد؛ در صورت نیاز از اطلاعات خود چت می‌خوانیم.
  let chatType =
    message.chat_type ||
    update.chat_type ||
    null;

  let chatInfo = {};
  if (chatId && !chatType) {
    chatInfo = await getChatInfo(chatId, BOT_TOKEN, API_BASE);
    chatType =
      chatInfo.type ||
      chatInfo.chat_type ||
      chatInfo.chat?.type ||
      chatInfo.chat?.chat_type ||
      null;
  }

  // ==================== شروع ربات در چت خصوصی ====================
  if (update.type === 'StartedBot' && chatId) {
    await sendMessage(
      chatId,
      'سلام 👋 ربات با موفقیت فعال شد. ✅',
      BOT_TOKEN,
      API_BASE
    );
    return;
  }

  // ==================== دستور /start ====================
  if (text.trim().toLowerCase() === '/start') {
    // پاسخ به /start نباید به تشخیص ناقص chat_type وابسته باشد.
    await sendMessage(
      chatId,
      'اطلاعات شما با موفقیت ذخیره شد. ✅',
      BOT_TOKEN,
      API_BASE
    );

    // اطلاعات کاربر فقط در چت خصوصی ذخیره می‌شود.
    if (chatType === 'User' || chatType === 'Private') {
      const senderInfo = await getUserInfo(userId, BOT_TOKEN, API_BASE);

      await db.prepare(
        `INSERT OR REPLACE INTO users (user_id, username, first_name, last_name, ip_address, created_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`
      ).bind(
        userId,
        senderInfo.username || '',
        senderInfo.first_name || '',
        senderInfo.last_name || '',
        request.headers.get('CF-Connecting-IP') || 'unknown'
      ).run();
    }

    return;
  }

  // ==================== عضویت در گروه ====================
  if (chatType === 'Group') {
    // ذخیره اطلاعات گروه
    const groupInfo = await getChatInfo(chatId, BOT_TOKEN, API_BASE);

    await db.prepare(
      `INSERT OR REPLACE INTO groups (group_id, group_name, member_count, created_at)
       VALUES (?, ?, ?, datetime('now'))`
    ).bind(chatId, groupInfo.title || 'Unknown', groupInfo.member_count || 0).run();

    // دریافت و ذخیره اعضای گروه (نمونه - نیاز به پیاده‌سازی کامل دارد)
    const members = await getChatMembers(chatId, BOT_TOKEN, API_BASE);
    for (const member of members) {
      await db.prepare(
        `INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)`
      ).bind(chatId, member.user_id).run();
    }

    console.log(`گروه ${chatId} با ${members.length} عضو ذخیره شد.`);
    // در گروه‌ها هیچ پیامی ارسال نمی‌شود
    return;
  }

  // سایر پیام‌ها نادیده گرفته می‌شوند
}

// ==================== توابع کمکی ====================

async function getUserInfo(userId, token, apiBase) {
  try {
    const resp = await fetch(`${apiBase}/getUserInfo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, user_id: userId })
    });
    const data = await resp.json();
    return data.result?.user || {};
  } catch (e) {
    console.error('getUserInfo error:', e);
    return {};
  }
}

async function getChatInfo(chatId, token, apiBase) {
  try {
    const resp = await fetch(`${apiBase}/getChatInfo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, chat_id: chatId })
    });
    const data = await resp.json();
    return data.result?.chat || {};
  } catch (e) {
    console.error('getChatInfo error:', e);
    return {};
  }
}

async function getChatMembers(chatId, token, apiBase) {
  try {
    const resp = await fetch(`${apiBase}/getChatMembers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, chat_id: chatId })
    });
    const data = await resp.json();
    return data.result?.members || [];
  } catch (e) {
    console.error('getChatMembers error:', e);
    return [];
  }
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
        token,
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
  try {
    await fetch(`${apiBase}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, chat_id: chatId, text })
    });
  } catch (e) {
    console.error('sendMessage error:', e);
  }
}
