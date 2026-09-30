import { describe, expect, it } from 'vitest';
import {
  canMark, cellState, dayInMonth, dayMeta, dayRows, doneDots, firstDate, goalsInWeek, monthAgo, monthWeeks,
  sessionNote, weekAgo, weekRowMeta,
} from './calendar';
import { formatWeekRange, weekDays } from './dates';
import type { Goal, GoalEntry, Session } from './model';

const TODAY = '2026-09-30'; // a Wednesday

function goal(partial: Partial<Goal> = {}): Goal {
  return {
    id: 'g1', name: 'Read', shape: 'scheduled', colour: null, icon: null, isExercise: false,
    state: 'active', parentId: null, schedule: [{ from: '2026-09-07', recurrence: { kind: 'daily' } }],
    pauses: [], targetDate: null, completedOn: null, createdOn: '2026-09-07', archivedOn: null, sortOrder: 0,
    ...partial,
  };
}
const onDays = (...days: (1 | 2 | 3 | 4 | 5 | 6 | 7)[]) => [{ from: '2026-09-07', recurrence: { kind: 'weekdays' as const, days } }];
const weekly = (n: number) => [{ from: '2026-09-07', timesPerWeek: n }];
function tick(goalId: string, date: string, kind: 'done' | 'skip' = 'done'): GoalEntry {
  return { id: `${goalId}-${date}`, goalId, date, kind, loggedAt: `${date}T08:00:00.000Z` };
}
function session(partial: Partial<Session> = {}): Session {
  return {
    id: 's1', workoutId: 'w1', workoutName: 'Ginásio A', goalId: 'g1', date: '2026-09-28',
    startedAt: '2026-09-28T18:00:00.000Z', endedAt: '2026-09-28T18:52:00.000Z', closedBy: 'user',
    pausedAt: null, pausedSeconds: 0, exercises: [], ...partial,
  };
}

describe('week helpers', () => {
  it('lists the seven days of a week, Monday first', () => {
    expect(weekDays('2026-09-28')).toEqual([
      '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04',
    ]);
  });
  it('writes a week as a range, naming the month once when it stays inside one', () => {
    expect(formatWeekRange('2026-09-21')).toBe('21 – 27 Sep');
    expect(formatWeekRange('2026-09-28')).toBe('28 Sep – 4 Oct');
    expect(formatWeekRange('2026-12-28')).toBe('28 Dec – 3 Jan');
  });
  it('says how long ago a week or a month was', () => {
    expect(weekAgo('2026-09-28', TODAY)).toBe('This week');
    expect(weekAgo('2026-09-21', TODAY)).toBe('Last week');
    expect(weekAgo('2026-09-07', TODAY)).toBe('3 weeks ago');
    expect(monthAgo(2026, 9, TODAY)).toBe('This month');
    expect(monthAgo(2026, 8, TODAY)).toBe('Last month');
    expect(monthAgo(2026, 5, TODAY)).toBe('4 months ago');
    expect(monthAgo(2025, 12, TODAY)).toBe('9 months ago');
  });
});

