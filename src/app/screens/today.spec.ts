import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { AUTH, type AuthProvider } from '../core/auth';
import type { Goal } from '../core/model';
import { REPO } from '../core/repo';
import { AppStore } from '../core/store';
import { TodayScreen } from './today';

const auth: AuthProvider = {
  user: signal({ id: 'u1', email: 'a@b.c', displayName: 'A' }),
  linkError: signal<string | null>(null),
  signIn: async () => {},
  signUp: async () => ({ confirmationSent: false }),
  resendConfirmation: async () => {},
  signInWithGoogle: async () => {},
  signOut: async () => {},
};

function goal(id: string, partial: Partial<Goal> = {}): Goal {
  return {
    id, name: id, shape: 'scheduled', colour: null, icon: null, isExercise: false,
    state: 'active', parentId: null, schedule: [{ from: '2026-09-07', recurrence: { kind: 'daily' } }],
    pauses: [], targetDate: null, completedOn: null, createdOn: '2026-09-07', archivedOn: null, sortOrder: 0,
    ...partial,
  };
}

describe('TodayScreen calendar button', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TodayScreen],
      providers: [provideRouter([]), { provide: AUTH, useValue: auth }, { provide: REPO, useValue: {} }],
    });
  });

  function render(goals: Goal[]) {
    const store = TestBed.inject(AppStore);
    store.today.set('2026-09-30');
    store.goals.set(goals);
    const fixture = TestBed.createComponent(TodayScreen);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('opens the calendar from the top of Today once there is a goal', () => {
    const link = render([goal('Read')]).querySelector('a.cal');
    expect(link?.getAttribute('href')).toBe('/calendar');
    expect(link?.textContent).toContain('Calendar');
  });

  it('stays out of the way on the first run', () => {
    expect(render([]).querySelector('a.cal')).toBeNull();
  });

  it('stays out of the way while the only goals are long ones, which the calendar does not list', () => {
    expect(render([goal('Painting', { shape: 'long', schedule: [] })]).querySelector('a.cal')).toBeNull();
  });

  it('counts an archived goal, because its history is still there to look at', () => {
    expect(render([goal('Old', { state: 'archived', archivedOn: '2026-09-20' })]).querySelector('a.cal')).not.toBeNull();
  });
});
