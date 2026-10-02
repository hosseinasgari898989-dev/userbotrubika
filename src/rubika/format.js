const PATTERN = /```([\s\S]*?)```|\*\*(.*?)\*\*|`([^`]*?)`|__(.*?)__|--(.*?)--|~~(.*?)~~|\|\|(.*?)\|\||\[(.*?)\]\((\S+?)\)/g;
export function formatText(src) {
  if (!src) return { text: "" };
  let result = ""; let lastIndex = 0; const parts = []; let m;
  PATTERN.lastIndex = 0;
  while ((m = PATTERN.exec(src)) !== null) {
    result += src.slice(lastIndex, m.index); const from_index = result.length;
    let type, inner;
    if (m[1] !== undefined) { type = "Pre"; inner = m[1]; }
    else if (m[2] !== undefined) { type = "Bold"; inner = m[2]; }
    else if (m[3] !== undefined) { type = "Mono"; inner = m[3]; }
    else if (m[4] !== undefined) { type = "Italic"; inner = m[4]; }
    else if (m[5] !== undefined) { type = "Underline"; inner = m[5]; }
    else if (m[6] !== undefined) { type = "Strike"; inner = m[6]; }
    else if (m[7] !== undefined) { type = "Spoiler"; inner = m[7]; }
    else if (m[8] !== undefined) { type = "Link"; inner = m[8]; }
    if (type === "Link") { const url = m[9]; result += inner; parts.push({ type: "Link", from_index, length: inner.length, link_url: url }); }
    else { result += inner; parts.push({ type, from_index, length: inner.length }); }
    lastIndex = PATTERN.lastIndex;
  }
  result += src.slice(lastIndex);
  if (parts.length === 0) return { text: result };
  return { text: result, metadata: { meta_data_parts: parts } };
}
export const bold = (s) => `**${s}**`;
export const italic = (s) => `__${s}__`;
export const underline = (s) => `--${s}--`;
export const strike = (s) => `~~${s}~~`;
export const mono = (s) => `\`${s}\``;
export const spoiler = (s) => `||${s}||`;
export const link = (text, url) => `[${text}](${url})`;
