import { Injector, signal } from '@angular/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { AUTH, type AuthProvider } from './auth';
import { todayLocal } from './dates';
import { exerciseDeleteDetail, goalDeleteDetail, workoutDeleteDetail } from './deletes';
import type { Exercise, Goal, GoalEntry, Profile, Session, Snapshot, Workout } from './model';
import { REPO, type Repo } from './repo';
import { AppStore } from './store';

const UID = 'u1';

function goal(id: string, partial: Partial<Goal> = {}): Goal {
  return {
    id, name: id, shape: 'scheduled', colour: null, icon: null, isExercise: false,
    state: 'active', parentId: null, schedule: [{ from: '2026-09-14', recurrence: { kind: 'daily' } }],
    pauses: [], targetDate: null, completedOn: null, createdOn: '2026-09-14', archivedOn: null, sortOrder: 0,
    ...partial,
  };
}
function entry(id: string, goalId: string, date: string): GoalEntry {
  return { id, goalId, date, kind: 'done', loggedAt: `${date}T09:00:00.000Z` };
}
function exercise(id: string): Exercise {
  return { id, name: id, kind: 'reps', restSeconds: null, primaryMuscle: null, secondaryMuscles: [], archived: false };
}
function workout(id: string, exerciseIds: string[]): Workout {
  return {
    id, name: id, restSeconds: null, archived: false,
    exercises: exerciseIds.map((e) => ({ exerciseId: e, sets: [{ reps: 8, weight: null, seconds: null }] })),
  };
}
function session(id: string, workoutId: string | null, exerciseIds: string[]): Session {
  return {
    id, workoutId, workoutName: workoutId ?? 'Freestyle', goalId: null, date: '2026-09-15',
    startedAt: '2026-09-15T18:00:00.000Z', endedAt: '2026-09-15T19:00:00.000Z', closedBy: 'user',
    pausedAt: null, pausedSeconds: 0,
    exercises: exerciseIds.map((e) => ({
      exerciseId: e, name: e, kind: 'reps' as const, restSeconds: 90,
      sets: [{ target: { reps: 8, weight: null, seconds: null }, reps: 8, weight: 40, seconds: null, doneAt: '2026-09-15T18:10:00.000Z' }],
    })),
  };
}

const PROFILE: Profile = { id: UID, displayName: 'Daniel', email: 'd@example.com', reminderTime: null };

/** Records every write so tests can assert what was persisted, and in what order. */
class FakeRepo implements Repo {
  calls: string[] = [];
  failOn: string | null = null;
  constructor(private snapshot: Snapshot) {}

  private track(name: string): Promise<void> {
    this.calls.push(name);
    return this.failOn === name ? Promise.reject(new Error('boom')) : Promise.resolve();
  }
  loadAll() { return Promise.resolve(structuredClone(this.snapshot)); }
  upsertGoal(_u: string, g: Goal) { return this.track(`upsertGoal:${g.id}`); }
  upsertEntry(_u: string, e: GoalEntry) { return this.track(`upsertEntry:${e.id}`); }
  deleteEntry(_u: string, id: string) { return this.track(`deleteEntry:${id}`); }
  upsertExercise(_u: string, e: Exercise) { return this.track(`upsertExercise:${e.id}`); }
  upsertWorkout(_u: string, w: Workout) { return this.track(`upsertWorkout:${w.id}`); }
  upsertSession(_u: string, s: Session) { return this.track(`upsertSession:${s.id}`); }
  updateProfile() { return this.track('updateProfile'); }
  deleteGoal(_u: string, id: string) { return this.track(`deleteGoal:${id}`); }
  deleteExercise(_u: string, id: string) { return this.track(`deleteExercise:${id}`); }
  deleteWorkout(_u: string, id: string) { return this.track(`deleteWorkout:${id}`); }
}

const auth: AuthProvider = {
  user: signal({ id: UID, email: 'd@example.com', displayName: 'Daniel' }),
  linkError: signal(null),
  signIn: async () => {},
  signUp: async () => ({ confirmationSent: false }),
  resendConfirmation: async () => {},
  signInWithGoogle: async () => {},
  signOut: async () => {},
};

async function storeWith(snapshot: Partial<Snapshot>): Promise<{ store: AppStore; repo: FakeRepo }> {
  const full: Snapshot = {
    profile: PROFILE, goals: [], entries: [], exercises: [], workouts: [], sessions: [], ...snapshot,
  };
  const repo = new FakeRepo(full);
  const injector = Injector.create({
    providers: [{ provide: REPO, useValue: repo }, { provide: AUTH, useValue: auth }, { provide: AppStore, deps: [] }],
  });
  const store = injector.get(AppStore);
  await store.load();
  repo.calls = [];
  return { store, repo };
}

