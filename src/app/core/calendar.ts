import { daysBetween, daysInMonth, weekDays, weekStart, weekday, yearMonth, ymToDate } from './dates';
import { describeSchedule, entryFor, existsOn, isDueOn, scheduleOn, weeklyCount } from './goals';
import { COLOUR_HEX, DEFAULT_COLOUR, type Goal, type GoalEntry, type LocalDate, type Session } from './model';
import { sessionElapsedSeconds } from './sessions';

/**
 * What one goal's circle shows on one day of the week view.
 *  done     ticked
 *  skipped  dismissed on Today: a neutral dash, never counted
 *  open     on the goal's schedule, nothing ticked yet: an empty ring, never a colour
 *  free     not on the schedule (weekly and untargeted goals never are), still open to a tick
 *  soon     on the schedule, but the day hasn't come
 *  blank    the goal wasn't there: before it started, while paused, once archived
 */
export type CellState = 'done' | 'skipped' | 'open' | 'free' | 'soon' | 'blank';

/** Screen-reader wording for each state. */
export const STATE_WORD: Record<CellState, string> = {
  done: 'done',
  skipped: 'skipped',
  open: 'not done yet',
  free: 'not done',
  soon: 'still to come',
  blank: 'not active',
};

const byOrder = (a: Goal, b: Goal) => a.sortOrder - b.sortOrder || a.createdOn.localeCompare(b.createdOn);

export function cellState(goal: Goal, entries: GoalEntry[], date: LocalDate, today: LocalDate): CellState {
  const entry = entryFor(entries, goal.id, date);
  if (entry?.kind === 'done') return 'done';
  if (entry?.kind === 'skip') return 'skipped';
  if (goal.state === 'archived' || !existsOn(goal, date)) return 'blank';
  const planned = isDueOn(goal, date);
  if (date > today) return planned ? 'soon' : 'blank';
  return planned ? 'open' : 'free';
}

/** Any day up to today that the goal was active can be ticked or cleared. Archived goals are read-only. */
export function canMark(goal: Goal, date: LocalDate, today: LocalDate): boolean {
  return date <= today && existsOn(goal, date) && goal.state !== 'archived';
}

/**
 * The goals with a row in a week: the ones that were active on some day of it,
 * plus any with something ticked in it. An archived goal only shows in the weeks
 * where it has ticks. Long goals live on the Goals tab.
 */
export function goalsInWeek(goals: Goal[], entries: GoalEntry[], ws: LocalDate): Goal[] {
  const days = weekDays(ws);
  const ticked = (g: Goal) => days.some((d) => entryFor(entries, g.id, d));
  const active = (g: Goal) => g.state !== 'archived' && days.some((d) => existsOn(g, d));
  return goals.filter((g) => g.shape !== 'long' && (ticked(g) || active(g))).sort(byOrder);
}

function parentName(goal: Goal, goals: Goal[]): string | null {
  const parent = goal.parentId ? goals.find((g) => g.id === goal.parentId) : undefined;
  return parent?.name ?? null;
}

/** "2 this week · 3 times a week". Past weeks say "that week" and keep the target they had. */
function weeklyLine(goal: Goal, entries: GoalEntry[], ws: LocalDate, today: LocalDate): string {
  const when = ws === weekStart(today) ? 'this week' : 'that week';
  return `${weeklyCount(entries, goal.id, ws)} ${when} · ${describeSchedule(goal, scheduleOn(goal, ws))}`;
}

/** The line under a goal's name in the week view: a weekly goal's count so far, else the long goal it belongs to. */
export function weekRowMeta(goal: Goal, goals: Goal[], entries: GoalEntry[], ws: LocalDate, today: LocalDate): string {
  if (goal.shape === 'weekly') return weeklyLine(goal, entries, ws, today);
  return parentName(goal, goals) ?? '';
}

export type DayRowState = 'done' | 'skipped' | 'open';

export interface DayRow {
  goal: Goal;
  state: DayRowState;
  /** False when the goal is read-only (archived) or the tick sits outside the days it was active. */
  editable: boolean;
}

/**
 * The goals listed for one day under the month grid: what Today would have shown
 * that day (scheduled goals on their days, weekly and untargeted goals, anything
 * ticked). Scheduled goals with nothing planned that day come apart, as `other`.
 */
export function dayRows(goals: Goal[], entries: GoalEntry[], date: LocalDate, today: LocalDate): { main: DayRow[]; other: DayRow[] } {
  const main: DayRow[] = [];
  const other: DayRow[] = [];
  for (const goal of [...goals].sort(byOrder)) {
    if (goal.shape === 'long') continue;
    const cell = cellState(goal, entries, date, today);
    if (cell === 'blank' || cell === 'soon') continue;
    const editable = canMark(goal, date, today);
    if (cell === 'free' && goal.shape === 'scheduled') other.push({ goal, state: 'open', editable });
    else main.push({ goal, state: cell === 'free' ? 'open' : cell, editable });
  }
  return { main, other };
}

