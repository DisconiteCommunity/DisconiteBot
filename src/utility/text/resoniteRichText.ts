/**
 * Resonite in-game rich text uses HTML-like tags (<b>, <color>, …).
 * Discord messages do not support colors, fonts, sprites, etc.; only a small
 * subset maps to Discord markdown. See:
 * https://wiki.resonite.com/Text_formatting
 */

const PLACEHOLDER_START = "\uE000";
const PLACEHOLDER_END = "\uE001";

type NoparseState = { map: Map<string, string> };

/** Remove Resonite rich-text tags from API/session strings; plain text only (no Discord ** markers). */
export function stripResoniteRichText(input: string): string {
  const state: NoparseState = { map: new Map() };
  let s = extractNoparseBlocks(input, state);

  s = s.replace(/<\s*br\s*\/?>/gi, "\n");
  s = s.replace(/<\s*\/?\s*closeall(block)?\s*>/gi, "");

  for (let pass = 0; pass < 32; pass++) {
    const next = unwrapLeafRichTagPlain(s);
    if (next === s) {
      break;
    }
    s = next;
  }

  s = s.replace(/<[^>\n]+>/g, "");
  s = restoreNoparseBlocks(s, state);
  return s.replace(/\r\n/g, "\n");
}

/**
 * Convert simple Resonite tags to Discord markdown where possible, then strip
 * any remaining angle-bracket markup (colors, sprites, align, …).
 */
export function resoniteRichTextToDiscordPlain(input: string): string {
  const state: NoparseState = { map: new Map() };
  let s = extractNoparseBlocks(input, state);

  s = s.replace(/<\s*br\s*\/?>/gi, "\n");
  s = s.replace(/<\s*\/?\s*closeall(block)?\s*>/gi, "");

  for (let pass = 0; pass < 32; pass++) {
    const next = unwrapLeafRichTag(s);
    if (next === s) {
      break;
    }
    s = next;
  }

  s = s.replace(/<[^>\n]+>/g, "");
  s = restoreNoparseBlocks(s, state);
  return s.replace(/\r\n/g, "\n");
}

function unwrapLeafRichTagPlain(s: string): string {
  return s.replace(
    /<\s*([bius])\b[^>]*>([^<]*)<\/\s*\1\s*>/gi,
    (_full, _tag: string, inner: string) => String(inner),
  );
}

function unwrapLeafRichTag(s: string): string {
  return s.replace(
    /<\s*([bius])\b[^>]*>([^<]*)<\/\s*\1\s*>/gi,
    (_full, tag: string, inner: string) => {
      const t = String(tag).toLowerCase();
      if (t === "b") {
        return `**${inner}**`;
      }
      if (t === "i") {
        return `*${inner}*`;
      }
      if (t === "u") {
        return `__${inner}__`;
      }
      if (t === "s") {
        return `~~${inner}~~`;
      }
      return inner;
    },
  );
}

function extractNoparseBlocks(input: string, state: NoparseState): string {
  let n = 0;
  return input.replace(/<\s*noparse[^>]*>([\s\S]*?)<\/\s*noparse\s*>/gi, (_m, inner: string) => {
    const key = `${PLACEHOLDER_START}N${n++}${PLACEHOLDER_END}`;
    state.map.set(key, String(inner));
    return key;
  });
}

function restoreNoparseBlocks(s: string, state: NoparseState): string {
  let out = s;
  for (const [key, val] of state.map) {
    out = out.split(key).join(val);
  }
  state.map.clear();
  return out;
}