describe('cellState', () => {
  it('draws a planned day that is still empty as open, and an unplanned one as free', () => {
    const gym = goal({ schedule: onDays(1, 3, 5) }); // Mon Wed Fri
    expect(cellState(gym, [], '2026-09-23', TODAY)).toBe('open'); // Wednesday
    expect(cellState(gym, [], '2026-09-22', TODAY)).toBe('free'); // Tuesday
    expect(cellState(gym, [], TODAY, TODAY)).toBe('open'); // today is open, planned
  });
  it('locks the days to come: planned ones show faintly, the rest stay blank', () => {
    const gym = goal({ schedule: onDays(1, 3, 5) });
    expect(cellState(gym, [], '2026-10-02', TODAY)).toBe('soon'); // Friday
    expect(cellState(gym, [], '2026-10-01', TODAY)).toBe('blank'); // Thursday
  });
  it('shows a tick or a skip whatever else is true of the day', () => {
    const gym = goal({ schedule: onDays(1, 3, 5) });
    expect(cellState(gym, [tick('g1', '2026-09-22')], '2026-09-22', TODAY)).toBe('done'); // off day
    expect(cellState(gym, [tick('g1', '2026-09-23', 'skip')], '2026-09-23', TODAY)).toBe('skipped');
  });
  it('treats weekly and untargeted goals as free on every day so far', () => {
    const swim = goal({ shape: 'weekly', schedule: weekly(3) });
    const call = goal({ shape: 'log', schedule: [] });
    for (const g of [swim, call]) {
      expect(cellState(g, [], '2026-09-23', TODAY)).toBe('free');
      expect(cellState(g, [], TODAY, TODAY)).toBe('free');
      expect(cellState(g, [], '2026-10-02', TODAY)).toBe('blank');
    }
  });
  it('leaves days before the goal existed blank', () => {
    const late = goal({ createdOn: '2026-09-16', schedule: [{ from: '2026-09-14', recurrence: { kind: 'daily' } }] });
    expect(cellState(late, [], '2026-09-15', TODAY)).toBe('blank');
    expect(cellState(late, [], '2026-09-16', TODAY)).toBe('open');
  });
  it('leaves paused days blank, exactly like days before the goal existed', () => {
    const paused = goal({ state: 'active', pauses: [{ from: '2026-09-21', to: '2026-09-24' }] });
    expect(cellState(paused, [], '2026-09-20', TODAY)).toBe('open');
    expect(cellState(paused, [], '2026-09-22', TODAY)).toBe('blank');
    expect(cellState(paused, [], '2026-09-24', TODAY)).toBe('open'); // the day it came back
    expect(cellState(paused, [tick('g1', '2026-09-22')], '2026-09-22', TODAY)).toBe('done');
  });
  it('shows an archived goal only by what was ticked', () => {
    const old = goal({ state: 'archived', archivedOn: '2026-09-20' });
    expect(cellState(old, [], '2026-09-15', TODAY)).toBe('blank');
    expect(cellState(old, [], '2026-09-25', TODAY)).toBe('blank');
    expect(cellState(old, [tick('g1', '2026-09-15')], '2026-09-15', TODAY)).toBe('done');
  });
  it('keeps the plan a past week had when the schedule was edited later', () => {
    const edited = goal({
      schedule: [
        { from: '2026-09-07', recurrence: { kind: 'daily' } },
        { from: '2026-09-28', recurrence: { kind: 'weekdays', days: [1] } },
      ],
    });
    expect(cellState(edited, [], '2026-09-23', TODAY)).toBe('open'); // last week: every day
    expect(cellState(edited, [], '2026-09-28', TODAY)).toBe('open'); // this week: Mondays only
    expect(cellState(edited, [], '2026-09-29', TODAY)).toBe('free');
  });
});

describe('canMark', () => {
  it('allows any day up to today that the goal was active', () => {
    expect(canMark(goal(), '2026-09-09', TODAY)).toBe(true);
    expect(canMark(goal(), TODAY, TODAY)).toBe(true);
  });
  it('locks days to come, days before the goal, paused days and archived goals', () => {
    expect(canMark(goal(), '2026-10-01', TODAY)).toBe(false);
    expect(canMark(goal(), '2026-09-06', TODAY)).toBe(false);
    expect(canMark(goal({ pauses: [{ from: '2026-09-21', to: '2026-09-24' }] }), '2026-09-22', TODAY)).toBe(false);
    expect(canMark(goal({ state: 'archived', archivedOn: '2026-09-20' }), '2026-09-15', TODAY)).toBe(false);
  });
});

