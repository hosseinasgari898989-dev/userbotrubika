import { formatText } from "../src/rubika/format.js";
import { CallbackRouter } from "../src/core/router.js";
import { chatTypeFromId, isOwner, isValidUpdate } from "../src/core/security.js";
import { fmtDuration } from "../src/utils/text.js";
import { row, inlineKeypad, btnSimple } from "../src/rubika/keypad.js";

let pass = 0;
let fail = 0;
function assert(cond, msg) {
  if (cond) pass++;
  else { fail++; console.error(`❌ FAIL: ${msg}`); }
}
function assertEqual(actual, expected, msg) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) pass++;
  else { fail++; console.error(`❌ FAIL: ${msg}\nexpected: ${JSON.stringify(expected)}\nactual: ${JSON.stringify(actual)}`); }
}

const boldResult = formatText("**سلام** دنیا");
assertEqual(boldResult.text, "سلام دنیا", "formatText bold text");
assertEqual(boldResult.metadata.meta_data_parts[0], { type:"Bold", from_index:0, length:4 }, "formatText bold metadata");

const monoResult = formatText("متن `آیدی123` بعد");
assert(monoResult.metadata.meta_data_parts.some(p => p.type === "Mono"), "formatText Mono");

assert(!formatText("plain").metadata, "plain text has no metadata");
assertEqual(chatTypeFromId("b1234"), "user", "user chat id");
assertEqual(chatTypeFromId("g5678"), "group", "group chat id");
assertEqual(chatTypeFromId("c9999"), "channel", "channel chat id");
assert(isOwner({ OWNER_ID:"b111" }, "b111"), "owner matches");
assert(!isOwner({ OWNER_ID:"b111" }, "b222"), "owner rejects");
assert(!isOwner({}, "b111"), "owner unset");

assert(isValidUpdate({ type:"NewMessage", chat_id:"b1" }), "valid NewMessage");
assert(!isValidUpdate({ type:"NewMessage" }), "invalid NewMessage");
assert(isValidUpdate({ type:"ReceiveQuery", inline_message:{} }), "valid ReceiveQuery");
assert(!isValidUpdate({}), "empty invalid");
assert(!isValidUpdate(null), "null invalid");

assertEqual(fmtDuration(5*60*1000), "5 دقیقه", "duration minutes");
assertEqual(fmtDuration(2*60*60*1000 + 30*60*1000), "2 ساعت و 30 دقیقه", "duration hours");

const kp = inlineKeypad(row(btnSimple("x","متن")));
assertEqual(kp, { rows:[{ buttons:[{ id:"x", type:"Simple", button_text:"متن" }] }] }, "simple keypad");

const router = new CallbackRouter();
let called = null;
router.on("nav.home", e => { called = e.marker; });
assert(await router.dispatch("nav.home", { marker:"ok" }), "router exact");
assertEqual(called, "ok", "router handler");
router.onPrefix("settings.lang.", (e, arg) => { called = arg; });
assert(await router.dispatch("settings.lang.fa", {}), "router prefix");
assertEqual(called, "fa", "router prefix argument");
assert(!(await router.dispatch("does.not.exist", {})), "unknown callback");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
