// ============================================================
// menus/groupInfo.js — اطلاعات گروه: مشخصات / وضعیت / اطلاعات تکمیلی
// اعضا اسکن نمی‌شوند؛ فقط از فیلدهایی که getChat واقعاً برمی‌گرداند استفاده می‌شود.
// ============================================================

import { row, inlineKeypad, btnSimple } from "../rubika/keypad.js";
import { renderPage } from "../core/render.js";
import { registerPage } from "../core/pages.js";
import { bold } from "../rubika/format.js";
import { MENU, EMOJI } from "../config.js";
import { separator, orDash, idField } from "../utils/text.js";
import { logError, upsertGroup } from "../core/db.js";

async function fetchGroupChat(event) {
  const { client, db, chatId } = event;
  try {
    const res = await client.getChat(chatId);
    return res?.data?.chat || null;
  } catch (err) {
    await logError(db, "groupInfo.fetchGroupChat", err.message);
    return null;
  }
}

function guard(event) {
  return event.isGroup;
}

function notGroupText() {
  return [`${EMOJI.warn} ${bold("این بخش فقط داخل گروه در دسترس است.")}`].join("\n");
}

function overviewText(chat) {
  if (!chat) {
    return [`${EMOJI.group} ${bold("اطلاعات گروه")}`, separator(), `${EMOJI.err} دریافت اطلاعات از API ممکن نشد.`].join("\n");
  }
  return [
    `${EMOJI.group} ${bold("اطلاعات گروه")}`,
    separator(),
    `نام گروه: ${bold(orDash(chat.title))}`,
    chat.username ? `نام کاربری: @${chat.username}` : `نوع: خصوصی (بدون نام‌کاربری عمومی)`,
    "",
    `برای مشاهده جزئیات بیشتر یکی از گزینه‌های زیر را انتخاب کنید:`,
  ].join("\n");
}

function overviewKeypad() {
  return inlineKeypad(
    row(btnSimple("group.stats", `${EMOJI.chart} وضعیت`), btnSimple("group.extra", `${EMOJI.list} اطلاعات تکمیلی`)),
    row(btnSimple("group.ids", `${EMOJI.id} شناسه‌ها`)),
    row(btnSimple("nav.back", `${EMOJI.back} بازگشت`), btnSimple("nav.home", `${EMOJI.home} خانه`))
  );
}

function statsText(chat) {
  if (!chat) return overviewText(null);
  return [
    `${EMOJI.chart} ${bold("وضعیت گروه")}`,
    separator(),
    chat.count_members !== undefined ? `تعداد اعضا (گزارش‌شده توسط API): ${bold(chat.count_members)}` : `تعداد اعضا: ${orDash(null)} (API این مقدار را برنگرداند)`,
    chat.owner_id ? idField("Owner ID", chat.owner_id) : null,
    chat.chat_type ? `نوع چت: ${orDash(chat.chat_type)}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function extraText(chat) {
  if (!chat) return overviewText(null);
  return [
    `${EMOJI.list} ${bold("اطلاعات تکمیلی گروه")}`,
    separator(),
    chat.description ? `توضیحات: ${chat.description}` : `توضیحات: ${orDash(null)}`,
    chat.invite_link ? `لینک دعوت: ${chat.invite_link}` : `لینک دعوت: در دسترس نیست`,
  ].join("\n");
}

function idsText(chat) {
  if (!chat) return overviewText(null);
  return [`${EMOJI.id} ${bold("شناسه‌های گروه")}`, separator(), idField("Chat ID", chat.chat_id)].join("\n");
}

function backKeypad() {
  return inlineKeypad(row(btnSimple("group.open", `${EMOJI.back} بازگشت به اطلاعات گروه`), btnSimple("nav.home", `${EMOJI.home} خانه`)));
}

async function renderOrGuard(event, menu, textFn) {
  const { client, db, chatId } = event;
  if (!guard(event)) {
    await renderPage({
      client,
      db,
      chat_id: chatId,
      menu: MENU.MAIN,
      rawText: notGroupText(),
      inlineKeypad: inlineKeypad(row(btnSimple("nav.home", `${EMOJI.home} خانه`))),
      pushHistory: false,
    });
    return;
  }
  await upsertGroup(db, { chat_id: chatId, title: event.chatTitle, username: event.chatUsername });
  const chat = await fetchGroupChat(event);
  await renderPage({
    client,
    db,
    chat_id: chatId,
    menu,
    rawText: textFn(chat),
    inlineKeypad: menu === MENU.GROUP_INFO ? overviewKeypad() : backKeypad(),
  });
}

export const showGroupOverview = (event) => renderOrGuard(event, MENU.GROUP_INFO, overviewText);
export const showGroupStats = (event) => renderOrGuard(event, MENU.GROUP_STATS, statsText);
export const showGroupExtra = (event) => renderOrGuard(event, MENU.GROUP_EXTRA, extraText);
export const showGroupIds = (event) => renderOrGuard(event, MENU.GROUP_IDS, idsText);

export function register(router) {
  registerPage(MENU.GROUP_INFO, showGroupOverview);
  registerPage(MENU.GROUP_STATS, showGroupStats);
  registerPage(MENU.GROUP_EXTRA, showGroupExtra);
  registerPage(MENU.GROUP_IDS, showGroupIds);

  router.on("group.open", showGroupOverview);
  router.on("group.stats", showGroupStats);
  router.on("group.extra", showGroupExtra);
  router.on("group.ids", showGroupIds);
}