describe('goalsInWeek', () => {
  const swim = goal({ id: 'swim', shape: 'weekly', schedule: weekly(3), sortOrder: 0 });
  const read = goal({ id: 'read', sortOrder: 1 });
  const late = goal({ id: 'late', createdOn: '2026-09-29', sortOrder: 2 });
  const later = goal({ id: 'later', createdOn: '2026-10-06', sortOrder: 3 });
  const painting = goal({ id: 'painting', shape: 'long', schedule: [], sortOrder: 4 });
  const ids = (list: Goal[]) => list.map((g) => g.id);

  it('lists goals in their usual order, with a goal started mid-week from that week on', () => {
    const all = [later, painting, late, read, swim];
    expect(ids(goalsInWeek(all, [], '2026-09-28'))).toEqual(['swim', 'read', 'late']);
    expect(ids(goalsInWeek(all, [], '2026-09-21'))).toEqual(['swim', 'read']);
  });
  it('leaves out long goals, which live on the Goals tab', () => {
    expect(ids(goalsInWeek([painting, read], [], '2026-09-28'))).toEqual(['read']);
  });
  it('drops a goal from the weeks it was paused all the way through', () => {
    const paused = goal({ id: 'paused', state: 'paused', pauses: [{ from: '2026-09-21', to: null }] });
    expect(ids(goalsInWeek([paused], [], '2026-09-14'))).toEqual(['paused']);
    expect(ids(goalsInWeek([paused], [], '2026-09-21'))).toEqual([]); // the day it is paused from is already hidden
    expect(ids(goalsInWeek([paused], [], '2026-09-28'))).toEqual([]);
    const pausedMidWeek = goal({ id: 'mid', state: 'paused', pauses: [{ from: '2026-09-30', to: null }] });
    expect(ids(goalsInWeek([pausedMidWeek], [], '2026-09-28'))).toEqual(['mid']); // Monday and Tuesday were before the pause
    expect(ids(goalsInWeek([pausedMidWeek], [], '2026-10-05'))).toEqual([]);
  });
  it('shows an archived goal only in weeks where something was ticked', () => {
    const old = goal({ id: 'old', state: 'archived', archivedOn: '2026-09-20' });
    expect(ids(goalsInWeek([old], [], '2026-09-14'))).toEqual([]);
    expect(ids(goalsInWeek([old], [tick('old', '2026-09-15')], '2026-09-14'))).toEqual(['old']);
    expect(ids(goalsInWeek([old], [tick('old', '2026-09-15')], '2026-09-28'))).toEqual([]);
  });
});

describe('weekRowMeta', () => {
  const swim = goal({ id: 'swim', shape: 'weekly', schedule: weekly(3) });

  it('counts what was done in a weekly goal, never what is missing', () => {
    const entries = [tick('swim', '2026-09-28'), tick('swim', '2026-09-29'), tick('swim', '2026-09-22')];
    expect(weekRowMeta(swim, [swim], entries, '2026-09-28', TODAY)).toBe('2 this week · 3 times a week');
    expect(weekRowMeta(swim, [swim], entries, '2026-09-21', TODAY)).toBe('1 that week · 3 times a week');
    expect(weekRowMeta(swim, [swim], [], '2026-09-28', TODAY)).toBe('0 this week · 3 times a week');
  });
  it('gives a past week the target it had then', () => {
    const edited = goal({ id: 'swim', shape: 'weekly', schedule: [...weekly(2), { from: '2026-09-28', timesPerWeek: 4 }] });
    expect(weekRowMeta(edited, [edited], [], '2026-09-21', TODAY)).toBe('0 that week · 2 times a week');
    expect(weekRowMeta(edited, [edited], [], '2026-09-28', TODAY)).toBe('0 this week · 4 times a week');
  });
  it('names the long goal a goal belongs to, and is empty otherwise', () => {
    const painting = goal({ id: 'painting', name: 'Finish the painting', shape: 'long', schedule: [] });
    const paint = goal({ id: 'paint', parentId: 'painting' });
    expect(weekRowMeta(paint, [painting, paint], [], '2026-09-28', TODAY)).toBe('Finish the painting');
    expect(weekRowMeta(goal(), [goal()], [], '2026-09-28', TODAY)).toBe('');
  });
});

