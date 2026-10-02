import { getAgainCooldown, touchAgainCooldown, logEvent } from "../core/db.js";
import { AGAIN_COOLDOWN_MS, EMOJI } from "../config.js";
import { bold } from "../rubika/format.js";
import { fmtDuration } from "../utils/text.js";
import { row, inlineKeypad, btnSimple } from "../rubika/keypad.js";

const TIPS = [
  "نکته: از دکمه «خانه» هر زمان می‌توانید به منوی اصلی برگردید.",
  "نکته: شناسه‌های فنی شما به‌صورت مونواسپیس نمایش داده می‌شوند تا کپی‌کردن راحت‌تر باشد.",
  "نکته: در بخش «ابزارها» می‌توانید دکمه‌های انتخابی روبیکا (تقویم، عدد، رشته) را امتحان کنید.",
  "نکته: در بخش «تنظیمات» می‌توانید زبان ترجیحی خود را تغییر دهید.",
];

export async function handleAgain(event) {
  const { db, client, chatId, isOwnerFlag } = event;
  if (!isOwnerFlag) {
    const cooldown = await getAgainCooldown(db, chatId);
    if (cooldown) {
      const elapsed = Date.now() - cooldown.last_used;
      if (elapsed < AGAIN_COOLDOWN_MS) {
        const remaining = AGAIN_COOLDOWN_MS - elapsed;
        await client.sendMessage(chatId, `${EMOJI.clock} ${bold("هنوز زود است!")}
می‌توانید دوباره از /again استفاده کنید پس از: ${bold(fmtDuration(remaining))}`);
        return;
      }
    }
  }
  await touchAgainCooldown(db, chatId);
  await logEvent(db, "again", chatId);
  const tip = TIPS[Math.floor(Math.random() * TIPS.length)];
  await client.sendMessage(chatId, [`${EMOJI.sparkle} ${bold("دوباره در خدمت شما هستیم!")}`, "", tip].join("
"),
    { inline_keypad: inlineKeypad(row(btnSimple("nav.home", `${EMOJI.home} باز کردن منوی اصلی`))) });
}
