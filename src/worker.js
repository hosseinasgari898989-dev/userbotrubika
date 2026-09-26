const OWNER_USER_ID = 'u0IDvZ2084e83846b5024bd495b59114';
const COOLDOWN_SECONDS = 12 * 60 * 60;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/webhook' && request.method === 'POST') {
      try {
        const payload = await request.json();
        const update = payload?.update || payload;
        await handleUpdate(update, env);
        return new Response('OK', { status: 200 });
      } catch (e) {
        console.error('Webhook error:', e);
        return new Response('Internal Error', { status: 500 });
      }
    }

    if (url.pathname === '/setup') {
      const result = await registerWebhook(env);
      return new Response(JSON.stringify(result), {
        status: result.ok ? 200 : 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

    if (url.pathname === '/health') {
      ctx.waitUntil(registerWebhook(env));
      return new Response('OK', { status: 200 });
    }

    return new Response('Not Found', { status: 404 });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(registerWebhook(env));
  }
};

async function handleUpdate(update, env) {
  const db = env.DB;
  const token = env.RUBIKA_TOKEN;
  const apiBase = `https://botapi.rubika.ir/v3/${token}`;

  // Rubika sends inline-button clicks as ReceiveQuery.
  if (update?.type === 'ReceiveQuery' && update.inline_message) {
    await handleInlineCallback(update.inline_message, token, apiBase);
    return;
  }

  const message = update?.message || update?.new_message || update?.edited_message || {};
  const chatId = update?.chat_id || message.chat_id;
  const userId = message.sender_id || update?.sender_id;
  const text = (message.text || '').trim();
  const command = text.toLowerCase();

  if (!chatId) return;

  const isStart = command === '/start' || update?.type === 'StartedBot';
  const isAgain = command === '/again';
  const isOwner = userId === OWNER_USER_ID;

  if (!isStart && !isAgain) return;

  try {
    await ensureRequestStateTable(db);
    const state = await getRequestState(db, chatId);

    if (isStart && state && !isOwner) return;

    if (isAgain && !isOwner) {
      if (!state) return;
      const now = Math.floor(Date.now() / 1000);
      const lastRequestAt = state.last_again_at || state.started_at || 0;
      if (now - lastRequestAt < COOLDOWN_SECONDS) return;
    }

    const chatInfo = await getChatInfo(chatId, token, apiBase);
    const chatType =
      message.chat_type ||
      update.chat_type ||
      chatInfo.type ||
      chatInfo.chat_type ||
      chatInfo.chat?.type ||
      chatInfo.chat?.chat_type ||
      inferChatType(chatId);

    if (isStart) {
      if (chatType === 'Group') {
        await saveGroupInfo(db, chatId, chatInfo);
        await sendGroupMenu(chatId, token, apiBase);
      } else {
        await saveUserInfo(db, chatId, userId, chatInfo);
        await sendUserMenu(chatId, token, apiBase);
      }

      await createRequestState(db, chatId);
      return;
    }

    if (chatType === 'Group') {
      await saveGroupInfo(db, chatId, chatInfo);
      await sendGroupMenu(chatId, token, apiBase);
    } else {
      await saveUserInfo(db, chatId, userId, chatInfo);
      await sendUserMenu(chatId, token, apiBase);
    }

    if (!state) await createRequestState(db, chatId);
    await markAgainRequest(db, chatId, Math.floor(Date.now() / 1000));
  } catch (e) {
    console.error('Update processing error:', e);
    if (isStart) {
      await sendMessage(
        chatId,
        '❌ اجرای منوی ربات ناموفق بود. لطفاً چند لحظه بعد دوباره /start را بفرستید.',
        token,
        apiBase
      );
    }
  }
}

async function handleInlineCallback(inlineMessage, token, apiBase) {
  const chatId = inlineMessage?.chat_id;
  const messageId = inlineMessage?.message_id;
  const senderId = inlineMessage?.sender_id || '';
  const buttonId = inlineMessage?.aux_data?.button_id;

  if (!chatId || !messageId || !buttonId) return;

  try {
    const chat = await getChatInfo(chatId, token, apiBase);
    const chatType = chat?.type || chat?.chat_type || inferChatType(chatId);

    switch (buttonId) {
      case 'menu_user_info':
        await editMessage(chatId, messageId, await buildUserInfoText(chat, senderId), userInfoKeypad(), token, apiBase);
        break;
      case 'menu_ids':
        await editMessage(chatId, messageId, buildIdsText(chat, chatType, senderId), backKeypad(), token, apiBase);
        break;
      case 'menu_profile':
        await editMessage(chatId, messageId, buildProfileText(chat, chatType), backKeypad(), token, apiBase);
        break;
      case 'menu_group_info':
        await editMessage(chatId, messageId, buildGroupInfoText(chat, chatId), groupInfoKeypad(), token, apiBase);
        break;
      case 'menu_group_stats':
        await editMessage(chatId, messageId, buildGroupStatsText(chat, chatId), backKeypad(), token, apiBase);
        break;
      case 'menu_refresh':
        await refreshDisplayedMenu(chatId, messageId, chatType, token, apiBase);
        break;
      case 'menu_about':
        await editMessage(chatId, messageId, buildAboutText(), backKeypad(), token, apiBase);
        break;
      case 'menu_back':
        if (chatType === 'Group') {
          await editMessage(chatId, messageId, buildGroupMenuText(), groupMenuKeypad(), token, apiBase);
        } else {
          await editMessage(chatId, messageId, buildUserMenuText(), mainMenuKeypad(), token, apiBase);
        }
        break;
      default:
        return;
    }
  } catch (e) {
    console.error('Inline callback error:', e);
  }
}

async function refreshDisplayedMenu(chatId, messageId, chatType, token, apiBase) {
  const fresh = await getChatInfo(chatId, token, apiBase);

  if (chatType === 'Group') {
    await editMessage(chatId, messageId, buildGroupMenuText(), groupMenuKeypad(), token, apiBase);
  } else {
    await editMessage(chatId, messageId, buildUserMenuText(), mainMenuKeypad(), token, apiBase);
  }
}

function inferChatType(chatId) {
  if (String(chatId).startsWith('g')) return 'Group';
  if (String(chatId).startsWith('c')) return 'Channel';
  return 'User';
}

function mainMenuKeypad() {
  return keypad([
    [simpleButton('menu_user_info', '👤 اطلاعات من'), simpleButton('menu_ids', '🆔 شناسه‌ها')],
    [simpleButton('menu_profile', '📝 پروفایل بیشتر'), simpleButton('menu_refresh', '🔄 به‌روزرسانی')],
    [simpleButton('menu_about', 'ℹ️ درباره ربات')]
  ]);
}

function groupMenuKeypad() {
  return keypad([
    [simpleButton('menu_group_info', '👥 اطلاعات گروه'), simpleButton('menu_group_stats', '📊 آمار گروه')],
    [simpleButton('menu_user_info', '👤 اطلاعات من'), simpleButton('menu_ids', '🆔 شناسه‌ها')],
    [simpleButton('menu_refresh', '🔄 به‌روزرسانی')],
    [simpleButton('menu_about', 'ℹ️ درباره ربات')]
  ]);
}

function userInfoKeypad() {
  return keypad([
    [simpleButton('menu_profile', '📝 پروفایل بیشتر'), simpleButton('menu_ids', '🆔 شناسه‌ها')],
    [simpleButton('menu_back', '↩️ بازگشت')]
  ]);
}

function groupInfoKeypad() {
  return keypad([
    [simpleButton('menu_group_stats', '📊 آمار گروه'), simpleButton('menu_ids', '🆔 شناسه‌ها')],
    [simpleButton('menu_back', '↩️ بازگشت')]
  ]);
}

function backKeypad() {
  return keypad([[simpleButton('menu_back', '↩️ بازگشت به منو')]]);
}

function keypad(rows) {
  return { rows: rows.map(buttons => ({ buttons })) };
}

function simpleButton(id, text) {
  return { id, type: 'Simple', button_text: text };
}

function buildUserMenuText() {
  return [
    '**👋 خوش اومدی!**',
    '',
    '__برای دیدن اطلاعات موردنظر، یکی از دکمه‌های زیر را انتخاب کن 👇__',
    '',
    '🔹 همه بخش‌ها در همین پیام باز و بسته می‌شوند؛ پیام‌های اضافی ساخته نمی‌شود.'
  ].join('\n');
}

function buildGroupMenuText() {
  return [
    '**👋 منوی اطلاعات گروه آماده است!**',
    '',
    '__یکی از بخش‌های زیر را انتخاب کن 👇__',
    '',
    '🔹 اطلاعات هر بخش در همین پیام نمایش داده می‌شود.'
  ].join('\n');
}

async function buildUserInfoText(chat, senderId) {
  const savedUserId = chat?.user_id || senderId || 'ثبت نشده';
  const fullName = [chat?.first_name, chat?.last_name].filter(Boolean).join(' ') || 'ثبت نشده';
  const username = chat?.username ? `@${String(chat.username).replace(/^@/, '')}` : 'ندارد';

  return [
    '**👤 اطلاعات کاربری**',
    '',
    `**نام کامل:** ${fullName}`,
    `**نام کوچک:** ${chat?.first_name || 'ثبت نشده'}`,
    `**نام خانوادگی:** ${chat?.last_name || 'ثبت نشده'}`,
    `**نام کاربری:** ${username}`,
    `**شناسه کاربری:** ${savedUserId}`,
    `**نوع چت:** ${chat?.type || chat?.chat_type || 'User'}`
  ].join('\n');
}

function buildIdsText(chat, chatType, senderId) {
  const userId = chatType === 'Group' ? (senderId || 'ثبت نشده') : (chat?.user_id || senderId || 'ثبت نشده');
  const chatId = chat?.chat_id || chat?.guid || 'از API برنگشته';

  return [
    '**🆔 شناسه‌ها و اطلاعات فنی**',
    '',
    `**شناسه این چت:** ${chatId}`,
    `**شناسه کاربر شما:** ${userId}`,
    `**نوع:** ${chatType}`,
    '',
    '__این بخش فقط داده‌هایی را نمایش می‌دهد که خود Rubika در اختیار ربات گذاشته است.__'
  ].join('\n');
}

function buildProfileText(chat, chatType) {
  const bio = chat?.bio || chat?.about || 'ثبت نشده';
  const username = chat?.username ? `@${String(chat.username).replace(/^@/, '')}` : 'ندارد';

  if (chatType === 'Group') {
    return [
      '**📝 اطلاعات تکمیلی گروه**',
      '',
      `**نام کاربری:** ${username}`,
      `**توضیحات:** ${chat?.description || bio}`,
      `**مالک:** ${chat?.owner_id || chat?.owner_user_id || 'نامشخص'}`,
      `**عمومی:** ${typeof chat?.is_public === 'boolean' ? (chat.is_public ? 'بله' : 'خیر') : 'نامشخص'}`,
      `**لینک:** ${chat?.link || chat?.invite_link || 'ندارد'}`
    ].join('\n');
  }

  return [
    '**📝 پروفایل بیشتر**',
    '',
    `**نام کاربری:** ${username}`,
    `**درباره من:** ${bio}`,
    `**شناسه:** ${chat?.user_id || 'ثبت نشده'}`
  ].join('\n');
}

function buildGroupInfoText(chat, chatId) {
  const username = chat?.username || chat?.username_handle || '';
  const description = chat?.description || chat?.about || 'ثبت نشده';
  const ownerId = chat?.owner_id || chat?.owner_user_id || 'نامشخص';
  const memberCount = chat?.member_count ?? chat?.members_count ?? chat?.count_members ?? chat?.participants_count ?? 'نامشخص';
  const isPublic = typeof chat?.is_public === 'boolean' ? (chat.is_public ? 'بله' : 'خیر') : 'نامشخص';

  return [
    '**👥 اطلاعات کامل گروه**',
    '',
    `**نام:** ${chat?.title || chat?.name || 'ثبت نشده'}`,
    `**شناسه گروه:** ${chat?.chat_id || chatId}`,
    `**نام کاربری:** ${username ? '@' + String(username).replace(/^@/, '') : 'ندارد'}`,
    `**تعداد اعضا:** ${memberCount}`,
    `**شناسه مالک:** ${ownerId}`,
    `**عمومی:** ${isPublic}`,
    `**توضیحات:** ${description}`,
    `**لینک:** ${chat?.link || chat?.invite_link || 'ندارد'}`
  ].join('\n');
}

function buildGroupStatsText(chat, chatId) {
  const memberCount = chat?.member_count ?? chat?.members_count ?? chat?.count_members ?? chat?.participants_count ?? 'نامشخص';

  return [
    '**📊 آمار گروه**',
    '',
    `**اعضای گزارش‌شده توسط API:** ${memberCount}`,
    `**شناسه گروه:** ${chat?.chat_id || chatId}`,
    '',
    '__ربات برای این بخش هیچ عضو دیگری را اسکن یا جمع‌آوری نمی‌کند؛ فقط اطلاعاتی را نشان می‌دهد که خود API برمی‌گرداند.__'
  ].join('\n');
}

function buildAboutText() {
  return [
    '**🤖 درباره ربات**',
    '',
    '**منوی تعاملی:** دکمه‌ها داخل همان پیام کار می‌کنند.',
    '**ویرایش پیام:** با انتخاب هر بخش، متن همان پیام عوض می‌شود.',
    '**قالب‌بندی:** Bold، Italic، Underline، Strike، Spoiler و Link برای متن‌های Markdown آماده است.',
    '**دکمه‌های شیشه‌ای:** بر پایه inline_keypad و callbackهای Rubika ساخته شده‌اند.',
    '',
    '__هدف: اطلاعات بیشتر با پیام کمتر و تجربه تمیزتر.__'
  ].join('\n');
}

async function saveUserInfo(db, chatId, userId, chat) {
  if (!userId) throw new Error('Private chat is missing sender_id.');

  const savedUserId = chat?.user_id || userId;
  const firstName = chat?.first_name || '';
  const lastName = chat?.last_name || '';
  const username = chat?.username || '';

  await db.prepare(
    `INSERT OR REPLACE INTO users
     (user_id, username, first_name, last_name, ip_address, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`
  ).bind(savedUserId, username, firstName, lastName, 'unknown').run();

  return savedUserId;
}

async function saveGroupInfo(db, chatId, chat) {
  const title = chat?.title || chat?.name || 'نام گروه ثبت نشده';
  const memberCount = Number(chat?.member_count ?? chat?.members_count ?? chat?.count_members ?? chat?.participants_count) || 0;

  await db.prepare(
    `INSERT OR REPLACE INTO groups
     (group_id, group_name, member_count, created_at)
     VALUES (?, ?, ?, datetime('now'))`
  ).bind(chatId, title, memberCount).run();
}

async function sendUserMenu(chatId, token, apiBase) {
  const sent = await sendMessage(chatId, buildUserMenuText(), token, apiBase, mainMenuKeypad());
  if (!sent) throw new Error('Failed to send user menu.');
}

async function sendGroupMenu(chatId, token, apiBase) {
  const sent = await sendMessage(chatId, buildGroupMenuText(), token, apiBase, groupMenuKeypad());
  if (!sent) throw new Error('Failed to send group menu.');
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
    throw new Error(`Invalid Rubika getChat response: HTTP ${resp.status}`);
  }

  if (!resp.ok) {
    throw new Error(`Rubika getChat failed: HTTP ${resp.status} ${bodyText}`);
  }

  const payload = data?.data || data?.result || data;
  if (payload?.chat) return payload.chat;
  if (payload?.chat_id || payload?.chat_type || payload?.user_id || payload?.title || payload?.first_name) {
    return payload;
  }

  throw new Error(`Rubika getChat returned no chat object: ${bodyText}`);
}

