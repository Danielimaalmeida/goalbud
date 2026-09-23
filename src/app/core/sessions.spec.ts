import { describe, expect, it } from 'vitest';
import type { Session, SessionExercise, SessionSet } from './model';
import { allSetsDone, currentExercise, isSessionPaused, nextExercise, pauseSession, resumeSession, sessionElapsedSeconds } from './sessions';

function set(done: boolean): SessionSet {
  return { target: { reps: 8, weight: null, seconds: null }, reps: null, weight: null, seconds: null, doneAt: done ? '2026-09-18T18:10:00.000Z' : null };
}
/** One exercise per string: each character is a set, "x" ticked, "." open. */
function session(...exercises: string[]): Session {
  const list: SessionExercise[] = exercises.map((sets, i) => ({
    exerciseId: `e${i}`, name: `e${i}`, kind: 'reps', restSeconds: 90, sets: [...sets].map((c) => set(c === 'x')),
  }));
  return { id: 's', workoutId: null, workoutName: 'Freestyle', goalId: null, date: '2026-09-18', startedAt: '2026-09-18T18:00:00.000Z', endedAt: null, closedBy: null, pausedAt: null, pausedSeconds: 0, exercises: list };
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

describe('pausing a session', () => {
  const at = (iso: string) => new Date(iso);
  const running = (pausedSeconds = 0, pausedAt: string | null = null): Session =>
    ({ ...session(), startedAt: '2026-09-18T18:00:00.000Z', pausedSeconds, pausedAt });

  it('leaves paused spans out of the elapsed time', () => {
    const s = running(300);
    expect(sessionElapsedSeconds(s, at('2026-09-18T18:10:00.000Z').getTime())).toBe(300);
  });

  it('reports a frozen total while paused', () => {
    const s = running(0, '2026-09-18T18:05:00.000Z');
    expect(isSessionPaused(s)).toBe(true);
    expect(sessionElapsedSeconds(s, at('2026-09-18T18:20:00.000Z').getTime())).toBe(300);
  });

  it('pauses once, resumes into the count, and carries on', () => {
    const p = pauseSession(running(), at('2026-09-18T18:05:00.000Z'));
    expect(p.pausedAt).toBe('2026-09-18T18:05:00.000Z');
    expect(pauseSession(p, at('2026-09-18T18:06:00.000Z')).pausedAt).toBe('2026-09-18T18:05:00.000Z');

    const r = resumeSession(p, at('2026-09-18T18:07:00.000Z'));
    expect(r.pausedAt).toBeNull();
    expect(r.pausedSeconds).toBe(120);
    expect(sessionElapsedSeconds(r, at('2026-09-18T18:10:00.000Z').getTime())).toBe(480);
  });

  it('never pauses a closed session', () => {
    const closed: Session = { ...running(), endedAt: '2026-09-18T19:00:00.000Z', closedBy: 'user' };
    expect(pauseSession(closed, at('2026-09-18T18:30:00.000Z'))).toBe(closed);
    expect(isSessionPaused(closed)).toBe(false);
  });

  it('reads a session saved before the pause fields as running', () => {
    const legacy = { ...session(), pausedAt: undefined, pausedSeconds: undefined } as unknown as Session;
    expect(isSessionPaused(legacy)).toBe(false);
    expect(sessionElapsedSeconds(legacy, at('2026-09-18T18:10:00.000Z').getTime())).toBe(600);
  });
});
