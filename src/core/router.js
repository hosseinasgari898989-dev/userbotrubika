export class CallbackRouter {
  constructor() {
    this.exact = new Map();
    this.prefixed = [];
  }
  on(buttonId, handler) { this.exact.set(buttonId, handler); return this; }
  onPrefix(prefix, handler) { this.prefixed.push([prefix, handler]); return this; }
  async dispatch(buttonId, event) {
    if (!buttonId) return false;
    if (this.exact.has(buttonId)) { await this.exact.get(buttonId)(event, null); return true; }
    for (const [prefix, handler] of this.prefixed) {
      if (buttonId.startsWith(prefix)) { await handler(event, buttonId.slice(prefix.length)); return true; }
    }
    return false;
  }
}
