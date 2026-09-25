import { computed, inject, Injectable, signal } from '@angular/core';
import { AUTH } from './auth';
import { addDays, msUntilMidnight, todayLocal } from './dates';
import { entryFor, exerciseGoalsOn } from './goals';
import { newId } from './ids';
import type { Exercise, Goal, GoalEntry, LocalDate, Profile, Session, Workout } from './model';
import { OfflineError, REPO } from './repo';
import { resumeSession } from './sessions';

interface Action {
  /** Apply optimistically; return how to undo it. */
  apply: () => () => void;
  persist: () => Promise<void>;
}

export interface SaveFailure {
  message: string;
  retry: () => Promise<void>;
}

/**
 * All app state as signals. Writes are optimistic: the UI updates first, the
 * repo is written, and on failure the change is rolled back with a visible
 * "try again" state. Online-only by design (see spec §8).
 */
@Injectable({ providedIn: 'root' })
export class AppStore {
  private repo = inject(REPO);
  private auth = inject(AUTH);

  readonly today = signal<LocalDate>(todayLocal());
  readonly loaded = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly saveError = signal<SaveFailure | null>(null);

  readonly profile = signal<Profile | null>(null);
  readonly goals = signal<Goal[]>([]);
  readonly entries = signal<GoalEntry[]>([]);
  readonly exercises = signal<Exercise[]>([]);
  readonly workouts = signal<Workout[]>([]);
  readonly sessions = signal<Session[]>([]);

  readonly openSession = computed(() => this.sessions().find((s) => s.endedAt === null) ?? null);
  readonly activeGoals = computed(() => this.goals().filter((g) => g.state === 'active'));
  readonly activeWorkouts = computed(() => this.workouts().filter((w) => !w.archived));
  readonly activeExercises = computed(() => this.exercises().filter((e) => !e.archived));

  private midnightTimer: ReturnType<typeof setTimeout> | null = null;
  private loadedFor: string | null = null;
  private inflight: Promise<void> | null = null;

  private get userId(): string {
    const u = this.auth.user();
    if (!u) throw new Error('Not signed in');
    return u.id;
  }

  load(): Promise<void> {
    const uid = this.userId;
    if (this.loadedFor === uid && this.loaded()) return Promise.resolve();
    if (!this.inflight) this.inflight = this.doLoad(uid).finally(() => (this.inflight = null));
    return this.inflight;
  }

  private async doLoad(uid: string): Promise<void> {
    this.loadError.set(null);
    try {
      const s = await this.repo.loadAll(uid);
      this.profile.set(s.profile);
      this.goals.set(s.goals);
      this.entries.set(s.entries);
      this.exercises.set(s.exercises);
      this.workouts.set(s.workouts);
      this.sessions.set(s.sessions);
      this.loaded.set(true);
      this.loadedFor = uid;
      await this.rollDay();
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      this.loadError.set(e instanceof OfflineError ? "You're offline. Try again when you're back." : `Couldn't load your goals. ${detail}`);
    }
  }

  reset(): void {
    this.loaded.set(false);
    this.loadedFor = null;
    this.profile.set(null);
    this.goals.set([]);
    this.entries.set([]);
    this.exercises.set([]);
    this.workouts.set([]);
    this.sessions.set([]);
    this.saveError.set(null);
    if (this.midnightTimer) clearTimeout(this.midnightTimer);
  }

  /** Refresh "today", close sessions left open past midnight, and schedule the next roll. */
  private async rollDay(): Promise<void> {
    this.today.set(todayLocal());
    const stale = this.sessions().filter((s) => s.endedAt === null && s.date < this.today());
    for (const s of stale) await this.finishSession(s.id, 'midnight');
    if (this.midnightTimer) clearTimeout(this.midnightTimer);
    this.midnightTimer = setTimeout(() => void this.rollDay(), msUntilMidnight());
  }

  private async commit(action: Action): Promise<void> {
    const revert = action.apply();
    this.saveError.set(null);
    try {
      await action.persist();
    } catch (e) {
      revert();
      const message = e instanceof OfflineError ? "You're offline. Nothing was saved." : "Couldn't save that.";
      this.saveError.set({ message, retry: () => this.commit(action) });
    }
  }

  private replace<T extends { id: string }>(list: ReturnType<typeof signal<T[]>>, item: T): () => void {
    const before = list();
    const i = before.findIndex((x) => x.id === item.id);
    list.set(i >= 0 ? before.map((x) => (x.id === item.id ? item : x)) : [...before, item]);
    return () => list.set(before);
  }

  /* ---------- goals ---------- */

  goal(id: string): Goal | undefined {
    return this.goals().find((g) => g.id === id);
  }

  saveGoal(goal: Goal): Promise<void> {
    const uid = this.userId;
    return this.commit({ apply: () => this.replace(this.goals, goal), persist: () => this.repo.upsertGoal(uid, goal) });
  }

