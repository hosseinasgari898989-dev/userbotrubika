export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // دریافت پیام‌های روبیکا (Webhook)
    if (url.pathname === '/webhook' && request.method === 'POST') {
      try {
        const update = await request.json();
        await handleUpdate(update, env);
        return new Response('OK', { status: 200 });
      } catch (e) {
        console.error('Webhook error:', e);
        return new Response('Internal Error', { status: 500 });
      }
    }

    // بررسی سلامت (Health Check)
    if (url.pathname === '/health') {
      return new Response('OK', { status: 200 });
    }

    return new Response('Not Found', { status: 404 });
  },

  // Cron Trigger برای بیدار نگه داشتن Worker
  async scheduled(event, env, ctx) {
    console.log('Cron keep-alive triggered at:', new Date().toISOString());
    // ارسال یک درخواست به خود Worker برای فعال نگه داشتن آن
    ctx.waitUntil(
      fetch('https://YOUR-WORKER-NAME.YOUR-SUBDOMAIN.workers.dev/health')
    );
  }
};

async function handleUpdate(update, env) {
  const db = env.DB;
  const BOT_TOKEN = env.RUBIKA_TOKEN;
  const API_BASE = 'https://botapi.rubika.ir/v1';

  // استخراج اطلاعات پیام
  const message = update.message || update.edited_message;
  if (!message) return;

  const chatId = message.chat_id;
  const userId = message.sender_id;
  const text = message.text || '';
  const chatType = message.chat_type; // 'User', 'Group', 'Channel'

  // ==================== دستور /start در چت خصوصی ====================
  if (text === '/start' && chatType === 'User') {
    const senderInfo = await getUserInfo(userId, BOT_TOKEN, API_BASE);
    
    // ذخیره اطلاعات کاربر در دیتابیس
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

    // ارسال پیام تأیید (فقط یک بار)
    await sendMessage(chatId, 'اطلاعات شما با موفقیت ذخیره شد. ✅', BOT_TOKEN, API_BASE);
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
