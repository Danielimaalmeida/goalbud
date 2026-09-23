import { describe, expect, it } from 'vitest';
import type { Session, SessionExercise, SessionSet } from './model';
import { allSetsDone, currentExercise, doneSetCount, nextExercise, sessionsForWorkout, touchedExercises } from './sessions';

function set(done: boolean): SessionSet {
  return { target: { reps: 8, weight: null, seconds: null }, reps: null, weight: null, seconds: null, doneAt: done ? '2026-09-18T18:10:00.000Z' : null };
}
/** One exercise per string: each character is a set, "x" ticked, "." open. */
function session(...exercises: string[]): Session {
  const list: SessionExercise[] = exercises.map((sets, i) => ({
    exerciseId: `e${i}`, name: `e${i}`, kind: 'reps', restSeconds: 90, sets: [...sets].map((c) => set(c === 'x')),
  }));
  return { id: 's', workoutId: null, workoutName: 'Freestyle', goalId: null, date: '2026-09-18', startedAt: '2026-09-18T18:00:00.000Z', endedAt: null, closedBy: null, exercises: list };
}

describe('currentExercise', () => {
  it('defaults to the first exercise with sets left', () => {
    expect(currentExercise(session('xx', '..', '..'), null)).toBe(1);
  });
  it('keeps the exercise the user picked while it has sets left', () => {
    expect(currentExercise(session('..', '..', 'x.'), 2)).toBe(2);
  });
  it('moves on to the next open exercise after the picked one finishes', () => {
    expect(currentExercise(session('..', 'xx', '..'), 1)).toBe(2);
  });
  it('wraps back to the first open exercise when nothing is left after the picked one', () => {
    expect(currentExercise(session('..', 'xx', 'xx'), 2)).toBe(0);
  });
  it('ignores a picked index that no longer exists', () => {
    expect(currentExercise(session('..'), 5)).toBe(0);
  });
  it('is -1 once everything is done', () => {
    expect(currentExercise(session('xx', 'xx'), 0)).toBe(-1);
    expect(currentExercise(session(), null)).toBe(-1);
  });
});

describe('nextExercise', () => {
  it('is the next open one after the current, skipping finished ones', () => {
    expect(nextExercise(session('..', 'xx', '..'), 0)).toBe(2);
  });
  it('wraps round to an earlier open exercise', () => {
    expect(nextExercise(session('..', 'xx', '..'), 2)).toBe(0);
  });
  it('is -1 when the current one is the only one left', () => {
    expect(nextExercise(session('xx', '..'), 1)).toBe(-1);
  });
});

describe('allSetsDone', () => {
  it('counts the set about to be ticked', () => {
    const s = session('xx', 'x.');
    expect(allSetsDone(s)).toBe(false);
    expect(allSetsDone(s, { i: 1, j: 1 })).toBe(true);
    expect(allSetsDone(s, { i: 0, j: 0 })).toBe(false);
  });
});

/** One session from a workout (or freestyle), with a given start time and set states. */
function from(workoutId: string | null, startedAt: string, ...exercises: string[]): Session {
  const s = session(...exercises);
  return { ...s, id: startedAt, workoutId, workoutName: workoutId ? 'Push day' : 'Freestyle', startedAt };
}

describe('sessionsForWorkout', () => {
  it('keeps only sessions done from this workout, newest first', () => {
    const older = from('w1', '2026-09-10T18:00:00.000Z', 'xx');
    const newer = from('w1', '2026-09-18T18:00:00.000Z', 'xx');
    const other = from('w2', '2026-09-20T18:00:00.000Z', 'xx');
    const freestyle = from(null, '2026-09-21T18:00:00.000Z', 'xx');
    const found = sessionsForWorkout([older, other, newer, freestyle], 'w1');
    expect(found.map((s) => s.id)).toEqual([newer.id, older.id]);
  });
  it('leaves out sessions with nothing ticked', () => {
    const nothing = from('w1', '2026-09-18T18:00:00.000Z', '..');
    expect(sessionsForWorkout([nothing], 'w1')).toEqual([]);
  });
  it('keeps a session when only some sets were ticked', () => {
    const partial = from('w1', '2026-09-18T18:00:00.000Z', 'x.', '..');
    expect(sessionsForWorkout([partial], 'w1').map((s) => s.id)).toEqual([partial.id]);
  });
});

describe('touchedExercises and doneSetCount', () => {
  it('lists only the exercises with a ticked set and counts the sets', () => {
    const s = from('w1', '2026-09-18T18:00:00.000Z', 'x.', '..', 'xx');
    expect(touchedExercises(s).map((e) => e.exerciseId)).toEqual(['e0', 'e2']);
    expect(doneSetCount(s)).toBe(3);
  });
  it('is empty with a zero count when nothing was ticked', () => {
    const s = from('w1', '2026-09-18T18:00:00.000Z', '..', '.');
    expect(touchedExercises(s)).toEqual([]);
    expect(doneSetCount(s)).toBe(0);
  });
});
