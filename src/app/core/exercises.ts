import { MUSCLE_LABELS, type Exercise, type ExerciseKind, type MuscleGroup } from './model';

export function kindLabel(kind: ExerciseKind): string {
  return kind === 'reps' ? 'Reps & weight' : 'Time';
}

/** "Chest (triceps, shoulders)" · "Chest" · "" when nothing is set. */
export function muscleSummary(ex: Pick<Exercise, 'primaryMuscle' | 'secondaryMuscles'>): string {
  const secondary = ex.secondaryMuscles.filter((m) => m !== ex.primaryMuscle).map((m) => MUSCLE_LABELS[m].toLowerCase());
  if (ex.primaryMuscle === null) return secondary.length ? capitalise(secondary.join(', ')) : '';
  const primary = MUSCLE_LABELS[ex.primaryMuscle];
  return secondary.length ? `${primary} (${secondary.join(', ')})` : primary;
}

/** The list row line: "Reps & weight · Chest (triceps)". Muscles are left out until they are set. */
export function exerciseMeta(ex: Exercise): string {
  const muscles = muscleSummary(ex);
  return muscles ? `${kindLabel(ex.kind)} · ${muscles}` : kindLabel(ex.kind);
}

/** Set or clear the primary muscle. It leaves the secondary list if it was there. */
export function withPrimary(ex: Exercise, muscle: MuscleGroup | null): Exercise {
  return { ...ex, primaryMuscle: muscle, secondaryMuscles: ex.secondaryMuscles.filter((m) => m !== muscle) };
}

/** Toggle a secondary muscle. The primary muscle can never be secondary too. */
export function toggleSecondary(ex: Exercise, muscle: MuscleGroup): Exercise {
  if (muscle === ex.primaryMuscle) return ex;
  const has = ex.secondaryMuscles.includes(muscle);
  return { ...ex, secondaryMuscles: has ? ex.secondaryMuscles.filter((m) => m !== muscle) : [...ex.secondaryMuscles, muscle] };
}

/** Case-insensitive match on name or muscle group, for the library picker. */
export function matchesQuery(ex: Exercise, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (ex.name.toLowerCase().includes(q)) return true;
  return [ex.primaryMuscle, ...ex.secondaryMuscles].some((m) => m !== null && MUSCLE_LABELS[m].toLowerCase().includes(q));
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
