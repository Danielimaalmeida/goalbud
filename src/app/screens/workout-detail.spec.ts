import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, beforeEach } from 'vitest';
import { todayLocal } from '../core/dates';
import type { AuthProvider } from '../core/auth';
import { AUTH } from '../core/auth';
import type { Exercise, Session, SessionSet, SetTarget, Workout } from '../core/model';
import { REPO } from '../core/repo';
import { AppStore } from '../core/store';
import { WorkoutDetailScreen } from './workout-detail';

const auth: AuthProvider = {
  user: signal({ id: 'u1', email: 'a@b.c', displayName: 'A' }),
  linkError: signal<string | null>(null),
  signIn: async () => {},
  signUp: async () => ({ confirmationSent: false }),
  resendConfirmation: async () => {},
  signInWithGoogle: async () => {},
  signOut: async () => {},
};

const bench: Exercise = { id: 'bench', name: 'Bench press', kind: 'reps', restSeconds: 90, primaryMuscle: 'chest', secondaryMuscles: [], archived: false };
const plank: Exercise = { id: 'plank', name: 'Plank', kind: 'time', restSeconds: 60, primaryMuscle: 'core', secondaryMuscles: [], archived: false };
const workout: Workout = {
  id: 'w1', name: 'Push day', restSeconds: null, archived: false,
  exercises: [
    { exerciseId: 'bench', sets: [{ reps: 8, weight: 60, seconds: null }, { reps: 8, weight: 60, seconds: null }] },
    { exerciseId: 'plank', sets: [{ reps: null, weight: null, seconds: 60 }] },
  ],
};

const target = (t: SetTarget): SetTarget => ({ ...t });
const done = (reps: number | null, weight: number | null, seconds: number | null): SessionSet => ({
  target: target({ reps, weight, seconds }), reps, weight, seconds, doneAt: '2026-09-10T18:20:00.000Z',
});
const open = (t: SetTarget): SessionSet => ({ target: target(t), reps: null, weight: null, seconds: null, doneAt: null });

function session(id: string, workoutId: string | null, date: string, sets: SessionSet[]): Session {
  return {
    id, workoutId, workoutName: workoutId ? 'Push day' : 'Freestyle', goalId: null, date,
    startedAt: `${date}T18:00:00.000Z`, endedAt: `${date}T18:45:00.000Z`, closedBy: 'user',
    exercises: [{ exerciseId: 'bench', name: 'Bench press', kind: 'reps', restSeconds: 90, sets }],
  };
}

describe('WorkoutDetailScreen', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [WorkoutDetailScreen],
      providers: [provideRouter([]), { provide: AUTH, useValue: auth }, { provide: REPO, useValue: {} }],
    });
  });

  function render(sessions: Session[]) {
    const store = TestBed.inject(AppStore);
    store.workouts.set([workout]);
    store.exercises.set([bench, plank]);
    store.sessions.set(sessions);
    const fixture = TestBed.createComponent(WorkoutDetailScreen);
    fixture.componentRef.setInput('id', 'w1');
    fixture.detectChanges();
    return fixture;
  }

  it('lists sessions done from this workout, newest first, with actual reps and weights', () => {
    const older = session('s1', 'w1', '2026-09-10', [done(8, 60, null), done(7, 60, null)]);
    const newer = session('s2', 'w1', todayLocal(), [done(8, 62.5, null), open({ reps: 8, weight: 62.5, seconds: null })]);
    const freestyle = session('s3', null, todayLocal(), [done(5, 100, null)]);
    const fixture = render([older, newer, freestyle]);

    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Push day');
    expect(text).toContain('2 exercises · 3 sets · rest 90 s');
    expect(text).toContain('8 × 60 kg');
    expect(fixture.nativeElement.querySelectorAll('.sess')).toHaveLength(2);
    expect(fixture.nativeElement.querySelector('.sess').textContent).toContain('8 × 62.5');
    expect(text).toContain('Today');
    expect(text).not.toContain('5 × 100');
  });

  it('shows only ticked sets, and counts what was done', () => {
    const partial = session('s1', 'w1', '2026-09-10', [done(8, 60, null), open({ reps: 8, weight: 60, seconds: null })]);
    const fixture = render([partial]);

    const cards = fixture.nativeElement.querySelectorAll('.sess');
    expect(cards).toHaveLength(1);
    expect(cards[0].querySelectorAll('.tag')).toHaveLength(1);
    expect(cards[0].textContent).toContain('1 set');
  });

  it('invites a first session when there is no history', () => {
    const fixture = render([]);
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('No sessions yet');
    expect(text).toContain('Start this workout');
  });
});
