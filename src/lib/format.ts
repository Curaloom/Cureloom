/** "$66.13", or "—" when there is no amount. */
export function money(n: number | null | undefined): string {
  return n == null ? '—' : `$${n.toFixed(2)}`;
}

/** Two-letter initials: "Rachel Okafor, RN" → "RO", "Dr. Anita Patel" → "AP". */
export function initials(name: string): string {
  const words = name
    .split(',')[0]
    .split(/\s+/)
    .filter((w) => w && !w.endsWith('.'));
  if (!words.length) return '';
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return `${first}${last}`.toUpperCase();
}