function parseMarkdown(text) {
  const source = String(text ?? '');
  const regex = /```([\s\S]*?)```|\*\*([\s\S]*?)\*\*|`([\s\S]*?)`|__([\s\S]*?)__|--([\s\S]*?)--|\[([\s\S]*?)\]\((\S+?)\)|~~([\s\S]*?)~~|\|\|([\s\S]*?)\|\|/g;
  const matches = [...source.matchAll(regex)];
  let normalized = source;
  let removedUnits = 0;
  let removedChars = 0;
  const parts = [];

  for (const match of matches) {
    const start = match.index ?? 0;
    const whole = match[0];
    let type = null;
    let inner = '';
    let url = null;

    if (match[1] !== undefined) { type = 'Pre'; inner = match[1]; }
    else if (match[2] !== undefined) { type = 'Bold'; inner = match[2]; }
    else if (match[3] !== undefined) { type = 'Mono'; inner = match[3]; }
    else if (match[4] !== undefined) { type = 'Italic'; inner = match[4]; }
    else if (match[5] !== undefined) { type = 'Underline'; inner = match[5]; }
    else if (match[6] !== undefined) { type = 'Link'; inner = match[6]; url = match[7]; }
    else if (match[8] !== undefined) { type = 'Strike'; inner = match[8]; }
    else if (match[9] !== undefined) { type = 'Spoiler'; inner = match[9]; }

    if (!type || inner === '') continue;

    const innerParsed = parseMarkdown(inner);
    const cleanInner = innerParsed.text;
    const fromIndex = source.slice(0, start).length - removedUnits;

    for (const nested of innerParsed.metadataParts) {
      parts.push({ ...nested, from_index: nested.from_index + fromIndex });
    }

    parts.push({ type, from_index: fromIndex, length: cleanInner.length, ...(url ? { link_url: url } : {}) });

    const currentStart = start - removedChars;
    normalized = normalized.slice(0, currentStart) + cleanInner + normalized.slice(currentStart + whole.length);
    const removed = whole.length - cleanInner.length;
    removedUnits += removed;
    removedChars += removed;
  }

  return {
    text: normalized.trim(),
    metadataParts: parts
  };
}

