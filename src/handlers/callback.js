import { buildRouter } from "../core/appRouter.js";
import { checkAndLockCallback, unlockCallback, logEvent, logError } from "../core/db.js";
import { CALLBACK_DEBOUNCE_MS, EMOJI } from "../config.js";

export async function handleCallback(event) {
  const { db, chatId, buttonId, client } = event;
  if (!buttonId) return;
  const lock = await checkAndLockCallback(db, chatId, buttonId, CALLBACK_DEBOUNCE_MS);
  if (!lock.allowed) return;
  try {
    const router = buildRouter();
    const handled = await router.dispatch(buttonId, event);
    await logEvent(db, "callback", chatId);
    if (!handled) await client.sendMessage(chatId, `${EMOJI.warn} این دکمه دیگر معتبر نیست. لطفاً از «خانه» شروع کنید.`);
  } catch (err) {
    await logError(db, "callback.dispatch", err.message);
    try { await client.sendMessage(chatId, `${EMOJI.err} خطایی هنگام پردازش رخ داد. دوباره تلاش کنید.`); } catch {}
  } finally {
    await unlockCallback(db, chatId);
  }
}
