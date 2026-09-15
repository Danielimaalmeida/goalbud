import type { LocalDate, Weekday } from './model';

const pad = (n: number) => String(n).padStart(2, '0');

export function toLocalDate(d: Date): LocalDate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayLocal(now: Date = new Date()): LocalDate {
  return toLocalDate(now);
}

export function parseLocalDate(s: LocalDate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function utcDays(s: LocalDate): number {
  const [y, m, d] = s.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

export function addDays(s: LocalDate, n: number): LocalDate {
  const [y, m, d] = s.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** Whole days from a to b (positive when b is later). DST-safe. */
export function daysBetween(a: LocalDate, b: LocalDate): number {
  return utcDays(b) - utcDays(a);
}

/** 1 = Monday … 7 = Sunday. */
export function weekday(s: LocalDate): Weekday {
  const [y, m, d] = s.split('-').map(Number);
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return (js === 0 ? 7 : js) as Weekday;
}

/** The Monday of the week containing s. */
export function weekStart(s: LocalDate): LocalDate {
  return addDays(s, 1 - weekday(s));
}

export function monthStart(s: LocalDate): LocalDate {
  return s.slice(0, 8) + '01';
}

export function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

export function yearMonth(s: LocalDate): { year: number; month: number } {
  const [y, m] = s.split('-').map(Number);
  return { year: y, month: m };
}

export function ymToDate(year: number, month1: number, day = 1): LocalDate {
  return `${year}-${pad(month1)}-${pad(day)}`;
}

export function addMonths(year: number, month1: number, n: number): { year: number; month: number } {
  const idx = year * 12 + (month1 - 1) + n;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** "Tuesday 15 September" */
export function formatLong(s: LocalDate): string {
  const [, m, d] = s.split('-').map(Number);
  return `${DAY_NAMES[weekday(s) - 1]} ${d} ${MONTH_NAMES[m - 1]}`;
}

/** "Fri 11 Sep" */
export function formatShort(s: LocalDate): string {
  const [, m, d] = s.split('-').map(Number);
  return `${DAY_NAMES[weekday(s) - 1].slice(0, 3)} ${d} ${MONTH_NAMES[m - 1].slice(0, 3)}`;
}

/** "4 May" or "4 May 2025" when not this year. */
export function formatDayMonth(s: LocalDate, today: LocalDate): string {
  const [y, m, d] = s.split('-').map(Number);
  const base = `${d} ${MONTH_NAMES[m - 1]}`;
  return y === Number(today.slice(0, 4)) ? base : `${base} ${y}`;
}

/** "September 2026" */
export function formatMonthYear(year: number, month1: number): string {
  return `${MONTH_NAMES[month1 - 1]} ${year}`;
}

/** "8:12" from an ISO timestamp, in device local time. */
export function formatClock(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours()}:${pad(d.getMinutes())}`;
}

/** "24:07" or "1:02:33" from seconds. */
export function formatElapsed(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

export const WEEKDAY_LETTERS: Record<Weekday, string> = { 1: 'M', 2: 'T', 3: 'W', 4: 'T', 5: 'F', 6: 'S', 7: 'S' };
export const WEEKDAY_SHORT: Record<Weekday, string> = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 7: 'Sun' };

/** "Morning" / "Afternoon" / "Evening" for the Today greeting. */
export function partOfDay(now: Date = new Date()): string {
  const h = now.getHours();
  if (h < 12) return 'Morning';
  if (h < 18) return 'Afternoon';
  return 'Evening';
}

/** Milliseconds until the next local midnight. */
export function msUntilMidnight(now: Date = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 50);
  return next.getTime() - now.getTime();
}
