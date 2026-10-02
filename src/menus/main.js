// ============================================================
// menus/main.js — منوی اصلی ربات + «خانه»/«درباره ربات»
// ============================================================

import { row, inlineKeypad, btnSimple } from "../rubika/keypad.js";
import { renderPage } from "../core/render.js";
import { registerPage } from "../core/pages.js";
import { bold, italic } from "../rubika/format.js";
import { MENU, EMOJI, BOT_VERSION } from "../config.js";
import { separator } from "../utils/text.js";

export function mainMenuText({ displayName, isGroup }) {
  return [
    `${EMOJI.sparkle} ${bold("به ربات حرفه‌ای روبیکا خوش آمدید")}`,
    "",
    `${italic(`سلام ${displayName || ""} 👋`)}`,
    isGroup ? "این ربات در حالت گروهی فعال است." : "یکی از گزینه‌های زیر را انتخاب کنید:",
    separator(),
    `${EMOJI.info} از دکمه‌های زیر برای پیمایش استفاده کنید. همه صفحات داخل همین پیام باز می‌شوند.`,
  ].join("\n");
}

export function mainMenuKeypad({ isGroup, isOwner }) {
  const rows = [];
  if (isGroup) {
    rows.push(row(btnSimple("user.open", `${EMOJI.user} اطلاعات من`), btnSimple("group.open", `${EMOJI.group} اطلاعات گروه`)));
  } else {
    rows.push(row(btnSimple("user.open", `${EMOJI.user} اطلاعات کاربر`)));
  }
  rows.push(row(btnSimple("tools.open", `${EMOJI.tools} ابزارها`), btnSimple("settings.open", `${EMOJI.settings} تنظیمات`)));
  rows.push(row(btnSimple("help.open", `${EMOJI.help} راهنما`), btnSimple("about.open", `${EMOJI.about} درباره ربات`)));
  if (isOwner) {
    rows.push(row(btnSimple("admin.open", `${EMOJI.admin} پنل مدیریت`)));
  }
  rows.push(row(btnSimple("nav.refresh", `${EMOJI.refresh} به‌روزرسانی`)));
  return inlineKeypad(...rows);
}

export async function showMainMenu(event, ctx = {}, { forceNew = false, pushHistory = true } = {}) {
  const { client, db, chatId, isGroup, isOwnerFlag, displayName } = event;
  await renderPage({
    client,
    db,
    chat_id: chatId,
    menu: MENU.MAIN,
    rawText: mainMenuText({ displayName, isGroup }),
    inlineKeypad: mainMenuKeypad({ isGroup, isOwner: isOwnerFlag }),
    forceNew,
    pushHistory,
    ctx,
  });
}

export function aboutText() {
  return [
    `${EMOJI.about} ${bold("درباره ربات")}`,
    separator(),
    `نسخه: ${bold(BOT_VERSION)}`,
    `پلتفرم: Cloudflare Workers + D1`,
    `این ربات با معماری ماژولار و Callback Router حرفه‌ای ساخته شده و برای توسعه آینده طراحی شده است.`,
  ].join("\n");
}

export async function showAbout(event) {
  const { client, db, chatId } = event;
  await renderPage({
    client,
    db,
    chat_id: chatId,
    menu: MENU.ABOUT,
    rawText: aboutText(),
    inlineKeypad: inlineKeypad(row(btnSimple("nav.home", `${EMOJI.home} خانه`))),
  });
}

export function register(router) {
  registerPage(MENU.MAIN, (event, ctx) => showMainMenu(event, ctx, { pushHistory: false }));
  registerPage(MENU.ABOUT, (event) => showAbout(event));

  router.on("main.open", (event) => showMainMenu(event, {}, { pushHistory: true }));
  router.on("nav.home", (event) => showMainMenu(event, {}, { pushHistory: false }));
  router.on("nav.refresh", (event) => showMainMenu(event, {}, { pushHistory: false }));
  router.on("about.open", (event) => showAbout(event));
}