describe('deleting a goal', () => {
  let store: AppStore;
  let repo: FakeRepo;

  beforeEach(async () => {
    ({ store, repo } = await storeWith({
      goals: [goal('massa', { shape: 'long' }), goal('proteina', { parentId: 'massa' }), goal('base')],
      entries: [entry('e1', 'massa', '2026-09-15'), entry('e2', 'proteina', '2026-09-15'), entry('e3', 'base', '2026-09-15')],
    }));
  });

  it('takes its own logged days and leaves everyone else alone', async () => {
    await store.deleteGoal(store.goal('massa')!);
    expect(store.goals().map((g) => g.id)).toEqual(['proteina', 'base']);
    expect(store.entries().map((e) => e.id)).toEqual(['e2', 'e3']);
    expect(store.saveError()).toBeNull();
  });

  it('keeps the goals that were inside it, detached', async () => {
    await store.deleteGoal(store.goal('massa')!);
    expect(store.goal('proteina')!.parentId).toBeNull();
  });

  it('detaches the children before the parent row goes', async () => {
    await store.deleteGoal(store.goal('massa')!);
    expect(repo.calls).toEqual(['upsertGoal:proteina', 'deleteGoal:massa']);
  });

  it('puts everything back when the write fails', async () => {
    repo.failOn = 'deleteGoal:massa';
    await store.deleteGoal(store.goal('massa')!);
    expect(store.goals().map((g) => g.id)).toEqual(['massa', 'proteina', 'base']);
    expect(store.goal('proteina')!.parentId).toBe('massa');
    expect(store.entries().map((e) => e.id)).toEqual(['e1', 'e2', 'e3']);
    expect(store.saveError()?.message).toBe("Couldn't save that.");
  });
});

describe('deleting an exercise', () => {
  it('comes out of every workout that used it, and past sessions survive', async () => {
    const { store, repo } = await storeWith({
      exercises: [exercise('agach'), exercise('supino')],
      workouts: [workout('A', ['agach', 'supino']), workout('B', ['supino'])],
      sessions: [session('s1', 'A', ['agach', 'supino'])],
    });

    await store.deleteExercise(store.exercises().find((e) => e.id === 'supino')!);

    expect(store.exercises().map((e) => e.id)).toEqual(['agach']);
    expect(store.workouts().find((w) => w.id === 'A')!.exercises.map((e) => e.exerciseId)).toEqual(['agach']);
    expect(store.workouts().find((w) => w.id === 'B')!.exercises).toEqual([]);
    expect(store.sessions()[0].exercises.map((e) => e.exerciseId)).toEqual(['agach', 'supino']);
    expect(repo.calls).toEqual(['upsertWorkout:A', 'upsertWorkout:B', 'deleteExercise:supino']);
  });

  it('puts the workouts back when the write fails', async () => {
    const { store, repo } = await storeWith({
      exercises: [exercise('agach'), exercise('supino')],
      workouts: [workout('A', ['agach', 'supino'])],
    });
    repo.failOn = 'deleteExercise:supino';

    await store.deleteExercise(store.exercises().find((e) => e.id === 'supino')!);

    expect(store.exercises().map((e) => e.id)).toEqual(['agach', 'supino']);
    expect(store.workouts()[0].exercises.map((e) => e.exerciseId)).toEqual(['agach', 'supino']);
  });
});

describe('deleting a workout', () => {
  it('keeps the sessions done from it, minus the link', async () => {
    const { store, repo } = await storeWith({
      exercises: [exercise('agach')],
      workouts: [workout('A', ['agach'])],
      sessions: [session('s1', 'A', ['agach']), session('s2', null, ['agach'])],
    });

    await store.deleteWorkout(store.workouts()[0]);

    expect(store.workouts()).toEqual([]);
    expect(store.sessions().map((s) => s.id)).toEqual(['s1', 's2']);
    expect(store.sessions()[0].workoutId).toBeNull();
    expect(store.sessions()[0].workoutName).toBe('A');
    expect(repo.calls).toEqual(['deleteWorkout:A']);
  });

  it('leaves the exercise library alone', async () => {
    const { store } = await storeWith({ exercises: [exercise('agach')], workouts: [workout('A', ['agach'])] });
    await store.deleteWorkout(store.workouts()[0]);
    expect(store.exercises().map((e) => e.id)).toEqual(['agach']);
  });
});

