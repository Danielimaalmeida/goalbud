import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTH, type AuthProvider } from '../core/auth';
import type { Goal, GoalEntry } from '../core/model';
import { REPO } from '../core/repo';
import { AppStore } from '../core/store';
import { CalendarScreen } from './calendar';

type Fx = ComponentFixture<CalendarScreen>;

const auth: AuthProvider = {
  user: signal({ id: 'u1', email: 'a@b.c', displayName: 'A' }),
  linkError: signal<string | null>(null),
  signIn: async () => {},
  signUp: async () => ({ confirmationSent: false }),
  resendConfirmation: async () => {},
  signInWithGoogle: async () => {},
  signOut: async () => {},
};

const TODAY = '2026-09-30'; // a Wednesday

function goal(id: string, partial: Partial<Goal> = {}): Goal {
  return {
    id, name: id, shape: 'scheduled', colour: null, icon: null, isExercise: false,
    state: 'active', parentId: null, schedule: [{ from: '2026-09-07', recurrence: { kind: 'daily' } }],
    pauses: [], targetDate: null, completedOn: null, createdOn: '2026-09-07', archivedOn: null, sortOrder: 0,
    ...partial,
  };
}
function entry(goalId: string, date: string, kind: 'done' | 'skip' = 'done'): GoalEntry {
  return { id: `${goalId}-${date}`, goalId, date, kind, loggedAt: `${date}T08:00:00.000Z` };
}

const read = goal('Read', { sortOrder: 0 });
const gym = goal('Gym', { sortOrder: 1, schedule: [{ from: '2026-09-07', recurrence: { kind: 'weekdays', days: [1, 3, 5] } }] });
const swim = goal('Swim', { sortOrder: 2, shape: 'weekly', schedule: [{ from: '2026-09-07', timesPerWeek: 3 }] });
const painting = goal('Painting', { sortOrder: 3, shape: 'long', schedule: [] });

