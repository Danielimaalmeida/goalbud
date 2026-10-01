import { describe, expect, it } from 'vitest';
import { buildImport, parseCsv, parseImport } from './import';
import type { Exercise, Workout } from './model';

const bench: Exercise = { id: 'bench', name: 'Bench press', kind: 'reps', restSeconds: 90, primaryMuscle: 'chest', secondaryMuscles: [], archived: false };
const plank: Exercise = { id: 'plank', name: 'Plank', kind: 'time', restSeconds: null, primaryMuscle: 'core', secondaryMuscles: [], archived: false };

describe('parseImport · JSON', () => {
  it('reads a workouts list with explicit sets', () => {
    const r = parseImport(JSON.stringify({
      workouts: [{ name: 'Push day', restSeconds: 90, exercises: [
        { name: 'Bench press', muscle: 'chest', secondary: ['triceps', 'chest'], sets: [{ reps: 8, weight: 60 }, { reps: 6, weight: '65 kg' }] },
        { name: 'Plank', sets: [{ seconds: 60 }] },
      ] }],
    }));
    expect(r.errors).toEqual([]);
    expect(r.workouts).toEqual([{
      name: 'Push day', restSeconds: 90,
      exercises: [
        { name: 'Bench press', kind: 'reps', primaryMuscle: 'chest', secondaryMuscles: ['triceps'], sets: [{ reps: 8, weight: 60, seconds: null }, { reps: 6, weight: 65, seconds: null }] },
        { name: 'Plank', kind: 'time', primaryMuscle: null, secondaryMuscles: [], sets: [{ reps: null, weight: null, seconds: 60 }] },
      ],
    }]);
  });

  it('accepts a bare array, a single workout and the sets-count shorthand', () => {
    const shorthand = { name: 'A', exercises: [{ name: 'Squat', sets: 3, reps: 5, weight: 100 }] };
    for (const text of [JSON.stringify([shorthand]), JSON.stringify(shorthand)]) {
      const r = parseImport(text);
      expect(r.errors).toEqual([]);
      expect(r.workouts[0].exercises[0].sets).toHaveLength(3);
      expect(r.workouts[0].exercises[0].sets[2]).toEqual({ reps: 5, weight: 100, seconds: null });
    }
  });

  it('strips a code fence', () => {
    const r = parseImport('```json\n[{"name":"A","exercises":[{"name":"Squat","reps":5}]}]\n```');
    expect(r.errors).toEqual([]);
    expect(r.workouts[0].exercises[0].sets).toEqual([{ reps: 5, weight: null, seconds: null }]);
  });

  it('says so when the JSON is broken or the wrong shape', () => {
    expect(parseImport('{"workouts": [').errors[0]).toContain("can't be read");
    expect(parseImport('{"hello": 1}').errors[0]).toContain('list of workouts');
  });
});

describe('parseImport · CSV', () => {
  it('reads one line per exercise with a sets count, merging lines of one workout', () => {
    const r = parseImport('workout,exercise,sets,reps,weight,seconds,kind,rest\nPush day,Bench press,3,8,60,,reps,120\nPush day,Plank,2,,,45,time,\nPull day,Row,1,10,40,,,');
    expect(r.errors).toEqual([]);
    expect(r.workouts.map((w) => [w.name, w.restSeconds, w.exercises.length])).toEqual([['Push day', 120, 2], ['Pull day', null, 1]]);
    expect(r.workouts[0].exercises[0].sets).toHaveLength(3);
    expect(r.workouts[0].exercises[1]).toMatchObject({ kind: 'time', sets: [{ seconds: 45 }, { seconds: 45 }] });
  });

  it('reads one line per set, with blank cells continuing the row above', () => {
    const r = parseImport('Workout,Exercise,Reps,Weight\nPush,Bench,8,60\n,,6,65\n,Fly,12,10');
    expect(r.errors).toEqual([]);
    expect(r.workouts[0].exercises[0].sets).toEqual([{ reps: 8, weight: 60, seconds: null }, { reps: 6, weight: 65, seconds: null }]);
    expect(r.workouts[0].exercises[1].name).toBe('Fly');
  });

  it('handles semicolons, decimal commas, quotes and CRLF', () => {
    const r = parseImport('workout;exercise;reps;weight\r\n"Push; day";"Bench ""flat""";8;62,5\r\n');
    expect(r.errors).toEqual([]);
    expect(r.workouts[0].name).toBe('Push; day');
    expect(r.workouts[0].exercises[0]).toMatchObject({ name: 'Bench "flat"', sets: [{ reps: 8, weight: 62.5 }] });
  });

  it('names a single workout when there is no workout column', () => {
    const r = parseImport('exercise,reps\nSquat,5');
    expect(r.workouts[0].name).toBe('Imported workout');
  });

  it('needs an exercise column', () => {
    expect(parseImport('foo,bar\n1,2').errors[0]).toContain('"exercise" column');
  });

  it('parseCsv keeps newlines inside quotes', () => {
    expect(parseCsv('a,b\n"x\ny",2')).toEqual([['a', 'b'], ['x\ny', '2']]);
  });
});

