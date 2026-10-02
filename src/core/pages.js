const pages = new Map();
export function registerPage(menuId, showFn) { pages.set(menuId, showFn); }
export function getPage(menuId) { return pages.get(menuId); }
