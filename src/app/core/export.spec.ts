import { describe, expect, it } from 'vitest';
import { buildWorkoutExport, rangeStart, sessionsToExport, type ExportInput } from './export';
import type { Exercise, Session, SessionSet, Workout } from './model';

const bench: Exercise = { id: 'bench', name: 'Bench press', kind: 'reps', restSeconds: 90, primaryMuscle: 'chest', secondaryMuscles: ['triceps'], archived: false };
const plank: Exercise = { id: 'plank', name: 'Plank', kind: 'time', restSeconds: 60, primaryMuscle: 'core', secondaryMuscles: [], archived: false };
const push: Workout = {
  id: 'w1', name: 'Push day', restSeconds: null, archived: false,
  exercises: [
    { exerciseId: 'bench', sets: [{ reps: 8, weight: 60, seconds: null }, { reps: 8, weight: 60, seconds: null }] },
    { exerciseId: 'plank', sets: [{ reps: null, weight: null, seconds: 60 }] },
  ],
};

const tick = (reps: number | null, weight: number | null, seconds: number | null, t: Partial<SessionSet['target']> = {}): SessionSet => ({
  target: { reps: 8, weight: 60, seconds: null, ...t }, reps, weight, seconds, doneAt: '2026-09-10T18:20:00.000Z',
});
const open = (): SessionSet => ({ target: { reps: 8, weight: 60, seconds: null }, reps: null, weight: null, seconds: null, doneAt: null });

function session(id: string, date: string, sets: SessionSet[], over: Partial<Session> = {}): Session {
  return {
    id, workoutId: 'w1', workoutName: 'Push day', goalId: null, date,
    startedAt: `${date}T18:00:00.000Z`, endedAt: `${date}T18:45:00.000Z`, closedBy: 'user', pausedAt: null, pausedSeconds: 0,
    exercises: [{ exerciseId: 'bench', name: 'Bench press', kind: 'reps', restSeconds: 90, sets }],
    ...over,
  };
}

const base: ExportInput = { workouts: [push], exercises: [bench, plank], sessions: [], today: '2026-10-01', range: 'all', workoutId: null };

describe('buildWorkoutExport', () => {
  it('writes the plan and the sets that were done, oldest session first', () => {
    const text = buildWorkoutExport({
      ...base,
      sessions: [
        session('s2', '2026-09-24', [tick(8, 62.5, null), tick(7, 62.5, null)]),
        session('s1', '2026-09-10', [tick(8, 60, null), tick(8, 60, null)]),
      ],
    });
    expect(text).toContain('## Workout plans');
    expect(text).toContain('- Bench press (Reps & weight; Chest (triceps)): 8 × 60 kg, 8 × 60 kg');
    expect(text).toContain('- Plank (Time; Core): 60 s');
    expect(text).toContain('2 sessions');
    expect(text.indexOf('2026-09-10 (Thu)')).toBeLessThan(text.indexOf('2026-09-24 (Thu)'));
    expect(text).toContain('### 2026-09-10 (Thu) · Push day · 45 min · 2 sets');
    expect(text).toContain('- Bench press (Chest (triceps)): 8 × 60 kg, 8 × 60 kg\n');
  });

  it('shows planned values only when they differ, and flags unticked sets', () => {
    const text = buildWorkoutExport({
      ...base,
      sessions: [session('s1', '2026-09-24', [tick(8, 62.5, null), open()])],
    });
    expect(text).toContain('8 × 62.5 kg [1 of 2 sets done] | planned: 8 × 60 kg, 8 × 60 kg');
  });

  it('labels bare rep counts and time sets', () => {
    const text = buildWorkoutExport({
      ...base,
      sessions: [session('s1', '2026-09-24', [tick(12, null, null, { weight: null })], {
        exercises: [
          { exerciseId: 'bench', name: 'Push-up', kind: 'reps', restSeconds: 60, sets: [tick(12, null, null, { reps: 12, weight: null })] },
          { exerciseId: 'plank', name: 'Plank', kind: 'time', restSeconds: 60, sets: [{ target: { reps: null, weight: null, seconds: 60 }, reps: null, weight: null, seconds: 75, doneAt: 'x' }] },
        ],
      })],
    });
    expect(text).toContain('Push-up (Chest (triceps)): 12 reps');
    expect(text).toContain('Plank (Core): 75 s | planned: 60 s');
  });

  it('leaves out sessions with nothing ticked and marks open ones', () => {
    const text = buildWorkoutExport({
      ...base,
      sessions: [
        session('empty', '2026-09-20', [open()]),
        session('live', '2026-09-30', [tick(8, 60, null)], { endedAt: null, closedBy: null }),
      ],
    });
    expect(text).not.toContain('2026-09-20');
    expect(text).toContain('2026-09-30 (Wed) · Push day · still open · 1 set');
  });

  it('applies the range', () => {
    const sessions = [session('old', '2026-06-01', [tick(8, 60, null)]), session('new', '2026-09-24', [tick(8, 60, null)])];
    expect(rangeStart('4w', '2026-10-01')).toBe('2026-09-04');
    expect(sessionsToExport({ ...base, sessions, range: '4w' }).map((s) => s.id)).toEqual(['new']);
    expect(sessionsToExport({ ...base, sessions, range: 'all' }).map((s) => s.id)).toEqual(['old', 'new']);
    expect(buildWorkoutExport({ ...base, sessions: [sessions[0]], range: '4w' })).toContain('No sessions in this range.');
  });

  it('limits to one workout, leaving freestyle sessions out', () => {
    const other: Workout = { ...push, id: 'w2', name: 'Pull day' };
    const text = buildWorkoutExport({
      ...base,
      workouts: [push, other],
      workoutId: 'w2',
      sessions: [
        session('a', '2026-09-24', [tick(8, 60, null)]),
        session('b', '2026-09-25', [tick(8, 60, null)], { workoutId: 'w2', workoutName: 'Pull day' }),
        session('c', '2026-09-26', [tick(8, 60, null)], { workoutId: null, workoutName: 'Freestyle' }),
      ],
    });
    expect(text).toContain('### Pull day\n');
    expect(text).not.toContain('### Push day\n');
    expect(text).toContain('1 session');
    expect(text).toContain('2026-09-25');
    expect(text).not.toContain('2026-09-24');
    expect(text).not.toContain('Freestyle');
  });

  it('skips archived workouts in the plans when exporting everything', () => {
    const text = buildWorkoutExport({ ...base, workouts: [push, { ...push, id: 'w9', name: 'Old routine', archived: true }] });
    expect(text).not.toContain('Old routine');
  });
});
