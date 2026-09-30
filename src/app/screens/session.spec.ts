import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { AUTH, type AuthProvider } from '../core/auth';
import type { Session, SessionSet } from '../core/model';
import { REPO } from '../core/repo';
import { AppStore } from '../core/store';
import { SessionScreen } from './session';

const auth: AuthProvider = {
  user: signal({ id: 'u1', email: 'a@b.c', displayName: 'A' }),
  linkError: signal<string | null>(null),
  signIn: async () => {},
  signUp: async () => ({ confirmationSent: false }),
  resendConfirmation: async () => {},
  signInWithGoogle: async () => {},
  signOut: async () => {},
};

const done = (reps: number, weight: number, date: string): SessionSet => ({
  target: { reps: 8, weight: 60, seconds: null }, reps, weight, seconds: null, doneAt: `${date}T18:10:00.000Z`,
});
const open = (): SessionSet => ({ target: { reps: 8, weight: 60, seconds: null }, reps: null, weight: null, seconds: null, doneAt: null });

function session(id: string, date: string, workoutName: string, sets: SessionSet[], ended = true): Session {
  return {
    id, workoutId: 'w1', workoutName, goalId: null, date,
    startedAt: `${date}T18:00:00.000Z`, endedAt: ended ? `${date}T18:45:00.000Z` : null, closedBy: ended ? 'user' : null,
    pausedAt: null, pausedSeconds: 0,
    exercises: [{ exerciseId: 'bench', name: 'Bench press', kind: 'reps', restSeconds: 90, sets }],
  };
}

describe('SessionScreen last time', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [SessionScreen],
      providers: [provideRouter([]), { provide: AUTH, useValue: auth }, { provide: REPO, useValue: {} }],
    });
  });

  function render(sessions: Session[], id = 'now') {
    const store = TestBed.inject(AppStore);
    store.today.set('2026-09-30');
    store.sessions.set(sessions);
    const fixture = TestBed.createComponent(SessionScreen);
    fixture.componentRef.setInput('id', id);
    fixture.detectChanges();
    return fixture;
  }

  const lastWeek = session('prev', '2026-09-21', 'Push day', [done(8, 60, '2026-09-21'), done(8, 60, '2026-09-21'), done(7, 60, '2026-09-21')]);
  const now = session('now', '2026-09-30', 'Push day', [done(8, 60, '2026-09-30'), open(), open()], false);

  it('folds last time away on the current exercise, with the day it was', () => {
    const el: HTMLElement = render([lastWeek, now]).nativeElement;
    const toggle = el.querySelector('.exc .lh')!;
    expect(toggle.textContent).toContain('Last time');
    expect(toggle.textContent).toContain('Mon 21 Sep');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(el.querySelector('.lsets')).toBeNull();
  });

  it('unfolds the sets ticked last time, marking the one you are on now', () => {
    const fixture = render([lastWeek, now]);
    const el: HTMLElement = fixture.nativeElement;
    (el.querySelector('.exc .lh') as HTMLButtonElement).click();
    fixture.detectChanges();

    const tags = [...el.querySelectorAll('.lsets .tag')];
    expect(tags.map((t) => t.textContent?.trim())).toEqual(['8 × 60', '8 × 60', '7 × 60']);
    expect(tags.map((t) => t.classList.contains('is-cur'))).toEqual([false, true, false]);
    expect(el.querySelector('.exc .lh')!.getAttribute('aria-expanded')).toBe('true');
    expect(el.querySelector('.lfrom')).toBeNull();
  });

  it('stays open next time once opened', () => {
    const first = render([lastWeek, now]);
    (first.nativeElement.querySelector('.exc .lh') as HTMLButtonElement).click();
    first.destroy();

    const again = TestBed.createComponent(SessionScreen);
    again.componentRef.setInput('id', 'now');
    again.detectChanges();
    expect(again.nativeElement.querySelectorAll('.lsets .tag')).toHaveLength(3);
  });

  it('says which workout it was when it was a different one', () => {
    localStorage.setItem('goalbud.session.lastTime', 'open');
    const other = { ...lastWeek, workoutName: 'Upper body' };
    const el: HTMLElement = render([other, now]).nativeElement;
    expect(el.querySelector('.lfrom')?.textContent).toContain('In Upper body');
  });

  it('shows nothing the first time an exercise is done', () => {
    const el: HTMLElement = render([now]).nativeElement;
    expect(el.querySelector('.exc')).not.toBeNull();
    expect(el.querySelector('.last')).toBeNull();
  });
});