/** "Ginásio A · 52 min" for the session that ticked an exercise goal that day, "2 sessions" when there were several. */
export function sessionNote(goal: Goal, sessions: Session[], date: LocalDate): string | null {
  const done = sessions.filter((s) => s.goalId === goal.id && s.date === date && s.endedAt !== null);
  if (done.length === 0) return null;
  if (done.length > 1) return `${done.length} sessions`;
  const minutes = Math.max(1, Math.round(sessionElapsedSeconds(done[0], Date.now()) / 60));
  return `${done[0].workoutName} · ${minutes} min`;
}

/** The line under a goal's name in the day list. */
export function dayMeta(row: DayRow, goals: Goal[], entries: GoalEntry[], sessions: Session[], date: LocalDate, today: LocalDate): string {
  const { goal, state } = row;
  if (state === 'skipped') return 'Skipped';
  if (goal.shape === 'weekly') return weeklyLine(goal, entries, weekStart(date), today);
  if (state === 'done' && goal.isExercise) {
    const note = sessionNote(goal, sessions, date);
    if (note) return note;
  }
  return parentName(goal, goals) ?? (goal.shape === 'log' ? 'Whenever' : describeSchedule(goal, scheduleOn(goal, date)));
}

/** One colour per goal ticked on each day from `from` to `to`, in goal order. These are the dots in the month grid. */
export function doneDots(goals: Goal[], entries: GoalEntry[], from: LocalDate, to: LocalDate): Map<LocalDate, string[]> {
  const ranked = new Map(
    goals
      .filter((g) => g.shape !== 'long')
      .sort(byOrder)
      .map((g, i) => [g.id, { i, hex: COLOUR_HEX[g.colour ?? DEFAULT_COLOUR] }] as const),
  );
  const byDay = new Map<LocalDate, { i: number; hex: string }[]>();
  for (const e of entries) {
    const goal = ranked.get(e.goalId);
    if (e.kind !== 'done' || e.date < from || e.date > to || !goal) continue;
    byDay.set(e.date, [...(byDay.get(e.date) ?? []), goal]);
  }
  const out = new Map<LocalDate, string[]>();
  for (const [date, list] of byDay) out.set(date, list.sort((a, b) => a.i - b.i).map((g) => g.hex));
  return out;
}

export type MonthDayState = 'today' | 'past' | 'future' | 'before';

export interface MonthDay {
  date: LocalDate;
  day: number;
  state: MonthDayState;
  /** How many goals were ticked that day. */
  done: number;
  /** One colour per goal ticked, as many as fit. */
  dots: string[];
  /** Days still to come, and days before the first goal existed, can't be picked. */
  disabled: boolean;
}

/** As many dots as fit under a date. */
const MAX_DOTS = 6;

/** The month as rows of seven, Monday first. The cells around the month are null. */
export function monthWeeks(goals: Goal[], entries: GoalEntry[], year: number, month: number, today: LocalDate, first: LocalDate): (MonthDay | null)[][] {
  const start = ymToDate(year, month);
  const n = daysInMonth(year, month);
  const dots = doneDots(goals, entries, start, ymToDate(year, month, n));
  const cells: (MonthDay | null)[] = Array.from({ length: weekday(start) - 1 }, () => null);
  for (let day = 1; day <= n; day++) {
    const date = ymToDate(year, month, day);
    const state: MonthDayState = date === today ? 'today' : date > today ? 'future' : date < first ? 'before' : 'past';
    const colours = dots.get(date) ?? [];
    cells.push({ date, day, state, done: colours.length, dots: colours.slice(0, MAX_DOTS), disabled: date > today || date < first });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
}

/** The earliest day any goal exists, or null with no goals yet. */
export function firstDate(goals: Goal[]): LocalDate | null {
  return goals
    .filter((g) => g.shape !== 'long')
    .reduce<LocalDate | null>((acc, g) => (acc === null || g.createdOn < acc ? g.createdOn : acc), null);
}

/** The day to show when a month opens: the picked day if it falls in that month, else the latest day of it that has happened. */
export function dayInMonth(year: number, month: number, picked: LocalDate | null, today: LocalDate): LocalDate {
  const first = ymToDate(year, month);
  const last = ymToDate(year, month, daysInMonth(year, month));
  if (picked && picked >= first && picked <= last && picked <= today) return picked;
  return last > today ? today : last;
}

/** "This week", "Last week", "3 weeks ago". */
export function weekAgo(ws: LocalDate, today: LocalDate): string {
  const n = Math.round(daysBetween(ws, weekStart(today)) / 7);
  return n <= 0 ? 'This week' : n === 1 ? 'Last week' : `${n} weeks ago`;
}

/** "This month", "Last month", "4 months ago". */
export function monthAgo(year: number, month: number, today: LocalDate): string {
  const now = yearMonth(today);
  const n = (now.year - year) * 12 + (now.month - month);
  return n <= 0 ? 'This month' : n === 1 ? 'Last month' : `${n} months ago`;
}
