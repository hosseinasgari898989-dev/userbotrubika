import { popHistory } from "./render.js";
import { getPage } from "./pages.js";
import { MENU } from "../config.js";

export function registerBack(router) {
  router.on("nav.back", async (event) => {
    const prev = await popHistory(event.db, event.chatId);
    const menu = prev?.menu || MENU.MAIN;
    const ctx = prev?.ctx || {};
    const pageFn = getPage(menu) || getPage(MENU.MAIN);
    await pageFn(event, ctx);
  });
}
