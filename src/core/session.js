import { chatTypeFromId, isOwner } from "./security.js";

export function buildEvent(update, client, db, env) {
  const type = update.type;
  if (type === "ReceiveQuery") {
    const im = update.inline_message || {};
    const chatId = im.chat_id;
    return {
      kind: "callback", raw: update, client, db, env, chatId,
      senderId: im.sender_id || chatId, messageId: im.message_id || null,
      text: im.text || "", buttonId: im.aux_data?.button_id || null, value: im.text || "",
      isGroup: chatTypeFromId(chatId) === "group",
      isChannel: chatTypeFromId(chatId) === "channel",
      isPrivate: chatTypeFromId(chatId) === "user",
      isOwnerFlag: isOwner(env, chatId),
      displayName: null, chatTitle: null, chatUsername: null,
    };
  }
  if (type === "NewMessage") {
    const msg = update.new_message || {};
    const chatId = update.chat_id;
    return {
      kind: "message", raw: update, client, db, env, chatId,
      senderId: msg.sender_id || chatId, messageId: msg.message_id || null,
      text: msg.text || "", buttonId: msg.aux_data?.button_id || null, value: msg.text || "",
      isGroup: chatTypeFromId(chatId) === "group",
      isChannel: chatTypeFromId(chatId) === "channel",
      isPrivate: chatTypeFromId(chatId) === "user",
      isOwnerFlag: isOwner(env, chatId),
      displayName: null, chatTitle: null, chatUsername: null, isEdited: !!msg.is_edited,
    };
  }
  return null;
}