describe('dayRows', () => {
  const read = goal({ id: 'read', name: 'Read', sortOrder: 0 });
  const gym = goal({ id: 'gym', name: 'Gym', schedule: onDays(1, 3, 5), isExercise: true, sortOrder: 1 });
  const tennis = goal({ id: 'tennis', name: 'Tennis', schedule: onDays(2, 6), sortOrder: 2 });
  const swim = goal({ id: 'swim', name: 'Swim', shape: 'weekly', schedule: weekly(3), sortOrder: 3 });
  const painting = goal({ id: 'painting', name: 'Painting', shape: 'long', schedule: [], sortOrder: 4 });
  const goals = [swim, painting, tennis, gym, read];
  const names = (rows: { goal: Goal }[]) => rows.map((r) => r.goal.name);

  it('lists what Today would have shown, and sets goals with nothing planned apart', () => {
    const { main, other } = dayRows(goals, [], '2026-09-23', TODAY); // a Wednesday
    expect(names(main)).toEqual(['Read', 'Gym', 'Swim']);
    expect(names(other)).toEqual(['Tennis']);
    expect(main.every((r) => r.state === 'open' && r.editable)).toBe(true);
  });
  it('keeps ticked and skipped goals in the list, and a goal ticked on an off day with it', () => {
    const entries = [tick('gym', '2026-09-23'), tick('read', '2026-09-23', 'skip'), tick('tennis', '2026-09-23')];
    const { main, other } = dayRows(goals, entries, '2026-09-23', TODAY);
    expect(main.map((r) => [r.goal.name, r.state])).toEqual([['Read', 'skipped'], ['Gym', 'done'], ['Tennis', 'done'], ['Swim', 'open']]);
    expect(other).toEqual([]);
  });
  it('lists an archived goal only on days it was ticked, read-only', () => {
    const old = goal({ id: 'old', name: 'Old', state: 'archived', archivedOn: '2026-09-20', sortOrder: 9 });
    expect(names(dayRows([old], [], '2026-09-15', TODAY).main)).toEqual([]);
    const { main } = dayRows([old], [tick('old', '2026-09-15')], '2026-09-15', TODAY);
    expect(main).toEqual([{ goal: old, state: 'done', editable: false }]);
  });
  it('lists nothing for a day that has not happened', () => {
    expect(dayRows(goals, [], '2026-10-02', TODAY)).toEqual({ main: [], other: [] });
  });
});

describe('dayMeta', () => {
  const gym = goal({ id: 'gym', name: 'Gym', schedule: onDays(1, 3, 5), isExercise: true });
  const row = (g: Goal, state: 'done' | 'skipped' | 'open') => ({ goal: g, state, editable: true });

  it('says skipped plainly', () => {
    expect(dayMeta(row(gym, 'skipped'), [gym], [], [], '2026-09-23', TODAY)).toBe('Skipped');
  });
  it('names the session that ticked a workout goal, and falls back to the schedule without one', () => {
    const s = session({ goalId: 'gym', date: '2026-09-28' });
    expect(dayMeta(row(gym, 'done'), [gym], [], [s], '2026-09-28', TODAY)).toBe('Ginásio A · 52 min');
    expect(dayMeta(row(gym, 'done'), [gym], [], [], '2026-09-28', TODAY)).toBe('Mon, Wed, Fri');
    expect(dayMeta(row(gym, 'open'), [gym], [], [s], '2026-09-28', TODAY)).toBe('Mon, Wed, Fri');
  });
  it('gives a weekly goal its week count, an untargeted goal "Whenever", a child its long goal', () => {
    const swim = goal({ id: 'swim', shape: 'weekly', schedule: weekly(3) });
    expect(dayMeta(row(swim, 'open'), [swim], [tick('swim', '2026-09-22')], [], '2026-09-23', TODAY)).toBe('1 that week · 3 times a week');
    const call = goal({ id: 'call', shape: 'log', schedule: [] });
    expect(dayMeta(row(call, 'open'), [call], [], [], '2026-09-23', TODAY)).toBe('Whenever');
    const painting = goal({ id: 'painting', name: 'Finish the painting', shape: 'long', schedule: [] });
    const paint = goal({ id: 'paint', parentId: 'painting' });
    expect(dayMeta(row(paint, 'open'), [painting, paint], [], [], '2026-09-23', TODAY)).toBe('Finish the painting');
  });
});

describe('sessionNote', () => {
  it('reads the minutes without the time spent paused', () => {
    expect(sessionNote(goal({ id: 'g1' }), [session({ pausedSeconds: 120 })], '2026-09-28')).toBe('Ginásio A · 50 min');
  });
  it('counts several sessions, and ignores open ones and other goals and days', () => {
    const two = [session({ id: 'a' }), session({ id: 'b' })];
    expect(sessionNote(goal({ id: 'g1' }), two, '2026-09-28')).toBe('2 sessions');
    const others = [session({ endedAt: null }), session({ goalId: 'other' }), session({ date: '2026-09-27' })];
    expect(sessionNote(goal({ id: 'g1' }), others, '2026-09-28')).toBeNull();
  });
});

