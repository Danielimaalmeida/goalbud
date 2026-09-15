import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, formatLong, formatShort, weekStart, weekday } from './dates';
import {
  dayState, describeSchedule, existsOn, isDueOn, scheduleOn, showsOnToday, weeklyCount,
} from './goals';
import type { Goal, GoalEntry } from './model';

function goal(partial: Partial<Goal> = {}): Goal {
  return {
    id: 'g1', name: 'Read', shape: 'scheduled', colour: null, icon: null, isExercise: false,
    state: 'active', parentId: null, schedule: [{ from: '2026-05-04', recurrence: { kind: 'daily' } }],
    pauses: [], targetDate: null, completedOn: null, createdOn: '2026-05-04', archivedOn: null, sortOrder: 0,
    ...partial,
  };
}

describe('dates', () => {
  it('knows Monday-start weeks', () => {
    expect(weekday('2026-09-14')).toBe(1); // Monday
    expect(weekday('2026-09-20')).toBe(7); // Sunday
    expect(weekStart('2026-09-15')).toBe('2026-09-14');
    expect(weekStart('2026-09-14')).toBe('2026-09-14');
    expect(weekStart('2026-09-20')).toBe('2026-09-14');
  });
  it('adds and diffs days across month and DST boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
  });
  it('formats', () => {
    expect(formatLong('2026-09-15')).toBe('Tuesday 15 September');
    expect(formatShort('2026-09-11')).toBe('Fri 11 Sep');
  });
});

describe('recurrence', () => {
  it('every N days anchors to the start date', () => {
    const g = goal({ schedule: [{ from: '2026-09-07', recurrence: { kind: 'everyN', n: 3, anchor: '2026-09-08' } }], createdOn: '2026-09-08' });
    expect(isDueOn(g, '2026-09-08')).toBe(true);
    expect(isDueOn(g, '2026-09-09')).toBe(false);
    expect(isDueOn(g, '2026-09-11')).toBe(true);
    expect(isDueOn(g, '2026-09-05')).toBe(false);
  });
  it('chosen weekdays', () => {
    const g = goal({ schedule: [{ from: '2026-09-07', recurrence: { kind: 'weekdays', days: [1, 3, 5] } }] });
    expect(isDueOn(g, '2026-09-14')).toBe(true);
    expect(isDueOn(g, '2026-09-15')).toBe(false);
    expect(describeSchedule(g)).toBe('Mon, Wed, Fri');
  });
  it('edits apply from the current week; past weeks keep their version', () => {
    const g = goal({
      schedule: [
        { from: '2026-05-04', recurrence: { kind: 'daily' } },
        { from: '2026-09-14', recurrence: { kind: 'weekdays', days: [1] } },
      ],
    });
    expect(scheduleOn(g, '2026-09-10')!.recurrence!.kind).toBe('daily');
    expect(scheduleOn(g, '2026-09-15')!.recurrence!.kind).toBe('weekdays');
    expect(isDueOn(g, '2026-09-10')).toBe(true);
    expect(isDueOn(g, '2026-09-15')).toBe(false);
  });
});

describe('today and history', () => {
  const entries: GoalEntry[] = [
    { id: 'e1', goalId: 'g1', date: '2026-09-14', kind: 'done', loggedAt: '2026-09-14T08:00:00' },
    { id: 'e2', goalId: 'g1', date: '2026-09-15', kind: 'skip', loggedAt: '2026-09-15T08:00:00' },
    { id: 'e3', goalId: 'g1', date: '2026-09-09', kind: 'done', loggedAt: '2026-09-09T08:00:00' },
  ];
  it('counts the week from Monday, never what is missing', () => {
    expect(weeklyCount(entries, 'g1', '2026-09-15')).toBe(1);
    expect(weeklyCount(entries, 'g1', '2026-09-13')).toBe(1);
  });
  it('skips render as skipped, undone as blank, today as open', () => {
    const g = goal();
    expect(dayState(g, entries, '2026-09-14', '2026-09-16')).toBe('done');
    expect(dayState(g, entries, '2026-09-15', '2026-09-16')).toBe('skipped');
    expect(dayState(g, entries, '2026-09-12', '2026-09-16')).toBe('blank');
    expect(dayState(g, entries, '2026-09-16', '2026-09-16')).toBe('open');
    expect(dayState(g, entries, '2026-09-17', '2026-09-16')).toBe('blank');
  });
  it('paused days are blank and hidden from Today, like days before the goal existed', () => {
    const g = goal({ pauses: [{ from: '2026-09-02', to: null }], state: 'paused' });
    expect(existsOn(g, '2026-09-01')).toBe(true);
    expect(existsOn(g, '2026-09-10')).toBe(false);
    expect(existsOn(g, '2026-05-03')).toBe(false);
    expect(showsOnToday(g, [], '2026-09-10')).toBe(false);
  });
  it('scheduled goals show on off days only if already logged; weekly and log goals always', () => {
    const g = goal({ schedule: [{ from: '2026-09-07', recurrence: { kind: 'weekdays', days: [1] } }] });
    expect(showsOnToday(g, [], '2026-09-15')).toBe(false);
    expect(showsOnToday(g, entries, '2026-09-15')).toBe(true);
    expect(showsOnToday(goal({ shape: 'weekly', schedule: [{ from: '2026-05-04', timesPerWeek: 3 }] }), [], '2026-09-15')).toBe(true);
    expect(showsOnToday(goal({ shape: 'log', schedule: [] }), [], '2026-09-15')).toBe(true);
    expect(showsOnToday(goal({ shape: 'long', schedule: [] }), [], '2026-09-15')).toBe(false);
  });
});
