// ============================================================
// menus/settings.js — تنظیمات کاربر (زبان، مشاهده وضعیت، نسخه)
// ============================================================

import { row, inlineKeypad, btnSimple } from "../rubika/keypad.js";
import { renderPage } from "../core/render.js";
import { registerPage } from "../core/pages.js";
import { bold } from "../rubika/format.js";
import { MENU, EMOJI, BOT_VERSION } from "../config.js";
import { separator } from "../utils/text.js";
import { getUser, setUserLang } from "../core/db.js";

const LANG_LABEL = { fa: "فارسی 🇮🇷", en: "English 🇬🇧" };

async function settingsText(event) {
  const user = await getUser(event.db, event.chatId);
  const lang = user?.lang || "fa";
  return [
    `${EMOJI.settings} ${bold("تنظیمات")}`,
    separator(),
    `زبان فعلی: ${bold(LANG_LABEL[lang] || lang)}`,
    `نسخه ربات: ${BOT_VERSION}`,
    "",
    `برای تغییر زبان، یکی از گزینه‌های زیر را انتخاب کنید:`,
  ].join("\n");
}

function settingsKeypad() {
  return inlineKeypad(
    row(btnSimple("settings.lang.fa", "🇮🇷 فارسی"), btnSimple("settings.lang.en", "🇬🇧 English")),
    row(btnSimple("nav.back", `${EMOJI.back} بازگشت`), btnSimple("nav.home", `${EMOJI.home} خانه`))
  );
}

export async function showSettings(event) {
  await renderPage({
    client: event.client,
    db: event.db,
    chat_id: event.chatId,
    menu: MENU.SETTINGS,
    rawText: await settingsText(event),
    inlineKeypad: settingsKeypad(),
  });
}

export function register(router) {
  registerPage(MENU.SETTINGS, showSettings);

  router.on("settings.open", showSettings);
  router.onPrefix("settings.lang.", async (event, lang) => {
    if (lang === "fa" || lang === "en") {
      await setUserLang(event.db, event.chatId, lang);
    }
    await showSettings(event);
  });
}
