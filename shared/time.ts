// Demo timestamps are practice-local wall-clock times stored as
// "YYYY-MM-DDTHH:MM:SS" with no zone. Internally they are handled as UTC
// milliseconds, so no time zone or daylight-saving rules ever apply.

export const SECOND = 1000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function toMs(iso: string): number {
  const s = iso.length === 10 ? `${iso}T00:00:00` : iso;
  const ms = Date.parse(`${s}Z`);
  if (Number.isNaN(ms)) throw new Error(`Bad timestamp: ${iso}`);
  return ms;
}

export function toIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 19);
}

export function dateOf(iso: string): string {
  return iso.slice(0, 10);
}

export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

export function inMonth(iso: string | null | undefined, month: string): boolean {
  return !!iso && iso.startsWith(month);
}

export function addDays(date: string, n: number): string {
  return toIso(toMs(dateOf(date)) + n * DAY).slice(0, 10);
}

export function weekday(date: string): number {
  return new Date(toMs(dateOf(date))).getUTCDay();
}

export function isBusinessDay(date: string): boolean {
  const d = weekday(date);
  return d !== 0 && d !== 6;
}

/** The date n business days after `date` (Mon–Fri; no holiday calendar). */
export function addBusinessDays(date: string, n: number): string {
  let d = dateOf(date);
  let left = n;
  while (left > 0) {
    d = addDays(d, 1);
    if (isBusinessDay(d)) left -= 1;
  }
  return d;
}

export function nextBusinessDay(date: string): string {
  return addBusinessDays(date, 1);
}

/** "14 Aug 2025" */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(toMs(iso));
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "13 Oct" */
export function fmtShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(toMs(iso));
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "Tue 13 Oct" */
export function fmtDay(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(toMs(iso));
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "10:31" */
export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return iso.slice(11, 16);
}

/** "13 Oct 10:31" */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return `${fmtShort(iso)} ${fmtTime(iso)}`;
}

/** "13 Oct 2026 10:31" */
export function fmtDateTimeLong(iso: string | null | undefined): string {
  if (!iso) return '—';
  return `${fmtDate(iso)} ${fmtTime(iso)}`;
}

/** "October 2026" */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS_LONG[m - 1]} ${y}`;
}

/** Seconds as m:ss (or h:mm:ss). */
export function fmtDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const ss = String(r).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Whole minutes, floored. Billing rules always use this. */
export function floorMinutes(seconds: number): number {
  return Math.floor(seconds / 60);
}

export function ageOn(dob: string, on: string): number {
  const [by, bm, bd] = dob.split('-').map(Number);
  const [y, m, d] = dateOf(on).split('-').map(Number);
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age -= 1;
  return age;
}

/** Months between two dates, used for the 12-month visit rule. */
export function isWithinMonths(earlier: string, later: string, months: number): boolean {
  const [ly, lm, ld] = dateOf(later).split('-').map(Number);
  const cutoff = new Date(Date.UTC(ly, lm - 1 - months, ld));
  return toMs(dateOf(earlier)) >= cutoff.getTime();
}

export function lastDayOfMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return toIso(Date.UTC(y, m, 0)).slice(0, 10);
}
