import { describe, expect, it } from 'vitest';
import type { Session, SessionExercise, SessionSet } from './model';
import { allSetsDone, currentExercise, doneSetCount, isSessionPaused, lastTimeFor, nextExercise, pauseSession, resumeSession, sessionElapsedSeconds, sessionsForWorkout, touchedExercises } from './sessions';

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

describe('lastTimeFor', () => {
  /** A session on a day, with bench sets as "reps×weight", or "." for an open set. */
  function day(id: string, date: string, workoutName: string, ...sets: string[]): Session {
    const bench: SessionExercise = {
      exerciseId: 'bench', name: 'Bench press', kind: 'reps', restSeconds: 90,
      sets: sets.map((x) => {
        const [reps, weight] = x === '.' ? [null, null] : x.split('×').map(Number);
        return { target: { reps: 8, weight: 60, seconds: null }, reps, weight, seconds: null, doneAt: x === '.' ? null : `${date}T18:10:00.000Z` };
      }),
    };
    return { ...session(), id, date, workoutName, startedAt: `${date}T18:00:00.000Z`, exercises: [bench] };
  }

  it('is what was ticked the most recent time before this session, from any workout', () => {
    const older = day('a', '2026-09-14', 'Push day', '8×55', '8×55');
    const recent = day('b', '2026-09-21', 'Upper body', '8×60', '8×60', '7×60', '.');
    const now = day('c', '2026-09-28', 'Push day', '.', '.');
    const last = lastTimeFor([recent, now, older], now, 'bench');
    expect(last?.date).toBe('2026-09-21');
    expect(last?.workoutName).toBe('Upper body');
    expect(last?.kind).toBe('reps');
    expect(last?.sets.map((s) => `${s.reps}×${s.weight}`)).toEqual(['8×60', '8×60', '7×60']);
  });

  it('skips sessions where nothing was ticked for it', () => {
    const done = day('a', '2026-09-14', 'Push day', '8×55');
    const untouched = day('b', '2026-09-21', 'Push day', '.', '.');
    const now = day('c', '2026-09-28', 'Push day', '.');
    expect(lastTimeFor([done, untouched, now], now, 'bench')?.date).toBe('2026-09-14');
  });

  it('never counts this session or a later one', () => {
    const now = day('b', '2026-09-21', 'Push day', '8×60');
    const later = day('c', '2026-09-28', 'Push day', '8×65');
    expect(lastTimeFor([now, later], now, 'bench')).toBeNull();
  });

  it('is null the first time an exercise is done', () => {
    const now = day('a', '2026-09-28', 'Push day', '.');
    expect(lastTimeFor([now], now, 'bench')).toBeNull();
    expect(lastTimeFor([day('b', '2026-09-21', 'Push day', '8×60'), now], now, 'squat')).toBeNull();
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
