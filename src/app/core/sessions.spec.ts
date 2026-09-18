import { describe, expect, it } from 'vitest';
import type { Session, SessionExercise, SessionSet } from './model';
import { allSetsDone, currentExercise, nextExercise } from './sessions';

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