  /** Tick or untick a goal for a date. Replaces a skip. */
  setDone(goalId: string, date: LocalDate, done: boolean): Promise<void> {
    const uid = this.userId;
    const existing = entryFor(this.entries(), goalId, date);
    if (done) {
      const entry: GoalEntry = { id: existing?.id ?? newId(), goalId, date, kind: 'done', loggedAt: new Date().toISOString() };
      return this.commit({ apply: () => this.replace(this.entries, entry), persist: () => this.repo.upsertEntry(uid, entry) });
    }
    if (!existing) return Promise.resolve();
    return this.commit({
      apply: () => {
        const before = this.entries();
        this.entries.set(before.filter((e) => e.id !== existing.id));
        return () => this.entries.set(before);
      },
      persist: () => this.repo.deleteEntry(uid, existing.id),
    });
  }

  /** Dismiss a goal for today. Never counts toward anything. */
  skip(goalId: string, date: LocalDate): Promise<void> {
    const uid = this.userId;
    const existing = entryFor(this.entries(), goalId, date);
    const entry: GoalEntry = { id: existing?.id ?? newId(), goalId, date, kind: 'skip', loggedAt: new Date().toISOString() };
    return this.commit({ apply: () => this.replace(this.entries, entry), persist: () => this.repo.upsertEntry(uid, entry) });
  }

  unskip(goalId: string, date: LocalDate): Promise<void> {
    return this.setDone(goalId, date, false);
  }

  pause(goal: Goal): Promise<void> {
    const today = this.today();
    return this.saveGoal({ ...goal, state: 'paused', pauses: [...goal.pauses, { from: today, to: null }] });
  }

  resume(goal: Goal): Promise<void> {
    const today = this.today();
    const pauses = goal.pauses.map((p) => (p.to === null ? { ...p, to: today } : p)).filter((p) => p.from < p.to!);
    return this.saveGoal({ ...goal, state: 'active', pauses });
  }

  archiveGoal(goal: Goal): Promise<void> {
    return this.saveGoal({ ...goal, state: 'archived', archivedOn: this.today() });
  }

  restoreGoal(goal: Goal): Promise<void> {
    return this.saveGoal({ ...goal, state: 'active', archivedOn: null });
  }

  /**
   * Permanent. The goal and every day logged against it go. Goals that sat
   * inside a long goal survive on their own: they are separate goals, and
   * losing one shell should not take them with it. Sessions that counted for
   * it stay, and just lose the link.
   */
  deleteGoal(goal: Goal): Promise<void> {
    const uid = this.userId;
    const detached = this.goals().filter((g) => g.parentId === goal.id).map((g) => ({ ...g, parentId: null }));
    return this.commit({
      apply: () => {
        const goals = this.goals();
        const entries = this.entries();
        const sessions = this.sessions();
        const byId = new Map(detached.map((g) => [g.id, g]));
        this.goals.set(goals.filter((g) => g.id !== goal.id).map((g) => byId.get(g.id) ?? g));
        this.entries.set(entries.filter((e) => e.goalId !== goal.id));
        this.sessions.set(sessions.map((s) => (s.goalId === goal.id ? { ...s, goalId: null } : s)));
        return () => { this.goals.set(goals); this.entries.set(entries); this.sessions.set(sessions); };
      },
      persist: async () => {
        for (const child of detached) await this.repo.upsertGoal(uid, child);
        await this.repo.deleteGoal(uid, goal.id);
      },
    });
  }

  /* ---------- workouts & exercises ---------- */

  saveExercise(exercise: Exercise): Promise<void> {
    const uid = this.userId;
    return this.commit({ apply: () => this.replace(this.exercises, exercise), persist: () => this.repo.upsertExercise(uid, exercise) });
  }

  /** Reuse an exercise by name (case-insensitive) or create it inline. */
  async ensureExercise(name: string, kind: Exercise['kind'] = 'reps'): Promise<Exercise> {
    const trimmed = name.trim();
    const found = this.exercises().find((e) => e.name.toLowerCase() === trimmed.toLowerCase());
    if (found) {
      if (found.archived) await this.saveExercise({ ...found, archived: false });
      return found;
    }
    const ex: Exercise = { id: newId(), name: trimmed, kind, restSeconds: null, primaryMuscle: null, secondaryMuscles: [], archived: false };
    await this.saveExercise(ex);
    return ex;
  }

