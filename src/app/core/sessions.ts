import { APP_DEFAULT_REST_SECONDS, type Exercise, type ExerciseKind, type Session, type SessionExercise, type SessionSet, type SetTarget, type Workout } from './model';

/** Snapshot a workout template (or nothing, for freestyle) into a new session. */
export function buildSessionExercises(workout: Workout | null, library: Exercise[]): SessionExercise[] {
  if (!workout) return [];
  const out: SessionExercise[] = [];
  for (const we of workout.exercises) {
    const ex = library.find((e) => e.id === we.exerciseId);
    if (!ex) continue;
    out.push(snapshotExercise(ex, we.sets, workout.restSeconds));
  }
  return out;
}

export function snapshotExercise(ex: Exercise, sets: SetTarget[], workoutRest: number | null): SessionExercise {
  return {
    exerciseId: ex.id,
    name: ex.name,
    kind: ex.kind,
    restSeconds: workoutRest ?? ex.restSeconds ?? APP_DEFAULT_REST_SECONDS,
    sets: sets.map((t) => ({ target: { ...t }, reps: null, weight: null, seconds: null, doneAt: null })),
  };
}

export function emptySet(kind: ExerciseKind, like?: SetTarget): SessionSet {
  const target: SetTarget = like ? { ...like } : kind === 'reps'
    ? { reps: 10, weight: null, seconds: null }
    : { reps: null, weight: null, seconds: 60 };
  return { target, reps: null, weight: null, seconds: null, doneAt: null };
}

export function isExerciseDone(ex: SessionExercise): boolean {
  return ex.sets.length > 0 && ex.sets.every((s) => s.doneAt !== null);
}

export function doneSets(ex: SessionExercise): SessionSet[] {
  return ex.sets.filter((s) => s.doneAt !== null);
}

export function sessionProgress(s: Session): { done: number; total: number; current: number } {
  const done = s.exercises.filter(isExerciseDone).length;
  const current = s.exercises.findIndex((e) => !isExerciseDone(e));
  return { done, total: s.exercises.length, current };
}

export function nextOpenSet(ex: SessionExercise): number {
  return ex.sets.findIndex((s) => s.doneAt === null);
}

function num(n: number | null): string {
  return n === null ? '' : String(Number.isInteger(n) ? n : n.toFixed(1).replace(/\.0$/, ''));
}

/** "8 × 60" · "8 × 60 kg" · "8" · "60 s" */
export function formatSet(set: SessionSet, kind: ExerciseKind, opts: { unit?: boolean; target?: boolean } = {}): string {
  const src = opts.target ? set.target : { reps: set.reps, weight: set.weight, seconds: set.seconds };
  if (kind === 'time') return src.seconds === null ? '' : `${num(src.seconds)} s`;
  const reps = src.reps === null ? '' : num(src.reps);
  if (src.weight === null) return reps;
  return `${reps} × ${num(src.weight)}${opts.unit ? ' kg' : ''}`;
}

export function formatTarget(t: SetTarget, kind: ExerciseKind): string {
  if (kind === 'time') return t.seconds === null ? '' : `${num(t.seconds)} s`;
  const reps = t.reps === null ? '' : num(t.reps);
  return t.weight === null ? reps : `${reps} × ${num(t.weight)} kg`;
}

/** Sessions that touched this exercise (at least one ticked set), newest first. */
export function sessionsForExercise(sessions: Session[], exerciseId: string): Session[] {
  return sessions
    .filter((s) => s.exercises.some((e) => e.exerciseId === exerciseId && doneSets(e).length > 0))
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
}

/** Heaviest ticked set (reps exercises) or longest hold (time exercises). */
export function bestSet(sessions: Session[], exerciseId: string, kind: ExerciseKind): SessionSet | null {
  let best: SessionSet | null = null;
  for (const s of sessions) {
    for (const e of s.exercises) {
      if (e.exerciseId !== exerciseId) continue;
      for (const set of doneSets(e)) {
        if (!best) { best = set; continue; }
        if (kind === 'reps') {
          const a = set.weight ?? -1, b = best.weight ?? -1;
          if (a > b || (a === b && (set.reps ?? 0) > (best.reps ?? 0))) best = set;
        } else if ((set.seconds ?? 0) > (best.seconds ?? 0)) best = set;
      }
    }
  }
  return best;
}

export function isBestInSession(ex: SessionExercise, set: SessionSet): boolean {
  const sets = doneSets(ex);
  if (sets.length < 2) return false;
  const score = (s: SessionSet) => (ex.kind === 'reps' ? (s.weight ?? -1) * 1000 + (s.reps ?? 0) : s.seconds ?? 0);
  const top = Math.max(...sets.map(score));
  return score(set) === top && sets.filter((s) => score(s) === top).length === 1;
}

export function setCount(w: Workout): number {
  return w.exercises.reduce((n, e) => n + e.sets.length, 0);
}
