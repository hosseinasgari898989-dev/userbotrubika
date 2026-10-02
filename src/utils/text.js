import { mono } from "../rubika/format.js";
export function fullName(row) { const f = row?.first_name || ""; const l = row?.last_name || ""; const name = `${f} ${l}`.trim(); return name || "—"; }
export function orDash(v) { return v === undefined || v === null || v === "" ? "—" : String(v); }
export function idField(label, value) { return `${label}: ${mono(orDash(value))}`; }
export function fmtDateFa(ms) { if (!ms) return "—"; try { return new Date(ms).toLocaleString("fa-IR", { timeZone: "Asia/Tehran" }); } catch { return new Date(ms).toISOString(); } }
export function fmtDuration(ms) { const totalMin = Math.floor(ms / 60000); const h = Math.floor(totalMin / 60); const m = totalMin % 60; if (h > 0) return `${h} ساعت و ${m} دقیقه`; return `${m} دقیقه`; }
export function separator() { return "──────────────"; }
export function breadcrumb(path) { return path.join(" ‹ "); }