  /**
   * Permanent. The exercise leaves the library and every workout that used it.
   * Past sessions keep their own copy of the name, kind and sets, so history
   * still reads correctly.
   */
  deleteExercise(exercise: Exercise): Promise<void> {
    const uid = this.userId;
    const stripped = this.workouts()
      .filter((w) => w.exercises.some((e) => e.exerciseId === exercise.id))
      .map((w) => ({ ...w, exercises: w.exercises.filter((e) => e.exerciseId !== exercise.id) }));
    return this.commit({
      apply: () => {
        const exercises = this.exercises();
        const workouts = this.workouts();
        const byId = new Map(stripped.map((w) => [w.id, w]));
        this.exercises.set(exercises.filter((e) => e.id !== exercise.id));
        this.workouts.set(workouts.map((w) => byId.get(w.id) ?? w));
        return () => { this.exercises.set(exercises); this.workouts.set(workouts); };
      },
      persist: async () => {
        for (const w of stripped) await this.repo.upsertWorkout(uid, w);
        await this.repo.deleteExercise(uid, exercise.id);
      },
    });
  }

  saveWorkout(workout: Workout): Promise<void> {
    const uid = this.userId;
    return this.commit({ apply: () => this.replace(this.workouts, workout), persist: () => this.repo.upsertWorkout(uid, workout) });
  }

  /**
   * Permanent. The template goes; sessions done from it stay, keeping their
   * name and sets but losing the link back.
   */
  deleteWorkout(workout: Workout): Promise<void> {
    const uid = this.userId;
    return this.commit({
      apply: () => {
        const workouts = this.workouts();
        const sessions = this.sessions();
        this.workouts.set(workouts.filter((w) => w.id !== workout.id));
        this.sessions.set(sessions.map((s) => (s.workoutId === workout.id ? { ...s, workoutId: null } : s)));
        return () => { this.workouts.set(workouts); this.sessions.set(sessions); };
      },
      persist: () => this.repo.deleteWorkout(uid, workout.id),
    });
  }

  session(id: string): Session | undefined {
    return this.sessions().find((s) => s.id === id);
  }

  /** Every set saves immediately: this is called on each tick and edit. */
  saveSession(session: Session): Promise<void> {
    const uid = this.userId;
    return this.commit({ apply: () => this.replace(this.sessions, session), persist: () => this.repo.upsertSession(uid, session) });
  }

  /** `goalId` is the exercise goal the session counts for, when it was started from one. */
  async startSession(workout: Workout | null, exercises: Session['exercises'], goalId: string | null = null): Promise<Session> {
    const now = new Date();
    const session: Session = {
      id: newId(), workoutId: workout?.id ?? null, workoutName: workout?.name ?? 'Freestyle', goalId,
      date: todayLocal(now), startedAt: now.toISOString(), endedAt: null, closedBy: null,
      pausedAt: null, pausedSeconds: 0, exercises,
    };
    await this.saveSession(session);
    return session;
  }

  /** Point an open session at a goal, e.g. when it is resumed from that goal on Today. */
  linkSession(id: string, goalId: string): Promise<void> {
    const s = this.session(id);
    if (!s || s.goalId === goalId) return Promise.resolve();
    return this.saveSession({ ...s, goalId });
  }

  /**
   * Close a session as-is. It ticks the one goal it counts for: the goal it
   * was started from, or the one passed in here (chosen on Finish). A session
   * closed at midnight with no goal counts for the only exercise goal there
   * is; with several there is no way to know which, so none is ticked.
   */
  async finishSession(id: string, closedBy: Session['closedBy'] = 'user', goalId?: string | null): Promise<void> {
    const s = this.session(id);
    if (!s || s.endedAt) return;
    const endMs = closedBy === 'midnight' ? new Date(`${s.date}T23:59:59`).getTime() : Date.now();
    const closed = resumeSession(s, new Date(endMs));
    let linked = goalId === undefined ? s.goalId : goalId;
    if (linked === null && closedBy === 'midnight') {
      const candidates = exerciseGoalsOn(this.goals(), s.date);
      if (candidates.length === 1) linked = candidates[0].id;
    }
    await this.saveSession({ ...closed, endedAt: new Date(endMs).toISOString(), closedBy, goalId: linked });
    if (linked) await this.tickGoal(linked, s.date);
  }

  /** Tick a goal for a day, once: a second session on the same day changes nothing. */
  async tickGoal(goalId: string, date: LocalDate): Promise<void> {
    const g = this.goal(goalId);
    if (!g || !exerciseGoalsOn([g], date).length) return;
    if (entryFor(this.entries(), g.id, date)?.kind === 'done') return;
    await this.setDone(g.id, date, true);
  }

  /* ---------- profile ---------- */

  updateProfile(patch: Partial<Profile>): Promise<void> {
    const uid = this.userId;
    const before = this.profile();
    if (!before) return Promise.resolve();
    const next = { ...before, ...patch };
    return this.commit({
      apply: () => { this.profile.set(next); return () => this.profile.set(before); },
      persist: () => this.repo.updateProfile(uid, next),
    });
  }

  /** Convenience for "last done Fri" copy. */
  lastSessionDate(workoutId: string): LocalDate | null {
    const s = this.sessions().filter((x) => x.workoutId === workoutId && x.endedAt).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    return s?.date ?? null;
  }

  yesterday(): LocalDate {
    return addDays(this.today(), -1);
  }
}