describe('parseImport · problems', () => {
  it('leaves out a workout with a problem and keeps the others', () => {
    const r = parseImport(JSON.stringify([
      { name: 'Good', exercises: [{ name: 'Squat', sets: [{ reps: 5 }] }] },
      { name: 'Bad', exercises: [{ name: 'Squat', sets: [{ weight: 50 }] }, { name: 'Curl', sets: [{ reps: 'lots' }] }, { name: 'Dips' }] },
      { exercises: [] },
    ]));
    expect(r.workouts.map((w) => w.name)).toEqual(['Good']);
    expect(r.errors).toHaveLength(2);
    expect(r.errors[0]).toContain('"Bad"');
    expect(r.errors[0]).toContain('every set needs reps');
    expect(r.errors[0]).toContain('not valid');
    expect(r.errors[0]).toContain('has no sets');
    expect(r.errors[1]).toContain('Workout 3: it has no name; it has no exercises');
  });

  it('warns about unknown muscles and bad rest, but still imports', () => {
    const r = parseImport(JSON.stringify([{ name: 'A', rest: 'x', exercises: [{ name: 'Squat', muscle: 'legs', reps: 5 }] }]));
    expect(r.errors).toEqual([]);
    expect(r.workouts[0]).toMatchObject({ restSeconds: null, exercises: [{ primaryMuscle: null }] });
    expect(r.warnings).toHaveLength(2);
  });

  it('rejects negative, zero and absurd values', () => {
    const bad = (sets: unknown) => parseImport(JSON.stringify([{ name: 'A', exercises: [{ name: 'X', sets }] }])).errors.length;
    expect(bad([{ reps: -1 }])).toBe(1);
    expect(bad([{ reps: 0 }])).toBe(1);
    expect(bad(25)).toBe(1);
    expect(bad(0)).toBe(1);
  });
});

describe('buildImport', () => {
  const parsed = (text: string) => parseImport(text).workouts;
  let n = 0;
  const id = () => `id${n++}`;

  it('reuses library exercises by name and creates the rest with their muscles', () => {
    const w = parsed(JSON.stringify([{ name: 'Push', exercises: [{ name: 'BENCH PRESS', reps: 8 }, { name: 'Fly', muscle: 'chest', secondary: 'shoulders', reps: 12 }] }]));
    const b = buildImport(w, [bench], [], id);
    expect(b.newExercises).toEqual(['Fly']);
    expect(b.exercises).toHaveLength(1);
    expect(b.exercises[0]).toMatchObject({ name: 'Fly', primaryMuscle: 'chest', secondaryMuscles: ['shoulders'], archived: false });
    expect(b.workouts[0].exercises.map((e) => e.exerciseId)).toEqual(['bench', b.exercises[0].id]);
  });

  it('creates a shared exercise once across workouts', () => {
    const w = parsed(JSON.stringify([{ name: 'A', exercises: [{ name: 'Fly', reps: 12 }] }, { name: 'B', exercises: [{ name: 'fly', reps: 10 }] }]));
    const b = buildImport(w, [], [], id);
    expect(b.exercises).toHaveLength(1);
    expect(b.workouts[0].exercises[0].exerciseId).toBe(b.workouts[1].exercises[0].exerciseId);
  });

  it('brings an archived exercise back', () => {
    const w = parsed('exercise,reps\nBench press,8');
    const b = buildImport(w, [{ ...bench, archived: true }], [], id);
    expect(b.exercises).toEqual([{ ...bench, archived: false }]);
    expect(b.newExercises).toEqual([]);
  });

  it('skips a workout that already exists, but not an archived one', () => {
    const existing: Workout = { id: 'w', name: 'push', restSeconds: null, exercises: [], archived: false };
    const w = parsed(JSON.stringify([{ name: 'Push', exercises: [{ name: 'Fly', reps: 1 }] }]));
    expect(buildImport(w, [], [existing], id).skipped).toEqual(['Push']);
    expect(buildImport(w, [], [{ ...existing, archived: true }], id).workouts).toHaveLength(1);
  });

  it('leaves out an exercise whose kind clashes with the library, and the workout if nothing is left', () => {
    const w = parsed(JSON.stringify([
      { name: 'A', exercises: [{ name: 'Plank', kind: 'reps', reps: 10 }, { name: 'Bench press', reps: 8 }] },
      { name: 'B', exercises: [{ name: 'Plank', kind: 'reps', reps: 10 }] },
    ]));
    const b = buildImport(w, [bench, plank], [], id);
    expect(b.workouts.map((x) => x.name)).toEqual(['A']);
    expect(b.workouts[0].exercises).toHaveLength(1);
    expect(b.preview[0].exercises.map((e) => e.name)).toEqual(['Bench press']);
    expect(b.notes).toHaveLength(3);
  });

  it('skips a workout name repeated within the same import', () => {
    const w = parsed(JSON.stringify([{ name: 'A', exercises: [{ name: 'X', reps: 1 }] }, { name: 'a', exercises: [{ name: 'Y', reps: 1 }] }]));
    const b = buildImport(w, [], [], id);
    expect(b.workouts).toHaveLength(1);
    expect(b.skipped).toEqual(['a']);
  });
});
