import { formatText } from "../rubika/format.js";
import { getUiState, saveUiState } from "./db.js";

export async function renderPage({ client, db, chat_id, menu, rawText, inlineKeypad, pushHistory = true, ctx = {}, forceNew = false }) {
  const { text, metadata } = formatText(rawText);
  const state = await getUiState(db, chat_id);

  let history = state?.history || [];
  if (pushHistory && state?.menu && state.menu !== menu) {
    history = [...history, { menu: state.menu, ctx: state.ctx || {} }].slice(-15);
  }

  if (!forceNew && state?.message_id) {
    try {
      await client.editMessageText(chat_id, state.message_id, text, metadata);
      await client.editMessageKeypad(chat_id, state.message_id, inlineKeypad || { rows: [] });
      await saveUiState(db, chat_id, { message_id: state.message_id, menu, ctx, history });
      return { edited: true, message_id: state.message_id };
    } catch {}
  }

  const sent = await client.sendMessage(chat_id, text, { inline_keypad: inlineKeypad, metadata });
  const message_id = sent?.data?.message_id || null;
  await saveUiState(db, chat_id, { message_id, menu, ctx, history: forceNew ? [] : history });
  return { edited: false, message_id };
}

export async function popHistory(db, chat_id) {
  const state = await getUiState(db, chat_id);
  if (!state || !state.history || state.history.length === 0) return null;
  const history = [...state.history];
  const prev = history.pop();
  await saveUiState(db, chat_id, { message_id: state.message_id, menu: prev.menu, ctx: prev.ctx, history });
  return prev;
}
