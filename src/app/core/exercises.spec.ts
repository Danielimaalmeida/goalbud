import { describe, expect, it } from 'vitest';
import { exerciseMeta, matchesQuery, muscleSummary, toggleSecondary, withPrimary } from './exercises';
import type { Exercise } from './model';

function exercise(partial: Partial<Exercise> = {}): Exercise {
  return { id: 'bench', name: 'Bench press', kind: 'reps', restSeconds: null, primaryMuscle: null, secondaryMuscles: [], archived: false, ...partial };
}

describe('muscle summary', () => {
  it('is empty until something is set', () => {
    expect(muscleSummary(exercise())).toBe('');
    expect(exerciseMeta(exercise())).toBe('Reps & weight');
  });
  it('reads primary first, secondary in brackets', () => {
    expect(muscleSummary(exercise({ primaryMuscle: 'chest' }))).toBe('Chest');
    expect(muscleSummary(exercise({ primaryMuscle: 'chest', secondaryMuscles: ['triceps', 'shoulders'] }))).toBe('Chest (triceps, shoulders)');
    expect(exerciseMeta(exercise({ kind: 'time', primaryMuscle: 'core' }))).toBe('Time · Core');
  });
  it('still reads when only secondary muscles are set', () => {
    expect(muscleSummary(exercise({ secondaryMuscles: ['triceps', 'shoulders'] }))).toBe('Triceps, shoulders');
  });
});

describe('editing muscles', () => {
  it('never lists the primary muscle as secondary too', () => {
    const ex = withPrimary(exercise({ secondaryMuscles: ['chest', 'triceps'] }), 'chest');
    expect(ex.primaryMuscle).toBe('chest');
    expect(ex.secondaryMuscles).toEqual(['triceps']);
    expect(toggleSecondary(ex, 'chest')).toBe(ex);
  });
  it('toggles secondary muscles on and off', () => {
    const on = toggleSecondary(exercise(), 'triceps');
    expect(on.secondaryMuscles).toEqual(['triceps']);
    expect(toggleSecondary(on, 'triceps').secondaryMuscles).toEqual([]);
  });
  it('clears the primary muscle with null', () => {
    expect(withPrimary(exercise({ primaryMuscle: 'chest' }), null).primaryMuscle).toBeNull();
  });
});

describe('library search', () => {
  const ex = exercise({ primaryMuscle: 'chest', secondaryMuscles: ['triceps'] });
  it('matches on name, ignoring case and outer spaces', () => {
    expect(matchesQuery(ex, ' BENCH ')).toBe(true);
    expect(matchesQuery(ex, 'squat')).toBe(false);
  });
  it('matches on any muscle group', () => {
    expect(matchesQuery(ex, 'chest')).toBe(true);
    expect(matchesQuery(ex, 'tri')).toBe(true);
    expect(matchesQuery(ex, 'back')).toBe(false);
  });
  it('matches everything on an empty query', () => {
    expect(matchesQuery(exercise(), '')).toBe(true);
  });
});
