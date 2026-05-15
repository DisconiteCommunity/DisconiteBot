/** Truncate for Discord embed limits (description, field value, etc.). */
export function truncateEllipsis(text: string, maxLen: number): string {
  if (text.length <= maxLen) {
    return text;
  }
  if (maxLen <= 1) {
    return "…";
  }
  return `${text.slice(0, maxLen - 1)}…`;
}