async function sendMessage(chatId, text, token, apiBase, inlineKeypad = null) {
  if (!chatId || !token) return null;

  try {
    const parsed = parseMarkdown(text);
    const payload = {
      chat_id: chatId,
      text: parsed.text
    };

    if (parsed.metadataParts.length) {
      payload.metadata = { meta_data_parts: parsed.metadataParts };
    }

    if (inlineKeypad) payload.inline_keypad = inlineKeypad;

    const resp = await fetch(`${apiBase}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const body = await resp.text();
    let data = null;
    try { data = JSON.parse(body); } catch (_) {}

    if (!resp.ok || data?.status === 'ERROR') {
      console.error('sendMessage error:', resp.status, body);
      return null;
    }

    return data || { status: 'OK' };
  } catch (e) {
    console.error('sendMessage exception:', e);
    return null;
  }
}

async function editMessage(chatId, messageId, text, inlineKeypad, token, apiBase) {
  const parsed = parseMarkdown(text);
  const payload = {
    chat_id: chatId,
    message_id: messageId,
    text: parsed.text
  };

  if (parsed.metadataParts.length) {
    payload.metadata = { meta_data_parts: parsed.metadataParts };
  }

  const textResp = await fetch(`${apiBase}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const textBody = await textResp.text();
  if (!textResp.ok) {
    throw new Error(`editMessageText failed: HTTP ${textResp.status} ${textBody}`);
  }

  if (inlineKeypad) {
    const keypadResp = await fetch(`${apiBase}/editMessageKeypad`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        inline_keypad: inlineKeypad
      })
    });

    const keypadBody = await keypadResp.text();
    if (!keypadResp.ok) {
      throw new Error(`editMessageKeypad failed: HTTP ${keypadResp.status} ${keypadBody}`);
    }
  }

  return true;
}

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
  return await db.prepare(
    `SELECT chat_id, started_at, last_again_at
     FROM bot_request_state
     WHERE chat_id = ?`
  ).bind(chatId).first();
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

async function registerWebhook(env) {
  const token = env.RUBIKA_TOKEN;
  const webhookUrl = env.WEBHOOK_URL || 'https://userbotrubika.hosseinasgari898989.workers.dev/webhook';

  if (!token) {
    return { ok: false, error: 'RUBIKA_TOKEN secret is missing.' };
  }

  try {
    const resp = await fetch(`https://botapi.rubika.ir/v3/${token}/updateBotEndpoints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl, type: 'ReceiveUpdate' })
    });

    const body = await resp.text();
    let data = body;
    try { data = JSON.parse(body); } catch (_) {}

    if (!resp.ok) {
      throw new Error(`Rubika webhook registration failed: HTTP ${resp.status} ${body}`);
    }

    console.log('Rubika Webhook registered:', webhookUrl, data);
    return { ok: true, webhookUrl, response: data };
  } catch (e) {
    console.error('Webhook registration error:', e);
    return { ok: false, webhookUrl, error: e instanceof Error ? e.message : String(e) };
  }
}