describe('CalendarScreen', () => {
  const repo = {
    upsertEntry: vi.fn((_uid: string, _entry: GoalEntry) => Promise.resolve()),
    deleteEntry: vi.fn((_uid: string, _id: string) => Promise.resolve()),
  };

  beforeEach(() => {
    repo.upsertEntry.mockClear();
    repo.deleteEntry.mockClear();
    TestBed.configureTestingModule({
      imports: [CalendarScreen],
      providers: [provideRouter([]), { provide: AUTH, useValue: auth }, { provide: REPO, useValue: repo }],
    });
  });

  function render(goals: Goal[], entries: GoalEntry[] = []) {
    const store = TestBed.inject(AppStore);
    store.today.set(TODAY);
    store.goals.set(goals);
    store.entries.set(entries);
    const fixture = TestBed.createComponent(CalendarScreen);
    fixture.detectChanges();
    return fixture;
  }
  const el = (f: Fx, sel: string) => f.nativeElement.querySelector(sel) as HTMLElement | null;
  const text = (f: Fx, sel: string) => el(f, sel)?.textContent?.trim();
  const cell = (f: Fx, label: string) => el(f, `[aria-label="${label}"]`) as HTMLButtonElement | null;
  const press = (f: Fx, target: HTMLElement | null) => {
    expect(target, 'the button to press').not.toBeNull();
    target!.click();
    f.detectChanges();
  };
  const pill = (f: Fx, name: 'Week' | 'Month') => [...f.nativeElement.querySelectorAll('.pill-tab')].find((b) => b.textContent.trim() === name) as HTMLElement;

  describe('week', () => {
    it('opens on this week with a card for each goal, leaving long goals to the Goals tab', () => {
      const f = render([painting, swim, gym, read]);
      expect(text(f, '.title')).toBe('28 Sep – 4 Oct');
      expect(text(f, '.sub')).toBe('This week');
      expect(f.nativeElement.querySelectorAll('.dn')).toHaveLength(7);
      expect([...f.nativeElement.querySelectorAll('.gcard .name')].map((n) => n.textContent.trim())).toEqual(['Read', 'Gym', 'Swim']);
      expect(text(f, '.gcard:last-child .meta')).toBe('0 this week · 3 times a week');
    });

    it('locks the days to come, and never goes past this week', () => {
      const f = render([read]);
      expect(cell(f, 'Read, Wednesday 30 September, not done yet')!.disabled).toBe(false);
      expect(cell(f, 'Read, Thursday 1 October, still to come')!.disabled).toBe(true);
      expect(cell(f, 'Next week')!.disabled).toBe(true);
      expect(cell(f, 'Previous week')!.disabled).toBe(false);
    });

    it('goes back week by week and jumps back to this week', () => {
      const f = render([read]);
      expect(el(f, '.jump')).toBeNull();
      press(f, cell(f, 'Previous week'));
      expect(text(f, '.title')).toBe('21 – 27 Sep');
      expect(text(f, '.sub')).toBe('Last week');
      press(f, cell(f, 'Previous week'));
      expect(text(f, '.sub')).toBe('2 weeks ago');
      expect(text(f, '.jump')).toBe('This week');
      press(f, el(f, '.jump'));
      expect(text(f, '.title')).toBe('28 Sep – 4 Oct');
    });

    it('stops at the week of the first goal', () => {
      const f = render([read]); // created Monday 7 Sep
      press(f, cell(f, 'Previous week')); // 21 Sep
      press(f, cell(f, 'Previous week')); // 14 Sep
      press(f, cell(f, 'Previous week')); // 7 Sep
      expect(text(f, '.title')).toBe('7 – 13 Sep');
      expect(cell(f, 'Previous week')!.disabled).toBe(true);
    });

    it('ticks a day that was forgotten, then clears it with a second tap', () => {
      const f = render([read]);
      press(f, cell(f, 'Previous week'));
      const friday = 'Read, Friday 25 September, not done yet';
      press(f, cell(f, friday));
      expect(repo.upsertEntry).toHaveBeenCalledWith('u1', expect.objectContaining({ goalId: 'Read', date: '2026-09-25', kind: 'done' }));
      const done = cell(f, 'Read, Friday 25 September, done')!;
      expect(done.getAttribute('aria-pressed')).toBe('true');
      const added = repo.upsertEntry.mock.calls[0][1];
      press(f, done);
      expect(repo.deleteEntry).toHaveBeenCalledWith('u1', added.id);
      expect(cell(f, friday)).not.toBeNull();
    });

    it('turns a skipped day into done', () => {
      const f = render([gym], [entry('Gym', '2026-09-30', 'skip')]);
      press(f, cell(f, 'Gym, Wednesday 30 September, skipped'));
      expect(repo.upsertEntry).toHaveBeenCalledWith('u1', expect.objectContaining({ id: 'Gym-2026-09-30', kind: 'done' }));
    });

    it('locks days before a goal existed and days it was paused', () => {
      const late = goal('Late', { createdOn: '2026-09-29', schedule: [{ from: '2026-09-28', recurrence: { kind: 'daily' } }] });
      const paused = goal('Paused', { state: 'paused', pauses: [{ from: '2026-09-29', to: null }] });
      const f = render([late, paused]);
      expect(cell(f, 'Late, Monday 28 September, not active')!.disabled).toBe(true);
      expect(cell(f, 'Late, Tuesday 29 September, not done yet')!.disabled).toBe(false);
      expect(cell(f, 'Paused, Monday 28 September, not done yet')!.disabled).toBe(false);
      expect(cell(f, 'Paused, Tuesday 29 September, not active')!.disabled).toBe(true);
    });

    it('never draws a missed day as anything but an empty ring', () => {
      const f = render([gym]);
      press(f, cell(f, 'Previous week'));
      const wednesday = f.nativeElement.querySelector('[aria-label="Gym, Wednesday 23 September, not done yet"] span');
      expect(wednesday.className).toContain('is-open');
      expect(f.nativeElement.textContent).not.toMatch(/missed|overdue|incomplete|failed/i);
    });
  });

  describe('month', () => {
    const goals = [painting, read, gym, swim];
    const entries = [entry('Read', '2026-09-28'), entry('Gym', '2026-09-28'), entry('Swim', '2026-09-28'), entry('Read', '2026-09-29')];

    it('opens on today, with a dot count for each day', () => {
      const f = render(goals, entries);
      press(f, pill(f, 'Month'));
      expect(text(f, '.title')).toBe('September 2026');
      expect(text(f, '.sub')).toBe('This month');
      expect(text(f, '.dayname')).toBe('Wednesday 30 September');
      expect(cell(f, 'Monday 28 September, 3 done')).not.toBeNull();
      expect(f.nativeElement.querySelectorAll('[aria-label="Monday 28 September, 3 done"] .dots i')).toHaveLength(3);
      expect(cell(f, 'Tuesday 29 September, 1 done')).not.toBeNull();
    });

    it('locks days before the first goal and days to come', () => {
      const f = render(goals, entries);
      press(f, pill(f, 'Month'));
      expect(cell(f, 'Friday 4 September')!.disabled).toBe(true);
      expect(cell(f, 'Monday 7 September')!.disabled).toBe(false);
      expect(cell(f, 'Previous month')!.disabled).toBe(true);
      expect(cell(f, 'Next month')!.disabled).toBe(true);
    });

    it('lists the goals of the picked day and ticks one, moving the dots with it', () => {
      const f = render(goals, entries);
      press(f, pill(f, 'Month'));
      press(f, cell(f, 'Tuesday 29 September, 1 done'));
      expect(text(f, '.dayname')).toBe('Tuesday 29 September');
      // Gym is not planned on a Tuesday, so it waits under "Other goals"
      expect([...f.nativeElement.querySelectorAll('.list .name')].map((n) => n.textContent.trim())).toEqual(['Read', 'Swim']);
      press(f, cell(f, 'Swim, Tuesday 29 September, not done yet'));
      expect(repo.upsertEntry).toHaveBeenCalledWith('u1', expect.objectContaining({ goalId: 'Swim', date: '2026-09-29', kind: 'done' }));
      expect(cell(f, 'Tuesday 29 September, 2 done')).not.toBeNull();
    });

    it('keeps goals with nothing planned behind "Other goals", and closes them when another day is picked', () => {
      const f = render(goals, entries);
      press(f, pill(f, 'Month'));
      press(f, cell(f, 'Tuesday 29 September, 1 done'));
      expect(text(f, '.more .aside')).toBe('1');
      expect(f.nativeElement.querySelectorAll('.list .row')).toHaveLength(2);
      press(f, el(f, '.more'));
      expect(el(f, '.more')?.getAttribute('aria-expanded')).toBe('true');
      expect(f.nativeElement.querySelectorAll('.list .row')).toHaveLength(3);
      press(f, cell(f, 'Thursday 24 September')); // another day, also with Gym not planned
      expect(el(f, '.more')?.getAttribute('aria-expanded')).toBe('false');
      expect(f.nativeElement.querySelectorAll('.list .row')).toHaveLength(2);
    });

    it('lets a goal with nothing planned that day be ticked anyway, and then lists it with the rest', () => {
      const f = render(goals, entries);
      press(f, pill(f, 'Month'));
      press(f, cell(f, 'Tuesday 29 September, 1 done'));
      press(f, el(f, '.more'));
      press(f, cell(f, 'Gym, Tuesday 29 September, not done yet'));
      expect(repo.upsertEntry).toHaveBeenCalledWith('u1', expect.objectContaining({ goalId: 'Gym', date: '2026-09-29', kind: 'done' }));
      expect(el(f, '.more')).toBeNull(); // nothing left to set apart
      expect([...f.nativeElement.querySelectorAll('.list .name')].map((n) => n.textContent.trim())).toEqual(['Read', 'Gym', 'Swim']);
    });

    it('goes back a month, as far as the first goal, and lands on the last day of it', () => {
      const early = goal('Early', { createdOn: '2026-08-05', schedule: [{ from: '2026-08-03', recurrence: { kind: 'daily' } }] });
      const f = render([early, ...goals], entries);
      press(f, pill(f, 'Month'));
      press(f, cell(f, 'Previous month'));
      expect(text(f, '.title')).toBe('August 2026');
      expect(text(f, '.sub')).toBe('Last month');
      expect(text(f, '.dayname')).toBe('Monday 31 August');
      expect(cell(f, 'Monday 3 August')!.disabled).toBe(true); // before the first goal
      expect(cell(f, 'Previous month')!.disabled).toBe(true);
      press(f, el(f, '.jump'));
      expect(text(f, '.title')).toBe('September 2026');
      expect(text(f, '.dayname')).toBe('Wednesday 30 September');
    });

    it('takes the picked day back to the week view', () => {
      const f = render(goals, entries);
      press(f, pill(f, 'Month'));
      press(f, cell(f, 'Wednesday 23 September'));
      press(f, pill(f, 'Week'));
      expect(text(f, '.title')).toBe('21 – 27 Sep');
    });

    it('opens the month of the week that was on show, on its last day that has happened', () => {
      const f = render(goals, entries);
      press(f, cell(f, 'Previous week'));
      press(f, pill(f, 'Month'));
      expect(text(f, '.dayname')).toBe('Sunday 27 September');
    });
  });

  it('invites a first goal instead of an empty grid', () => {
    const f = render([painting]);
    expect(f.nativeElement.textContent).toContain('Nothing to show yet');
    expect(el(f, '.pill-tab')).toBeNull();
  });
});
