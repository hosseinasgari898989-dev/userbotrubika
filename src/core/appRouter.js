import { CallbackRouter } from "./router.js";
import { registerBack } from "./back.js";
import * as mainMenu from "../menus/main.js";
import * as userInfo from "../menus/userInfo.js";
import * as groupInfo from "../menus/groupInfo.js";
import * as tools from "../menus/tools.js";
import * as settings from "../menus/settings.js";
import * as help from "../menus/help.js";
import * as admin from "../menus/admin.js";

let cachedRouter = null;
export function buildRouter() {
  if (cachedRouter) return cachedRouter;
  const router = new CallbackRouter();
  mainMenu.register(router);
  userInfo.register(router);
  groupInfo.register(router);
  tools.register(router);
  settings.register(router);
  help.register(router);
  admin.register(router);
  registerBack(router);
  cachedRouter = router;
  return router;
}
