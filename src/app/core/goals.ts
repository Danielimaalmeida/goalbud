import { addDays, daysBetween, weekStart, weekday, WEEKDAY_SHORT, yearMonth } from './dates';
import type { Goal, GoalEntry, LocalDate, Recurrence, ScheduleVersion, Weekday } from './model';

/** The schedule version in force for the week containing `date`. */
export function scheduleOn(goal: Goal, date: LocalDate): ScheduleVersion | null {
  const ws = weekStart(date);
  let best: ScheduleVersion | null = null;
  for (const v of goal.schedule) {
    if (v.from <= ws && (!best || v.from > best.from)) best = v;
  }
  // A goal created mid-week has its first version dated that week's Monday,
  // so this only falls through for dates before the goal existed.
  return best ?? (goal.schedule.length ? [...goal.schedule].sort((a, b) => (a.from < b.from ? -1 : 1))[0] : null);
}

/** Latest version, i.e. what the editor shows. */
export function currentSchedule(goal: Goal): ScheduleVersion | null {
  return goal.schedule.reduce<ScheduleVersion | null>((acc, v) => (!acc || v.from > acc.from ? v : acc), null);
}

export function isPausedOn(goal: Goal, date: LocalDate): boolean {
  return goal.pauses.some((p) => p.from <= date && (p.to === null || date < p.to));
}

/** Paused days and days before creation (or after archiving) render blank. */
export function existsOn(goal: Goal, date: LocalDate): boolean {
  if (date < goal.createdOn) return false;
  if (goal.archivedOn && date > goal.archivedOn) return false;
  return !isPausedOn(goal, date);
}

/** Exercise goals a workout session on `date` could count for: active, not paused, already created. */
export function exerciseGoalsOn(goals: Goal[], date: LocalDate): Goal[] {
  return goals
    .filter((g) => g.isExercise && g.state === 'active' && !isPausedOn(g, date) && g.createdOn <= date)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdOn.localeCompare(b.createdOn));
}

export function recurrenceDue(rec: Recurrence, date: LocalDate): boolean {
  switch (rec.kind) {
    case 'daily':
      return true;
    case 'everyN': {
      const diff = daysBetween(rec.anchor, date);
      return diff >= 0 && diff % Math.max(1, rec.n) === 0;
    }
    case 'weekdays':
      return rec.days.includes(weekday(date));
  }
}

/** Scheduled goals only: is the goal due on this date (ignoring pause/state)? */
export function isDueOn(goal: Goal, date: LocalDate): boolean {
  if (goal.shape !== 'scheduled') return false;
  const v = scheduleOn(goal, date);
  return v?.recurrence ? recurrenceDue(v.recurrence, date) : false;
}

export function entryFor(entries: GoalEntry[], goalId: string, date: LocalDate): GoalEntry | undefined {
  return entries.find((e) => e.goalId === goalId && e.date === date);
}

/** Done ticks in the Monday-start week containing `date`. At most one per day by construction. */
export function weeklyCount(entries: GoalEntry[], goalId: string, date: LocalDate): number {
  const ws = weekStart(date);
  const we = addDays(ws, 6);
  return entries.filter((e) => e.goalId === goalId && e.kind === 'done' && e.date >= ws && e.date <= we).length;
}

export function totalDone(entries: GoalEntry[], goalId: string): number {
  return entries.filter((e) => e.goalId === goalId && e.kind === 'done').length;
}

export function doneInMonth(entries: GoalEntry[], goalId: string, date: LocalDate): number {
  const { year, month } = yearMonth(date);
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  return entries.filter((e) => e.goalId === goalId && e.kind === 'done' && e.date.startsWith(prefix)).length;
}

/**
 * Should this goal be on the Today screen for `date`?
 * Long goals never are. Paused and archived goals never are.
 * Scheduled goals: on due days, or on any day they were already logged/skipped.
 * Weekly and untargeted goals: every day.
 */
export function showsOnToday(goal: Goal, entries: GoalEntry[], date: LocalDate): boolean {
  if (goal.state !== 'active' || goal.shape === 'long') return false;
  if (isPausedOn(goal, date)) return false;
  if (goal.shape === 'scheduled') {
    return isDueOn(goal, date) || !!entryFor(entries, goal.id, date);
  }
  return true;
}

export type DayState = 'done' | 'skipped' | 'open' | 'blank';

/** Calendar cell state. Undone days are blank, never coloured. */
export function dayState(goal: Goal, entries: GoalEntry[], date: LocalDate, today: LocalDate): DayState {
  const e = entryFor(entries, goal.id, date);
  if (e?.kind === 'done') return 'done';
  if (e?.kind === 'skip') return 'skipped';
  if (date === today && existsOn(goal, date) && goal.state === 'active') return 'open';
  return 'blank';
}

/** "Every day" / "Every 3 days" / "Mon, Wed, Fri" / "3 times a week" / "No target" / "By 31 October". */
export function describeSchedule(goal: Goal, version: ScheduleVersion | null = currentSchedule(goal)): string {
  switch (goal.shape) {
    case 'scheduled': {
      const r = version?.recurrence;
      if (!r || r.kind === 'daily') return 'Every day';
      if (r.kind === 'everyN') return r.n === 1 ? 'Every day' : `Every ${r.n} days`;
      const days = [...r.days].sort((a, b) => a - b) as Weekday[];
      if (days.length === 7) return 'Every day';
      if (days.length === 5 && days.every((d) => d <= 5)) return 'Weekdays';
      if (days.length === 2 && days.includes(6) && days.includes(7)) return 'Weekends';
      return days.map((d) => WEEKDAY_SHORT[d]).join(', ');
    }
    case 'weekly': {
      const n = version?.timesPerWeek ?? 1;
      return n === 1 ? 'Once a week' : `${n} times a week`;
    }
    case 'log':
      return 'No target';
    case 'long':
      return 'Long goal';
  }
}

/** Child completions across all children of a long goal. */
export function childCompletions(goalId: string, goals: Goal[], entries: GoalEntry[]): number {
  const childIds = new Set(goals.filter((g) => g.parentId === goalId).map((g) => g.id));
  return entries.filter((e) => e.kind === 'done' && childIds.has(e.goalId)).length;
}

export function pluralise(n: number, one: string, many = one + 's'): string {
  return `${n} ${n === 1 ? one : many}`;
}

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
export function countWord(n: number): string {
  return n <= 10 ? WORDS[n] : String(n);
}
