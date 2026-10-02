import { buildRouter } from "../core/appRouter.js";
import { handleStart } from "./start.js";
import { handleAgain } from "./again.js";
import { showHelpOverview } from "../menus/help.js";
import { showMainMenu } from "../menus/main.js";
import { checkAndLockCallback, unlockCallback, logEvent, logError } from "../core/db.js";
import { CALLBACK_DEBOUNCE_MS, EMOJI } from "../config.js";

export async function handleMessage(event) {
  const { db, chatId, text, buttonId } = event;
  if (buttonId) {
    const lock = await checkAndLockCallback(db, chatId, buttonId, CALLBACK_DEBOUNCE_MS);
    if (!lock.allowed) return;
    try {
      const router = buildRouter();
      const handled = await router.dispatch(buttonId, event);
      await logEvent(db, "callback", chatId);
      if (!handled) await event.client.sendMessage(chatId, `${EMOJI.warn} این گزینه دیگر معتبر نیست. از دکمه «خانه» استفاده کنید.`);
    } catch (err) {
      await logError(db, "message.pickerDispatch", err.message);
      await event.client.sendMessage(chatId, `${EMOJI.err} خطایی رخ داد. لطفاً دوباره تلاش کنید.`);
    } finally { await unlockCallback(db, chatId); }
    return;
  }
  if (!text) return;
  if (text.startsWith("/")) {
    const [cmdRaw] = text.trim().split(/\s+/);
    const cmd = cmdRaw.slice(1).split("@")[0].toLowerCase();
    switch (cmd) {
      case "start": return handleStart(event);
      case "help": return showHelpOverview(event);
      case "again": return handleAgain(event);
      case "menu": return showMainMenu(event, {}, { pushHistory: false });
      default: return event.client.sendMessage(chatId, `${EMOJI.warn} دستور ناشناخته. برای شروع /start یا /help را بفرستید.`);
    }
  }
  if (!event.isGroup) await event.client.sendMessage(chatId, `${EMOJI.info} برای دیدن منو، /start یا /menu را بفرستید.`);
}
