import { addDays, todayLocal, weekStart, weekday } from './dates';
import type { Exercise, Goal, GoalEntry, MuscleGroup, Session, Snapshot, Weekday, Workout } from './model';

/**
 * Demo data mirroring the design mockups, generated relative to today so
 * the screens always look lived-in. Used only in `local` data mode.
 */
export function seedSnapshot(userId: string, email: string, displayName: string): Snapshot {
  const today = todayLocal();
  const d = (n: number) => addDays(today, n);
  const ws = weekStart(today);
  // Three days a week, always including today, so the demo Today has a workout on it.
  const wd = weekday(today);
  const pushDays = [...new Set([wd, ((wd + 1) % 7) + 1, ((wd + 3) % 7) + 1])].sort() as Weekday[];
  const at = (date: string, h: number, m: number) => new Date(`${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`).toISOString();

  let order = 0;
  const goals: Goal[] = [
    g('read', 'Read 20 minutes', 'scheduled', 'sage', 'ring', d(-134), { recurrence: { kind: 'daily' } }),
    g('swim', 'Swim', 'weekly', 'teal', 'bars', d(-60), { timesPerWeek: 3 }),
    g('push', 'Push day', 'scheduled', 'rust', 'diamond', d(-90), { recurrence: { kind: 'weekdays', days: pushDays } }, { isExercise: true }),
    g('mum', 'Call mum', 'log', 'gold', 'dot', d(-45)),
    g('plants', 'Water the plants', 'scheduled', 'rose', 'dot', d(-30), { recurrence: { kind: 'everyN', n: 3, anchor: d(-30) } }),
    g('vits', 'Vitamins', 'scheduled', 'sage', 'ring', d(-20), { recurrence: { kind: 'daily' } }),
    g('walk', 'Walk the loop', 'scheduled', 'stone', 'columns', d(-12), { recurrence: { kind: 'daily' } }),
    g('painting', 'Finish the painting', 'long', 'purple', 'square', d(-40), undefined, { targetDate: d(46) }),
    g('paint', 'Paint 30 minutes', 'scheduled', 'purple', 'square', d(-40), { recurrence: { kind: 'daily' } }, { parentId: 'painting' }),
    g('varnish', 'Buy varnish', 'log', 'purple', null, d(-40), undefined, { parentId: 'painting' }),
    g('spanish', 'Spanish, 15 min', 'scheduled', 'blue', 'ring', d(-70), { recurrence: { kind: 'daily' } }, {
      state: 'paused', pauses: [{ from: d(-13), to: null }],
    }),
    g('run', 'Run', 'weekly', 'teal', null, d(-200), { timesPerWeek: 2 }, { state: 'archived', archivedOn: d(-100) }),
  ];

  const entries: GoalEntry[] = [];
  const done = (goalId: string, date: string, h = 8, m = 12) =>
    entries.push({ id: `${goalId}-${date}`, goalId, date, kind: 'done', loggedAt: at(date, h, m) });
  const skip = (goalId: string, date: string) =>
    entries.push({ id: `${goalId}-${date}`, goalId, date, kind: 'skip', loggedAt: at(date, 9, 0) });

  // Read: most days for 130 days, a skip here and there. Today still open.
  for (let i = 134; i >= 1; i--) {
    if (i % 17 === 0) skip('read', d(-i));
    else if (i % 11 !== 4) done('read', d(-i), 21, 30);
  }
  // Swim: two this week already, ~3 a week before.
  for (let i = 60; i >= 1; i--) if ([1, 3, 5].includes((i + 2) % 7)) done('swim', d(-i), 7, 5);
  if (ws < today) done('swim', ws, 7, 10);
  if (addDays(ws, 1) < today) done('swim', addDays(ws, 1), 7, 5);
  // Push day sessions on Mon/Wed/Fri-ish
  for (let i = 90; i >= 2; i -= 2) if (i % 3 !== 1) done('push', d(-i), 18, 40);
  // Call mum, whenever
  for (let i = 45; i >= 2; i -= 3) done('mum', d(-i), 19, 15);
  // Plants and vitamins: done today already
  done('plants', today, 8, 12);
  done('vits', today, 7, 40);
  for (let i = 3; i <= 30; i += 3) done('plants', d(-i), 8, 0);
  for (let i = 1; i <= 20; i++) if (i % 6 !== 0) done('vits', d(-i), 7, 40);
  // Walk: skipped today
  skip('walk', today);
  for (let i = 1; i <= 12; i++) if (i % 4 !== 2) done('walk', d(-i), 18, 0);
  // Painting children: 12 sessions so far
  for (let i = 38; i >= 3; i -= 3) done('paint', d(-i), 20, 0);
  // Spanish before the pause
  for (let i = 70; i >= 14; i--) if (i % 5 !== 0) done('spanish', d(-i), 8, 30);

  const exercises: Exercise[] = [
    ex('bench', 'Bench press', 'reps', 90, 'chest', ['triceps', 'shoulders']),
    ex('ohp', 'Overhead press', 'reps', 90, 'shoulders', ['triceps']),
    ex('fly', 'Cable fly', 'reps', 60, 'chest'),
    ex('dips', 'Dips', 'reps', 90, 'triceps', ['chest']),
    ex('plank', 'Plank', 'time', 60, 'core'),
    ex('rows', 'Rows', 'reps', 90, 'back', ['biceps']),
    ex('lat', 'Lat pulldown', 'reps', 90, 'back', ['biceps']),
    ex('curl', 'Curls', 'reps', 60, 'biceps'),
    ex('face', 'Face pulls', 'reps', 60, 'shoulders', ['back']),
    ex('squat', 'Squat', 'reps', 120, 'quads', ['glutes', 'core']),
    ex('rdl', 'Romanian deadlift', 'reps', 120, 'hamstrings', ['glutes', 'back']),
    ex('lunge', 'Lunges', 'reps', 90, 'quads', ['glutes']),
    ex('calf', 'Calf raises', 'reps', 60, 'calves'),
    ex('hang', 'Dead hang', 'time', 60),
  ];

  const workouts: Workout[] = [
    {
      id: 'wo-push', name: 'Push day', restSeconds: null, archived: false,
      exercises: [
        { exerciseId: 'bench', sets: reps(4, 8, 60) },
        { exerciseId: 'ohp', sets: reps(4, 10, 30) },
        { exerciseId: 'fly', sets: reps(3, 12, 15) },
        { exerciseId: 'dips', sets: reps(4, 10, null) },
        { exerciseId: 'plank', sets: secs(3, 60) },
      ],
    },
    {
      id: 'wo-pull', name: 'Pull day', restSeconds: null, archived: false,
      exercises: [
        { exerciseId: 'rows', sets: reps(4, 10, 50) },
        { exerciseId: 'lat', sets: reps(4, 10, 45) },
        { exerciseId: 'curl', sets: reps(4, 12, 12) },
        { exerciseId: 'face', sets: reps(3, 15, 20) },
      ],
    },
    {
      id: 'wo-legs', name: 'Legs', restSeconds: 120, archived: false,
      exercises: [
        { exerciseId: 'squat', sets: reps(4, 8, 80) },
        { exerciseId: 'rdl', sets: reps(3, 10, 70) },
        { exerciseId: 'lunge', sets: reps(3, 12, 20) },
        { exerciseId: 'calf', sets: reps(3, 15, 40) },
      ],
    },
  ];

  const sessions: Session[] = [];
  let benchWeight = 50;
  for (let i = 88; i >= 2; i -= 2) {
    if (i % 3 === 1) continue;
    const date = d(-i);
    if (i % 12 === 0) benchWeight += 2.5;
    const midnight = i === 6;
    sessions.push({
      id: `s-${date}`, workoutId: 'wo-push', workoutName: 'Push day', goalId: 'push', date,
      startedAt: at(date, 18, 5), endedAt: midnight ? at(date, 23, 59) : at(date, 18, 52),
      closedBy: midnight ? 'midnight' : 'user',
      exercises: [
        sx('bench', 'Bench press', 'reps', 90, [
          s(8, benchWeight), s(8, benchWeight), s(7, benchWeight), s(6, benchWeight + 2.5),
        ], midnight ? 3 : 4),
        sx('ohp', 'Overhead press', 'reps', 90, [s(10, 30), s(9, 30), s(10, 30), s(10, 30)], midnight ? 0 : 4),
        sx('fly', 'Cable fly', 'reps', 60, [s(12, 15), s(12, 15), s(12, 15)], midnight ? 0 : 3),
        sx('dips', 'Dips', 'reps', 90, [s(10, null), s(10, null), s(9, null), s(8, null)], midnight ? 0 : 4),
        sx('plank', 'Plank', 'time', 60, [t(60), t(60), t(50)], midnight ? 0 : 3),
      ],
    });
  }

  return {
    profile: { id: userId, displayName, email, reminderTime: '18:30' },
    goals, entries, exercises, workouts, sessions,
  };

  function g(
    id: string, name: string, shape: Goal['shape'], colour: Goal['colour'], icon: string | null, createdOn: string,
    sched?: { recurrence?: Goal['schedule'][0]['recurrence']; timesPerWeek?: number }, extra: Partial<Goal> = {},
  ): Goal {
    return {
      id, name, shape, colour, icon, isExercise: false, state: 'active', parentId: null,
      schedule: sched ? [{ from: weekStart(createdOn), ...sched }] : [],
      pauses: [], targetDate: null, completedOn: null, createdOn, archivedOn: null, sortOrder: order++,
      ...extra,
    };
  }
  function ex(id: string, name: string, kind: Exercise['kind'], rest: number, primary: MuscleGroup | null = null, secondary: MuscleGroup[] = []): Exercise {
    return { id, name, kind, restSeconds: rest, primaryMuscle: primary, secondaryMuscles: secondary, archived: false };
  }
  function reps(n: number, r: number, w: number | null) {
    return Array.from({ length: n }, () => ({ reps: r, weight: w, seconds: null }));
  }
  function secs(n: number, sec: number) {
    return Array.from({ length: n }, () => ({ reps: null, weight: null, seconds: sec }));
  }
  function s(r: number, w: number | null) {
    return { target: { reps: r, weight: w, seconds: null }, reps: r, weight: w, seconds: null, doneAt: null };
  }
  function t(sec: number) {
    return { target: { reps: null, weight: null, seconds: sec }, reps: null, weight: null, seconds: sec, doneAt: null };
  }
  function sx(exerciseId: string, name: string, kind: Exercise['kind'], rest: number, sets: Session['exercises'][0]['sets'], doneCount: number): Session['exercises'][0] {
    return {
      exerciseId, name, kind, restSeconds: rest,
      sets: sets.map((set, i) => (i < doneCount ? { ...set, doneAt: at(today, 18, 10 + i) } : { ...set, reps: null, weight: null, seconds: null })),
    };
  }
}
