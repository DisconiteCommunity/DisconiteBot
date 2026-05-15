/** Discord string autocomplete: name and value each ≤100 characters, max 25 choices. */
export function toDiscordStringAutocompleteChoices(
  values: readonly string[],
): { name: string; value: string }[] {
  const MAX = 100;
  const out: { name: string; value: string }[] = [];
  for (const raw of values.slice(0, 25)) {
    const value = raw.length > MAX ? raw.slice(0, MAX) : raw;
    const name =
      raw.length > MAX ? `${value.slice(0, MAX - 1)}…` : value;
    out.push({ name, value });
  }
  return out;
}
