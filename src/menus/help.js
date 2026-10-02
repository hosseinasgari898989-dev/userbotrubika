// ============================================================
// menus/help.js — راهنمای تعاملی (/help هم به همین صفحه هدایت می‌شود)
// ============================================================

import { row, inlineKeypad, btnSimple } from "../rubika/keypad.js";
import { renderPage } from "../core/render.js";
import { registerPage } from "../core/pages.js";
import { bold } from "../rubika/format.js";
import { MENU, EMOJI } from "../config.js";
import { separator } from "../utils/text.js";

const TOPICS = {
  user: { title: "اطلاعات کاربر", body: "نمایش نام، نام‌کاربری و شناسه‌های فنی شما با داده واقعی از API روبیکا." },
  group: { title: "اطلاعات گروه", body: "نمایش مشخصات، وضعیت و اطلاعات تکمیلی گروه فعلی (فقط داخل گروه فعال است)." },
  tools: { title: "ابزارها", body: "ارسال موقعیت مکانی، نظرسنجی، دکمه‌های انتخابی (تقویم/عدد/رشته/متن) و نمایش قالب‌بندی متن." },
  settings: { title: "تنظیمات", body: "تغییر زبان و مشاهده نسخه ربات." },
  nav: { title: "پیمایش", body: "دکمه «بازگشت» یک مرحله عقب می‌رود و «خانه» همیشه به منوی اصلی برمی‌گردد؛ تقریباً همه صفحات داخل همان پیام ویرایش می‌شوند." },
  again: { title: "دستور /again", body: "این دستور هر ۱۲ ساعت یک‌بار برای هر کاربر قابل استفاده است (مالک ربات محدودیت ندارد)." },
};

function overviewText() {
  return [`${EMOJI.help} ${bold("راهنمای ربات")}`, separator(), `یک موضوع را برای توضیح بیشتر انتخاب کنید:`].join("\n");
}

function overviewKeypad() {
  return inlineKeypad(
    row(btnSimple("help.topic.user", "👤 اطلاعات کاربر"), btnSimple("help.topic.group", "👥 اطلاعات گروه")),
    row(btnSimple("help.topic.tools", "🧰 ابزارها"), btnSimple("help.topic.settings", "⚙️ تنظیمات")),
    row(btnSimple("help.topic.nav", "🧭 پیمایش"), btnSimple("help.topic.again", "⏱️ دستور /again")),
    row(btnSimple("nav.back", `${EMOJI.back} بازگشت`), btnSimple("nav.home", `${EMOJI.home} خانه`))
  );
}

export async function showHelpOverview(event) {
  await renderPage({
    client: event.client,
    db: event.db,
    chat_id: event.chatId,
    menu: MENU.HELP,
    rawText: overviewText(),
    inlineKeypad: overviewKeypad(),
  });
}

export async function showHelpTopic(event, key) {
  const topic = TOPICS[key];
  const text = topic
    ? [`${EMOJI.help} ${bold(topic.title)}`, separator(), topic.body].join("\n")
    : [`${EMOJI.warn} موضوع پیدا نشد.`].join("\n");
  await renderPage({
    client: event.client,
    db: event.db,
    chat_id: event.chatId,
    menu: MENU.HELP_TOPIC,
    rawText: text,
    inlineKeypad: inlineKeypad(row(btnSimple("help.open", `${EMOJI.back} بازگشت به راهنما`), btnSimple("nav.home", `${EMOJI.home} خانه`))),
  });
}

export function register(router) {
  registerPage(MENU.HELP, showHelpOverview);
  registerPage(MENU.HELP_TOPIC, (event) => showHelpOverview(event));

  router.on("help.open", showHelpOverview);
  router.onPrefix("help.topic.", (event, key) => showHelpTopic(event, key));
}
