import { getUiState, upsertUser, upsertGroup, incrementStartCount, logEvent, logError } from "../core/db.js";
import { showMainMenu } from "../menus/main.js";

const RECENT_START_WINDOW_MS = 60 * 1000;

export async function handleStart(event) {
  const { db, client, chatId, isGroup } = event;
  let chatInfo = null;
  try {
    const res = await client.getChat(chatId);
    chatInfo = res?.data?.chat || null;
  } catch (err) {
    await logError(db, "start.getChat", err.message);
  }
  if (isGroup) {
    await upsertGroup(db, { chat_id: chatId, title: chatInfo?.title, username: chatInfo?.username });
    event.chatTitle = chatInfo?.title;
    event.chatUsername = chatInfo?.username;
  } else {
    await upsertUser(db, { chat_id: chatId, first_name: chatInfo?.first_name, last_name: chatInfo?.last_name, username: chatInfo?.username });
    await incrementStartCount(db, chatId);
    event.displayName = [chatInfo?.first_name, chatInfo?.last_name].filter(Boolean).join(" ");
  }
  await logEvent(db, "start", chatId);
  const state = await getUiState(db, chatId);
  const recentActiveMenu = state && Date.now() - (state.updated_at || 0) < RECENT_START_WINDOW_MS;
  await showMainMenu(event, {}, { forceNew: !recentActiveMenu, pushHistory: false });
}
