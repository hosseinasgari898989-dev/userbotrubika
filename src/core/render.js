import { formatText } from "../rubika/format.js";
import { getUiState, saveUiState, logError } from "./db.js";

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
  const message_id = extractMessageId(sent);
  if (!message_id) {
    await logError(db, "render.missingMessageId", JSON.stringify({
      status: typeof sent?.status === "string" ? sent.status : null,
      responseKeys: sent && typeof sent === "object" ? Object.keys(sent).slice(0, 12) : [],
      dataKeys: sent?.data && typeof sent.data === "object" ? Object.keys(sent.data).slice(0, 12) : []
    }));
  }
  await saveUiState(db, chat_id, { message_id, menu, ctx, history: forceNew ? [] : history });
  return { edited: false, message_id };
}

function extractMessageId(response) {
  const candidates = [
    response?.data?.message_id,
    response?.message_id,
    response?.data?.message?.message_id,
    response?.message?.message_id,
    response?.result?.message_id,
    response?.result?.data?.message_id,
    response?.data?.messageId,
    response?.messageId
  ];
  for (const value of candidates) {
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return String(value);
    }
  }
  return null;
}

export async function popHistory(db, chat_id) {
  const state = await getUiState(db, chat_id);
  if (!state || !state.history || state.history.length === 0) return null;
  const history = [...state.history];
  const prev = history.pop();
  await saveUiState(db, chat_id, { message_id: state.message_id, menu: prev.menu, ctx: prev.ctx, history });
  return prev;
}