describe('what the confirmation says', () => {
  it('counts the goals inside a long goal, not days it was never ticked', () => {
    const goals = [goal('massa', { shape: 'long' }), goal('proteina', { parentId: 'massa' }), goal('pesar', { parentId: 'massa' })];
    expect(goalDeleteDetail(goals[0], goals, [])).toBe(
      '2 goals inside it stay, on their own. This cannot be undone.',
    );
  });

  it('counts the logged days of a scheduled goal', () => {
    const g = goal('base');
    const entries = [entry('e1', 'base', '2026-09-14'), entry('e2', 'base', '2026-09-15')];
    expect(goalDeleteDetail(g, [g], entries)).toBe('2 logged days go with it. This cannot be undone.');
  });

  it('has something to say about an empty long goal', () => {
    const g = goal('massa', { shape: 'long' });
    expect(goalDeleteDetail(g, [g], [])).toBe('Nothing else changes. This cannot be undone.');
  });

  it('says plainly when a goal has no history', () => {
    const g = goal('base');
    expect(goalDeleteDetail(g, [g], [])).toBe('Nothing has been logged against it. This cannot be undone.');
  });

  it('names the workouts an exercise leaves and the sessions that stay', () => {
    const ex = exercise('supino');
    const workouts = [workout('A', ['supino'])];
    const sessions = [session('s1', 'A', ['supino'])];
    expect(exerciseDeleteDetail(ex, workouts, sessions)).toBe(
      'It comes out of 1 workout. 1 past session keeps its history. This cannot be undone.',
    );
  });

  it('tells you the exercises stay when a workout goes', () => {
    const w = workout('A', ['agach', 'supino']);
    expect(workoutDeleteDetail(w, [session('s1', 'A', ['agach'])])).toBe(
      '2 exercises stay in your library. 1 past session keeps its history. This cannot be undone.',
    );
  });

  it('agrees with a single logged day and a single child', () => {
    const goals = [goal('massa'), goal('proteina', { parentId: 'massa' })];
    expect(goalDeleteDetail(goals[0], goals, [entry('e1', 'massa', '2026-09-14')])).toBe(
      '1 logged day goes with it. The goal inside it stays, on its own. This cannot be undone.',
    );
  });
});

/* The store harness above is also the right place to pin down which goal a session ticks. */
describe('finishing a session', () => {
  const exerciseGoal = (id: string) => goal(id, { isExercise: true });
  // Dated today: the store closes older open sessions itself at load, as if midnight had passed.
  const openSession = (id: string, goalId: string | null): Session => ({ ...session(id, null, ['bench']), goalId, date: todayLocal(), endedAt: null, closedBy: null });

  it('ticks only the goal it was started from', async () => {
    const { store } = await storeWith({ goals: [exerciseGoal('base'), exerciseGoal('ginasio')], sessions: [openSession('s1', 'ginasio')] });
    await store.finishSession('s1');
    expect(store.entries().map((e) => e.goalId)).toEqual(['ginasio']);
  });

  it('ticks the goal chosen on finish and remembers it', async () => {
    const { store } = await storeWith({ goals: [exerciseGoal('base'), exerciseGoal('ginasio')], sessions: [openSession('s1', null)] });
    await store.finishSession('s1', 'user', 'base');
    expect(store.entries().map((e) => e.goalId)).toEqual(['base']);
    expect(store.session('s1')!.goalId).toBe('base');
  });

  it('ticks nothing when no goal is chosen', async () => {
    const { store } = await storeWith({ goals: [exerciseGoal('base'), exerciseGoal('ginasio')], sessions: [openSession('s1', null)] });
    await store.finishSession('s1', 'user', null);
    expect(store.entries()).toEqual([]);
    expect(store.session('s1')!.endedAt).not.toBeNull();
  });

  it('at midnight, an unlinked session counts for the only exercise goal, and for none of several', async () => {
    const one = await storeWith({ goals: [exerciseGoal('base'), goal('read')], sessions: [openSession('s1', null)] });
    await one.store.finishSession('s1', 'midnight');
    expect(one.store.entries().map((e) => e.goalId)).toEqual(['base']);

    const many = await storeWith({ goals: [exerciseGoal('base'), exerciseGoal('ginasio')], sessions: [openSession('s1', null)] });
    await many.store.finishSession('s1', 'midnight');
    expect(many.store.entries()).toEqual([]);
  });

  it('never ticks a paused or non-exercise goal', async () => {
    const { store } = await storeWith({
      goals: [goal('paused', { isExercise: true, state: 'paused', pauses: [{ from: '2026-09-14', to: null }] })],
      sessions: [openSession('s1', 'paused')],
    });
    await store.finishSession('s1');
    expect(store.entries()).toEqual([]);
  });

  it('drops the link when the goal is deleted, keeping the session', async () => {
    const { store } = await storeWith({ goals: [exerciseGoal('ginasio')], sessions: [{ ...session('s1', null, ['bench']), goalId: 'ginasio' }] });
    await store.deleteGoal(store.goal('ginasio')!);
    expect(store.session('s1')!.goalId).toBeNull();
  });
});
