export function isOwner(env, chat_id) {
  return !!env.OWNER_ID && String(env.OWNER_ID) === String(chat_id);
}
export function chatTypeFromId(chat_id) {
  if (!chat_id) return "unknown";
  if (chat_id.startsWith("b")) return "user";
  if (chat_id.startsWith("g")) return "group";
  if (chat_id.startsWith("c")) return "channel";
  return "unknown";
}
export function isNonEmptyString(v, maxLen = 4000) {
  return typeof v === "string" && v.length > 0 && v.length <= maxLen;
}
export function isValidUpdate(update) {
  if (!update || typeof update !== "object") return false;
  if (!update.type) return false;
  if (update.type === "NewMessage" && !update.chat_id) return false;
  if (update.type === "ReceiveQuery" && !update.inline_message) return false;
  return true;
}
export function isWebhookPathValid(env, url) {
  if (!env.WEBHOOK_SECRET) return true;
  return url.pathname.endsWith(`/webhook/${env.WEBHOOK_SECRET}`);
}
