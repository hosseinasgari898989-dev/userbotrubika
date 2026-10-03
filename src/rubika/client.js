const API_BASE = "https://botapi.rubika.ir/v3";

export class RubikaClient {
  constructor(token) {
    if (!token) throw new Error("RubikaClient: توکن ربات ارائه نشده است");
    this.token = token;
  }

  async _post(method, payload = {}) {
    const url = API_BASE + "/" + this.token + "/" + method;
    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (networkErr) {
      throw new RubikaApiError(method, 0, "network error: " + networkErr.message);
    }

    const contentType = res.headers.get("content-type") || "unknown";

    let rawText;
    try {
      rawText = await res.text();
    } catch (readErr) {
      throw new RubikaApiError(
        method,
        res.status,
        "failed to read response body: " + readErr.message,
        contentType
      );
    }

    let json;
    try {
      json = JSON.parse(rawText);
    } catch {
      const safeSnippet = rawText
        .replace(new RegExp(this.token, "g"), "[REDACTED_TOKEN]")
        .slice(0, 300);
      throw new RubikaApiError(
        method,
        res.status,
        "non-JSON response (content-type: " + contentType + "): " + safeSnippet,
        contentType
      );
    }

    if (!res.ok || json?.status === "ERROR" || json?.status_det === "ERROR") {
      throw new RubikaApiError(method, res.status, JSON.stringify(json), contentType);
    }

    return json;
  }

  getMe() { return this._post("getMe", {}); }
  getChat(chat_id) { return this._post("getChat", { chat_id }); }

  sendMessage(chat_id, text, opts = {}) {
    const payload = { chat_id, text, disable_notification: !!opts.disable_notification };
    if (opts.chat_keypad) payload.chat_keypad = opts.chat_keypad;
    if (opts.inline_keypad) payload.inline_keypad = opts.inline_keypad;
    if (opts.reply_to_message_id) payload.reply_to_message_id = opts.reply_to_message_id;
    if (opts.chat_keypad_type) payload.chat_keypad_type = opts.chat_keypad_type;
    if (opts.metadata) payload.metadata = opts.metadata;
    return this._post("sendMessage", payload);
  }

  editMessageText(chat_id, message_id, text, metadata) {
    const payload = { chat_id, message_id, text };
    if (metadata) payload.metadata = metadata;
    return this._post("editMessageText", payload);
  }

  editMessageKeypad(chat_id, message_id, inline_keypad) {
    return this._post("editMessageKeypad", { chat_id, message_id, inline_keypad });
  }

  deleteMessage(chat_id, message_id) {
    return this._post("deleteMessage", { chat_id, message_id });
  }

  forwardMessage(from_chat_id, message_id, to_chat_id, disable_notification = false) {
    return this._post("forwardMessage", {
      from_chat_id,
      message_id,
      to_chat_id,
      disable_notification,
    });
  }

  editChatKeypad(chat_id, chat_keypad) {
    return this._post("editChatKeypad", { chat_id, chat_keypad_type: "New", chat_keypad });
  }

  removeChatKeypad(chat_id) {
    return this._post("editChatKeypad", { chat_id, chat_keypad_type: "Removed" });
  }

  sendPoll(chat_id, question, options) {
    return this._post("sendPoll", { chat_id, question, options });
  }

  sendLocation(chat_id, latitude, longitude, opts = {}) {
    const payload = { chat_id, latitude, longitude, disable_notification: !!opts.disable_notification };
    if (opts.inline_keypad) payload.inline_keypad = opts.inline_keypad;
    if (opts.reply_to_message_id) payload.reply_to_message_id = opts.reply_to_message_id;
    return this._post("sendLocation", payload);
  }

  sendContact(chat_id, first_name, last_name, phone_number) {
    return this._post("sendContact", { chat_id, first_name, last_name, phone_number });
  }

  getFile(file_id) {
    return this._post("getFile", { file_id });
  }

  setCommands(bot_commands) {
    return this._post("setCommands", { bot_commands });
  }

  updateBotEndpoint(url, type) {
    return this._post("updateBotEndpoints", { url, type });
  }
}

export class RubikaApiError extends Error {
  constructor(method, status, detail, contentType = "unknown") {
    super(
      "Rubika API error [" + method + "] status=" + status +
      " content-type=" + contentType + ": " + detail
    );
    this.name = "RubikaApiError";
    this.method = method;
    this.status = status;
    this.detail = detail;
    this.contentType = contentType;
  }
}
