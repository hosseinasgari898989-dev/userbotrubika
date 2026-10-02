export function row(...buttons) { return { buttons }; }
export function inlineKeypad(...rows) { return { rows }; }
export function chatKeypad(rows, { resize_keyboard = true, on_time_keyboard = false } = {}) { return { rows, resize_keyboard, on_time_keyboard }; }
export function btnSimple(id, text) { return { id, type: "Simple", button_text: text }; }
export function btnUrl(id, text, url) { return { id, type: "Link", button_text: text, button_link: { type: "url", link_url: url } }; }
export function btnJoinChannel(id, text, username, ask_join = false) { return { id, type: "Link", button_text: text, button_link: { type: "joinchannel", joinchannel_data: { username: String(username).replace("@", ""), ask_join } } }; }
export function btnOpenChat(id, text, object_guid, object_type = "User") { return { id, type: "Link", button_text: text, button_link: { type: "openchat", open_chat_data: { object_guid, object_type } } }; }
export function btnCalendar(id, title, type_ = "DatePersian", opts = {}) { const button_calendar = { title, type: type_ }; if (opts.default_value) button_calendar.default_value = opts.default_value; if (opts.min_year) button_calendar.min_year = opts.min_year; if (opts.max_year) button_calendar.max_year = opts.max_year; return { id, type: "Calendar", button_text: title, button_calendar }; }
export function btnNumberPicker(id, title, min_value, max_value, default_value) { const button_number_picker = { title, min_value: String(min_value), max_value: String(max_value) }; if (default_value !== undefined) button_number_picker.default_value = String(default_value); return { id, type: "NumberPicker", button_text: title, button_number_picker }; }
export function btnStringPicker(id, title, items, default_value) { const button_string_picker = { title, items }; if (default_value !== undefined) button_string_picker.default_value = default_value; return { id, type: "StringPicker", button_text: title, button_string_picker }; }
export function btnTextbox(id, title, opts = {}) { const button_textbox = { type_line: opts.type_line || "SingleLine", type_keypad: opts.type_keypad || "String", place_holder: opts.place_holder || "", title, default_value: opts.default_value || "" }; return { id, type: "Textbox", button_text: title, button_textbox }; }
export function btnSelection(id, text, selection) { return { id, type: "Selection", button_text: text, button_selection: selection }; }
export function btnLocation(id, title, opts = {}) { const button_location = { title, type: opts.type || "Picker" }; if (opts.default_pointer_location) button_location.default_pointer_location = opts.default_pointer_location; return { id, type: "Location", button_text: title, button_location }; }
export function btnBarcode(id, title) { return { id, type: "Barcode", button_text: title }; }
export function chunkButtons(buttons, perRow = 2) { const rows = []; for (let i = 0; i < buttons.length; i += perRow) rows.push(row(...buttons.slice(i, i + perRow))); return rows; }