describe('doneDots', () => {
  const read = goal({ id: 'read', colour: 'teal', sortOrder: 1 });
  const gym = goal({ id: 'gym', colour: 'rust', sortOrder: 0 });
  const plain = goal({ id: 'plain', colour: null, sortOrder: 2 });
  const painting = goal({ id: 'painting', shape: 'long', colour: 'purple', sortOrder: 3 });

  it('gives one colour per goal ticked that day, in goal order, sage when a goal has no colour', () => {
    const entries = [tick('plain', '2026-09-14'), tick('read', '2026-09-14'), tick('gym', '2026-09-14')];
    const dots = doneDots([read, gym, plain], entries, '2026-09-01', '2026-09-30');
    expect(dots.get('2026-09-14')).toEqual(['#C2643A', '#2F7D8C', '#3F6F52']);
  });
  it('leaves out skips, long goals, and days outside the range', () => {
    const entries = [tick('read', '2026-09-14', 'skip'), tick('painting', '2026-09-15'), tick('gym', '2026-08-31'), tick('gym', '2026-09-16')];
    const dots = doneDots([read, gym, painting], entries, '2026-09-01', '2026-09-30');
    expect([...dots.keys()]).toEqual(['2026-09-16']);
  });
});

describe('monthWeeks', () => {
  const read = goal({ id: 'read', colour: 'teal' });

  it('lays September 2026 out in five Monday-first rows, padded with nulls', () => {
    const weeks = monthWeeks([read], [], 2026, 9, TODAY, '2026-09-07');
    expect(weeks).toHaveLength(5);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks[0][0]).toBeNull(); // the 1st is a Tuesday
    expect(weeks[0][1]?.day).toBe(1);
    expect(weeks[4].map((c) => c?.day ?? null)).toEqual([28, 29, 30, null, null, null, null]);
  });
  it('marks today, locks days before the first goal and days to come', () => {
    const cells = monthWeeks([read], [], 2026, 9, '2026-09-16', '2026-09-07').flat().filter((c) => c !== null);
    const day = (n: number) => cells.find((c) => c.day === n)!;
    expect(day(3)).toMatchObject({ state: 'before', disabled: true });
    expect(day(7)).toMatchObject({ state: 'past', disabled: false });
    expect(day(16)).toMatchObject({ state: 'today', disabled: false });
    expect(day(17)).toMatchObject({ state: 'future', disabled: true });
  });
  it('puts one dot per goal done under each date, at most six', () => {
    const goals = Array.from({ length: 8 }, (_, i) => goal({ id: `g${i}`, sortOrder: i }));
    const entries = goals.map((g) => tick(g.id, '2026-09-14'));
    const cells = monthWeeks(goals, entries, 2026, 9, TODAY, '2026-09-07').flat();
    expect(cells.find((c) => c?.day === 14)).toMatchObject({ done: 8 });
    expect(cells.find((c) => c?.day === 14)?.dots).toHaveLength(6);
    expect(cells.find((c) => c?.day === 15)).toMatchObject({ done: 0, dots: [] });
  });
});

describe('where the calendar can go', () => {
  it('starts at the earliest goal, ignoring long goals', () => {
    const early = goal({ id: 'early', createdOn: '2026-08-05' });
    const painting = goal({ id: 'painting', shape: 'long', createdOn: '2026-06-01' });
    expect(firstDate([goal(), early, painting])).toBe('2026-08-05');
    expect(firstDate([painting])).toBeNull();
    expect(firstDate([])).toBeNull();
  });
  it('opens a month on the picked day if it falls there, else on the latest day that has happened', () => {
    expect(dayInMonth(2026, 9, '2026-09-23', TODAY)).toBe('2026-09-23');
    expect(dayInMonth(2026, 8, '2026-09-23', TODAY)).toBe('2026-08-31');
    expect(dayInMonth(2026, 9, '2026-08-10', TODAY)).toBe(TODAY);
    expect(dayInMonth(2026, 9, '2026-09-30', '2026-09-16')).toBe('2026-09-16');
    expect(dayInMonth(2026, 9, null, TODAY)).toBe(TODAY);
  });
});
