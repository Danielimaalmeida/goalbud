import { addDays, WEEKDAY_SHORT, weekday } from './dates';
import { kindLabel, muscleSummary } from './exercises';
import { pluralise } from './goals';
import { APP_DEFAULT_REST_SECONDS, type Exercise, type LocalDate, type Session, type SessionExercise, type SetTarget, type Workout } from './model';
import { doneSetCount, doneSets, formatSet, formatTarget, sessionElapsedSeconds, touchedExercises } from './sessions';

export type ExportRange = '4w' | '12w' | '1y' | 'all';

export const EXPORT_RANGES: { id: ExportRange; label: string; days: number | null }[] = [
  { id: '4w', label: 'Last 4 weeks', days: 28 },
  { id: '12w', label: 'Last 12 weeks', days: 84 },
  { id: '1y', label: 'Last year', days: 365 },
  { id: 'all', label: 'All time', days: null },
];

export interface ExportInput {
  workouts: Workout[];
  exercises: Exercise[];
  sessions: Session[];
  today: LocalDate;
  range: ExportRange;
  /** Limit the export to one workout (its plan and the sessions done from it). Null = everything. */
  workoutId: string | null;
}

/** First day included for a range, or null for all time. */
export function rangeStart(range: ExportRange, today: LocalDate): LocalDate | null {
  const days = EXPORT_RANGES.find((r) => r.id === range)?.days ?? null;
  return days === null ? null : addDays(today, -(days - 1));
}

/** Sessions in the export: at least one ticked set, inside the range and scope, oldest first. */
export function sessionsToExport(input: Pick<ExportInput, 'sessions' | 'today' | 'range' | 'workoutId'>): Session[] {
  const from = rangeStart(input.range, input.today);
  return input.sessions
    .filter((s) => doneSetCount(s) > 0)
    .filter((s) => (from === null || s.date >= from) && s.date <= input.today)
    .filter((s) => input.workoutId === null || s.workoutId === input.workoutId)
    .sort((a, b) => (a.startedAt < b.startedAt ? -1 : a.startedAt > b.startedAt ? 1 : 0));
}

const day = (d: LocalDate) => `${d} (${WEEKDAY_SHORT[weekday(d)]})`;

/** "8 × 60 kg" · "8 reps" · "45 s". Bare rep counts get a unit so they read right out of context. */
function setText(text: string, kind: SessionExercise['kind']): string {
  return kind === 'reps' && text !== '' && !text.includes('×') ? `${text} reps` : text;
}

const list = (parts: string[]) => parts.filter((p) => p !== '').join(', ');

function targetsText(targets: SetTarget[], kind: SessionExercise['kind']): string {
  return list(targets.map((t) => setText(formatTarget(t, kind), kind)));
}

function planBlock(w: Workout, exercises: Exercise[]): string {
  const lines = [`### ${w.name}`, `Rest between sets: ${w.restSeconds ?? APP_DEFAULT_REST_SECONDS} s${w.archived ? ' · archived' : ''}`];
  for (const we of w.exercises) {
    const ex = exercises.find((e) => e.id === we.exerciseId);
    if (!ex) continue;
    const muscles = muscleSummary(ex);
    lines.push(`- ${ex.name} (${kindLabel(ex.kind)}${muscles ? `; ${muscles}` : ''}): ${targetsText(we.sets, ex.kind)}`);
  }
  return lines.join('\n');
}

function exerciseLine(e: SessionExercise, exercises: Exercise[]): string {
  const done = doneSets(e);
  const actual = list(done.map((s) => setText(formatSet(s, e.kind, { unit: true }), e.kind)));
  const library = exercises.find((x) => x.id === e.exerciseId);
  const muscles = library ? muscleSummary(library) : '';
  const head = `- ${e.name}${muscles ? ` (${muscles})` : ''}`;
  const count = done.length === e.sets.length ? '' : ` [${done.length} of ${pluralise(e.sets.length, 'set')} done]`;
  const planned = targetsText(e.sets.map((s) => s.target), e.kind);
  // Planned values only add information when they differ from what was logged.
  const differs = done.length !== e.sets.length || e.sets.some((s) => formatTarget(s.target, e.kind) !== formatSet(s, e.kind, { unit: true }));
  return `${head}: ${actual}${count}${differs && planned ? ` | planned: ${planned}` : ''}`;
}

function sessionBlock(s: Session, exercises: Exercise[]): string {
  const bits = [day(s.date), s.workoutName];
  if (s.endedAt) {
    const minutes = Math.round(sessionElapsedSeconds(s, 0) / 60);
    if (minutes > 0) bits.push(`${minutes} min`);
  } else {
    bits.push('still open');
  }
  bits.push(pluralise(doneSetCount(s), 'set'));
  return [`### ${bits.join(' · ')}`, ...touchedExercises(s).map((e) => exerciseLine(e, exercises))].join('\n');
}

/**
 * The workouts as plain text a person can paste into an LLM: the plan for each
 * workout, then every session with the sets that were actually ticked, oldest
 * first so progress reads top to bottom.
 */
export function buildWorkoutExport(input: ExportInput): string {
  const sessions = sessionsToExport(input);
  const scope = input.workoutId === null ? null : input.workouts.find((w) => w.id === input.workoutId) ?? null;
  const plans = scope ? [scope] : input.workouts.filter((w) => !w.archived);
  const from = rangeStart(input.range, input.today);
  const range = EXPORT_RANGES.find((r) => r.id === input.range)!.label.toLowerCase();

  const out: string[] = [
    '# Workout log from Goalbud',
    '',
    `Exported ${day(input.today)} · ${range}${from ? ` (${from} to ${input.today})` : ''} · ${scope ? scope.name : 'all workouts'} · ${pluralise(sessions.length, 'session')}`,
    '',
    'How to read this: weights are in kg and times in seconds. "8 × 60 kg" is 8 reps at 60 kg; "8 reps" is body weight or unspecified load. Only sets that were ticked as done are listed, and "planned" shows the target when it differed from what was done. Sessions run oldest to newest.',
  ];

  if (plans.length) {
    out.push('', '## Workout plans', '', plans.map((w) => planBlock(w, input.exercises)).join('\n\n'));
  }
  out.push('', '## Sessions', '');
  out.push(sessions.length ? sessions.map((s) => sessionBlock(s, input.exercises)).join('\n\n') : 'No sessions in this range.');
  return out.join('\n') + '\n';
}
