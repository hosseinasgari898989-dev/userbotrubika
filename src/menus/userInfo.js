// ============================================================
// menus/userInfo.js — اطلاعات کاربر: نمای کلی → پروفایل / شناسه‌های فنی
// فقط از داده‌هایی استفاده می‌شود که واقعاً از getChat برمی‌گردد.
// ============================================================

import { row, inlineKeypad, btnSimple } from "../rubika/keypad.js";
import { renderPage } from "../core/render.js";
import { registerPage } from "../core/pages.js";
import { bold } from "../rubika/format.js";
import { MENU, EMOJI } from "../config.js";
import { separator, fullName, orDash, idField } from "../utils/text.js";
import { logError } from "../core/db.js";

async function fetchTargetChat(event) {
  const { client, db, senderId } = event;
  try {
    const res = await client.getChat(senderId);
    return res?.data?.chat || null;
  } catch (err) {
    await logError(db, "userInfo.fetchTargetChat", err.message);
    return null;
  }
}

function overviewText(chat) {
  if (!chat) {
    return [`${EMOJI.user} ${bold("اطلاعات کاربر")}`, separator(), `${EMOJI.err} دریافت اطلاعات از API ممکن نشد. لطفاً بعداً دوباره تلاش کنید.`].join(
      "\n"
    );
  }
  return [
    `${EMOJI.user} ${bold("اطلاعات کاربر")}`,
    separator(),
    `نام نمایشی: ${bold(fullName(chat))}`,
    chat.username ? `نام کاربری: @${chat.username}` : `نام کاربری: ${orDash(null)}`,
    "",
    `برای مشاهده جزئیات بیشتر یکی از گزینه‌های زیر را انتخاب کنید:`,
  ].join("\n");
}

function overviewKeypad() {
  return inlineKeypad(
    row(btnSimple("user.profile", `${EMOJI.info} پروفایل`), btnSimple("user.ids", `${EMOJI.id} شناسه‌های فنی`)),
    row(btnSimple("nav.back", `${EMOJI.back} بازگشت`), btnSimple("nav.home", `${EMOJI.home} خانه`))
  );
}

function profileText(chat) {
  if (!chat) return overviewText(null);
  return [
    `${EMOJI.info} ${bold("پروفایل کاربر")}`,
    separator(),
    `نام کوچک: ${orDash(chat.first_name)}`,
    `نام خانوادگی: ${orDash(chat.last_name)}`,
    `نام کاربری: ${chat.username ? "@" + chat.username : orDash(null)}`,
    `نوع چت: ${orDash(chat.chat_type)}`,
    chat.is_verified !== undefined ? `تیک آبی: ${chat.is_verified ? "بله ✅" : "خیر"}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function idsText(chat) {
  if (!chat) return overviewText(null);
  return [
    `${EMOJI.id} ${bold("شناسه‌های فنی")}`,
    separator(),
    idField("User ID", chat.user_id || chat.chat_id),
    idField("Chat ID", chat.chat_id),
    "",
    `${EMOJI.info} برای کپی، روی متن مونواسپیس بالا لمس‌ونگه‌دارید (اکثر کلاینت‌های روبیکا گزینه کپی را نمایش می‌دهند). روبیکا Bot API در حال حاضر دکمه اختصاصی «کپی به کلیپ‌بورد» ارائه نمی‌دهد.`,
  ].join("\n");
}

function backKeypad() {
  return inlineKeypad(row(btnSimple("user.open", `${EMOJI.back} بازگشت به اطلاعات کاربر`), btnSimple("nav.home", `${EMOJI.home} خانه`)));
}

export async function showUserOverview(event) {
  const chat = await fetchTargetChat(event);
  await renderPage({
    client: event.client,
    db: event.db,
    chat_id: event.chatId,
    menu: MENU.USER_INFO,
    rawText: overviewText(chat),
    inlineKeypad: overviewKeypad(),
  });
}

export async function showUserProfile(event) {
  const chat = await fetchTargetChat(event);
  await renderPage({
    client: event.client,
    db: event.db,
    chat_id: event.chatId,
    menu: MENU.USER_PROFILE,
    rawText: profileText(chat),
    inlineKeypad: backKeypad(),
  });
}

export async function showUserIds(event) {
  const chat = await fetchTargetChat(event);
  await renderPage({
    client: event.client,
    db: event.db,
    chat_id: event.chatId,
    menu: MENU.USER_IDS,
    rawText: idsText(chat),
    inlineKeypad: backKeypad(),
  });
}

export function register(router) {
  registerPage(MENU.USER_INFO, (event) => showUserOverview(event));
  registerPage(MENU.USER_PROFILE, (event) => showUserProfile(event));
  registerPage(MENU.USER_IDS, (event) => showUserIds(event));

  router.on("user.open", showUserOverview);
  router.on("user.profile", showUserProfile);
  router.on("user.ids", showUserIds);
}
