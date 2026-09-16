import { totalDone } from './goals';
import type { Exercise, Goal, GoalEntry, Session, Workout } from './model';
import { sessionsForExercise } from './sessions';

/**
 * Copy for the delete confirmation. Every line names what goes and what
 * survives, then closes on the warning: a permanent delete should never be
 * agreed to without the cost in front of you.
 */

export function goalDeleteDetail(goal: Goal, goals: Goal[], entries: GoalEntry[]): string {
  const children = goals.filter((g) => g.parentId === goal.id).length;
  const parts: string[] = [];
  // A long goal is never ticked day by day, so counting logged days would only confuse.
  if (goal.shape !== 'long') {
    const logged = totalDone(entries, goal.id);
    parts.push(
      logged === 0 ? 'Nothing has been logged against it'
        : logged === 1 ? '1 logged day goes with it'
        : `${logged} logged days go with it`,
    );
  }
  if (children) {
    parts.push(children === 1 ? 'The goal inside it stays, on its own' : `${children} goals inside it stay, on their own`);
  } else if (goal.shape === 'long') {
    parts.push('Nothing else changes');
  }
  return close(parts);
}

export function exerciseDeleteDetail(exercise: Exercise, workouts: Workout[], sessions: Session[]): string {
  const used = workouts.filter((w) => w.exercises.some((e) => e.exerciseId === exercise.id)).length;
  const done = sessionsForExercise(sessions, exercise.id).length;
  const parts: string[] = [];
  if (used) parts.push(used === 1 ? 'It comes out of 1 workout' : `It comes out of ${used} workouts`);
  parts.push(done === 0 ? 'Nothing has been logged against it' : keptSessions(done));
  return close(parts);
}

export function workoutDeleteDetail(workout: Workout, sessions: Session[]): string {
  const done = sessions.filter((s) => s.workoutId === workout.id).length;
  const kept = workout.exercises.length;
  const parts: string[] = [];
  if (kept) parts.push(kept === 1 ? '1 exercise stays in your library' : `${kept} exercises stay in your library`);
  if (done) parts.push(keptSessions(done));
  return close(parts);
}

function keptSessions(n: number): string {
  return n === 1 ? '1 past session keeps its history' : `${n} past sessions keep their history`;
}

function close(parts: string[]): string {
  return [...parts, 'This cannot be undone'].join('. ') + '.';
}
