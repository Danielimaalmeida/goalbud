import { MUSCLE_GROUPS, type Exercise, type ExerciseKind, type MuscleGroup, type SetTarget, type Workout } from './model';

/** One exercise as read from the pasted text, after checking. */
export interface ImportExercise {
  name: string;
  kind: ExerciseKind;
  primaryMuscle: MuscleGroup | null;
  secondaryMuscles: MuscleGroup[];
  sets: SetTarget[];
}

export interface ImportWorkout {
  name: string;
  restSeconds: number | null;
  exercises: ImportExercise[];
}

export interface ParsedImport {
  /** Only workouts with no problems. The rest are named in `errors`. */
  workouts: ImportWorkout[];
  errors: string[];
  warnings: string[];
}

/* ---------- raw shapes: what JSON and CSV both boil down to, before checking ---------- */

interface RawSet { reps?: unknown; weight?: unknown; seconds?: unknown }
interface RawExercise { name?: unknown; kind?: unknown; muscle?: unknown; secondary?: unknown; sets: RawSet[] }
interface RawWorkout { name?: unknown; rest?: unknown; exercises: RawExercise[] }

const MAX_SETS = 20;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const first = (o: Record<string, unknown>, ...keys: string[]): unknown => {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null && o[k] !== '') return o[k];
  return undefined;
};

/** Pasted LLM answers usually come wrapped in a ```json fence. */
function stripFence(text: string): string {
  const m = text.trim().match(/^```[a-zA-Z]*\s*\n([\s\S]*?)\n?```$/);
  return (m ? m[1] : text).trim();
}

/* ---------- JSON ---------- */

function setsFromJson(e: Record<string, unknown>): RawSet[] {
  const sets = e['sets'];
  const own: RawSet = { reps: e['reps'], weight: e['weight'], seconds: first(e, 'seconds', 'time') };
  const hasOwn = own.reps !== undefined || own.weight !== undefined || own.seconds !== undefined;
  if (Array.isArray(sets)) return sets.map((s) => (isObject(s) ? { reps: s['reps'], weight: s['weight'], seconds: first(s, 'seconds', 'time') } : { reps: s }));
  if (typeof sets === 'number' || (typeof sets === 'string' && sets.trim() !== '')) return Array.from({ length: Math.min(Math.max(Math.trunc(Number(sets)) || 0, 0), MAX_SETS + 1) }, () => ({ ...own }));
  return hasOwn ? [own] : [];
}

function rawFromJson(root: unknown): RawWorkout[] | string {
  let list: unknown[];
  if (Array.isArray(root)) list = root;
  else if (isObject(root) && Array.isArray(root['workouts'])) list = root['workouts'];
  else if (isObject(root) && Array.isArray(root['exercises'])) list = [root];
  else return 'The JSON should be a list of workouts, or an object with a "workouts" list.';
  return list.map((w): RawWorkout => {
    if (!isObject(w)) return { exercises: [] };
    const exercises = Array.isArray(w['exercises']) ? w['exercises'] : [];
    return {
      name: first(w, 'name', 'workout', 'title'),
      rest: first(w, 'restSeconds', 'rest'),
      exercises: exercises.map((e): RawExercise => isObject(e)
        ? { name: first(e, 'name', 'exercise'), kind: e['kind'], muscle: first(e, 'primaryMuscle', 'muscle'), secondary: first(e, 'secondaryMuscles', 'secondary'), sets: setsFromJson(e) }
        : { name: typeof e === 'string' ? e : undefined, sets: [] }),
    };
  });
}

/* ---------- CSV ---------- */

/** Comma, semicolon or tab, whichever the header line uses most. */
function detectDelimiter(text: string): string {
  const head = text.split(/\r?\n/, 1)[0];
  const count = (d: string) => head.split(d).length - 1;
  return [',', ';', '\t'].reduce((best, d) => (count(d) > count(best) ? d : best), ',');
}

/** RFC 4180-ish: quoted fields, "" for a quote, newlines inside quotes. */
export function parseCsv(text: string, delimiter = detectDelimiter(text)): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += c;
    } else if (c === '"' && cell === '') quoted = true;
    else if (c === delimiter) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      rows.push(row); row = [];
    } else cell += c;
  }
  row.push(cell);
  rows.push(row);
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const COLUMNS: Record<string, string[]> = {
  workout: ['workout', 'workout name', 'plan', 'routine'],
  exercise: ['exercise', 'exercise name'],
  sets: ['sets', 'set count'],
  reps: ['reps', 'rep', 'repetitions'],
  weight: ['weight', 'kg', 'load'],
  seconds: ['seconds', 'secs', 'time', 'duration'],
  kind: ['kind', 'type'],
  rest: ['rest', 'rest seconds', 'restseconds'],
  muscle: ['muscle', 'primary muscle', 'primarymuscle'],
  secondary: ['secondary', 'secondary muscles', 'secondarymuscles'],
};

function rawFromCsv(text: string): RawWorkout[] | string {
  const rows = parseCsv(text);
  if (rows.length === 0) return 'Nothing to import.';
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col: Record<string, number> = {};
  for (const [key, aliases] of Object.entries(COLUMNS)) col[key] = header.findIndex((h) => aliases.includes(h));
  if (col['exercise'] < 0) return 'The CSV needs a header row with at least an "exercise" column.';
  const get = (r: string[], key: string): string => (col[key] >= 0 ? (r[col[key]] ?? '').trim() : '');

  const workouts: RawWorkout[] = [];
  let curWorkout: RawWorkout | null = null;
  let curExercise: RawExercise | null = null;
  let lastWorkoutName = '';
  let lastExerciseName = '';
  for (const r of rows.slice(1)) {
    // Blank workout or exercise cells continue the row above, so one line per set reads naturally.
    const wName = get(r, 'workout') || (col['workout'] >= 0 ? lastWorkoutName : 'Imported workout');
    const eName = get(r, 'exercise') || lastExerciseName;
    if (!curWorkout || wName !== lastWorkoutName) {
      curWorkout = workouts.find((w) => w.name === wName) ?? { name: wName, exercises: [] };
      if (!workouts.includes(curWorkout)) workouts.push(curWorkout);
      curExercise = null;
    }
    lastWorkoutName = wName;
    lastExerciseName = eName;
    if (curWorkout.rest === undefined && get(r, 'rest') !== '') curWorkout.rest = get(r, 'rest');
    if (!curExercise || curExercise.name !== eName) {
      curExercise = curWorkout.exercises.find((e) => e.name === eName) ?? {
        name: eName, kind: get(r, 'kind') || undefined, muscle: get(r, 'muscle') || undefined, secondary: get(r, 'secondary') || undefined, sets: [],
      };
      if (!curWorkout.exercises.includes(curExercise)) curWorkout.exercises.push(curExercise);
    }
    const set: RawSet = { reps: get(r, 'reps') || undefined, weight: get(r, 'weight') || undefined, seconds: get(r, 'seconds') || undefined };
    const count = get(r, 'sets');
    const n = count === '' ? 1 : Math.trunc(Number(count));
    if (!(n >= 1 && n <= MAX_SETS)) curExercise.sets.push({ reps: NaN }); // reported as a bad set count
    else for (let i = 0; i < n; i++) curExercise.sets.push({ ...set });
  }
  return workouts;
}

/* ---------- checking ---------- */

/** null = empty, NaN = not a number. Accepts "8", 8, "62,5", "60 kg", "45s". */
function toNumber(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  if (typeof v !== 'string') return NaN;
  const m = v.trim().match(/^(\d+(?:[.,]\d+)?)\s*(?:kg|kgs|s|sec|secs|seconds|reps|x)?$/i);
  return m ? Number(m[1].replace(',', '.')) : NaN;
}

function toMuscle(v: unknown): MuscleGroup | null | undefined {
  if (v === undefined || v === null || v === '') return null;
  const s = String(v).trim().toLowerCase();
  return (MUSCLE_GROUPS as readonly string[]).includes(s) ? (s as MuscleGroup) : undefined;
}

function toKind(v: unknown): ExerciseKind | null | undefined {
  if (v === undefined || v === null || v === '') return null;
  const s = String(v).trim().toLowerCase();
  if (s.startsWith('time') || s === 'seconds' || s === 'duration') return 'time';
  if (s.startsWith('rep') || s.startsWith('weight')) return 'reps';
  return undefined;
}

function checkExercise(raw: RawExercise, problems: string[], warnings: string[]): ImportExercise | null {
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!name) { problems.push('an exercise has no name'); return null; }
  const where = `"${name}"`;
  const before = problems.length;

  const sets = raw.sets.map((s) => ({ reps: toNumber(s.reps), weight: toNumber(s.weight), seconds: toNumber(s.seconds) }));
  if (sets.length === 0) problems.push(`${where} has no sets`);
  if (sets.length > MAX_SETS) problems.push(`${where} has more than ${MAX_SETS} sets`);
  if (sets.some((s) => Number.isNaN(s.reps) || Number.isNaN(s.weight) || Number.isNaN(s.seconds) || (s.reps ?? 1) <= 0 || (s.weight ?? 0) < 0 || (s.seconds ?? 1) <= 0)) {
    problems.push(`${where} has a set with a number that is not valid (reps, weight and seconds must be plain positive numbers)`);
  }

  let kind = toKind(raw.kind);
  if (kind === undefined) { warnings.push(`${where}: kind "${String(raw.kind)}" is not "reps" or "time", so it was worked out from the sets`); kind = null; }
  kind ??= sets.length > 0 && sets.every((s) => s.reps === null) && sets.some((s) => s.seconds !== null) ? 'time' : 'reps';

  let primary = toMuscle(raw.muscle);
  if (primary === undefined) { warnings.push(`${where}: muscle "${String(raw.muscle)}" is not one of ${MUSCLE_GROUPS.join(', ')}, so it was left out`); primary = null; }
  const secondaryRaw = Array.isArray(raw.secondary) ? raw.secondary : typeof raw.secondary === 'string' ? raw.secondary.split(/[|;,]/) : [];
  const secondary: MuscleGroup[] = [];
  for (const m of secondaryRaw) {
    const g = toMuscle(typeof m === 'string' ? m.trim() : m);
    if (g === undefined) warnings.push(`${where}: muscle "${String(m)}" is not one of ${MUSCLE_GROUPS.join(', ')}, so it was left out`);
    else if (g !== null && g !== primary && !secondary.includes(g)) secondary.push(g);
  }

  const need = kind === 'reps' ? 'reps' : 'seconds';
  if (sets.length > 0 && sets.some((s) => (kind === 'reps' ? s.reps : s.seconds) === null)) problems.push(`${where} is a ${kind} exercise, so every set needs ${need}`);
  if (problems.length > before) return null;

  return {
    name, kind, primaryMuscle: primary, secondaryMuscles: secondary,
    sets: sets.map((s) => (kind === 'reps' ? { reps: s.reps, weight: s.weight, seconds: null } : { reps: null, weight: null, seconds: s.seconds })),
  };
}

function checkWorkout(raw: RawWorkout, index: number, errors: string[], warnings: string[]): ImportWorkout | null {
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  const label = name ? `"${name}"` : `Workout ${index + 1}`;
  const problems: string[] = [];
  if (!name) problems.push('it has no name');
  if (raw.exercises.length === 0) problems.push('it has no exercises');

  let rest: number | null = null;
  const r = toNumber(raw.rest);
  if (r !== null) {
    if (Number.isNaN(r) || r <= 0) warnings.push(`${label}: rest "${String(raw.rest)}" is not a valid number of seconds, so the default is used`);
    else rest = Math.round(r);
  }

  const exercises: ImportExercise[] = [];
  const localWarnings: string[] = [];
  for (const e of raw.exercises) {
    const ex = checkExercise(e, problems, localWarnings);
    if (ex) exercises.push(ex);
  }
  warnings.push(...localWarnings.map((w) => `${label}, ${w}`));
  if (problems.length) {
    errors.push(`${label}: ${problems.join('; ')}.`);
    return null;
  }
  return { name, restSeconds: rest, exercises };
}

/** Read pasted CSV or JSON (a ```json fence is fine) into workouts, or say what is wrong. */
export function parseImport(text: string): ParsedImport {
  const body = stripFence(text);
  const out: ParsedImport = { workouts: [], errors: [], warnings: [] };
  if (!body) return out;

  let raw: RawWorkout[] | string;
  if (body.startsWith('{') || body.startsWith('[')) {
    try {
      raw = rawFromJson(JSON.parse(body));
    } catch {
      raw = "That looks like JSON, but it can't be read. Check for a missing comma, bracket or quote.";
    }
  } else raw = rawFromCsv(body);

  if (typeof raw === 'string') { out.errors.push(raw); return out; }
  if (raw.length === 0) { out.errors.push('No workouts found.'); return out; }
  raw.forEach((w, i) => {
    const ok = checkWorkout(w, i, out.errors, out.warnings);
    if (ok) out.workouts.push(ok);
  });
  return out;
}

/* ---------- merging into the library ---------- */

export interface ImportBuild {
  /** Exercises to save: new ones, and archived ones brought back. */
  exercises: Exercise[];
  workouts: Workout[];
  /** The same workouts as read from the text, minus anything left out, for showing names. */
  preview: ImportWorkout[];
  /** Names of exercises that are created fresh (a subset of `exercises`). */
  newExercises: string[];
  /** Workouts skipped because one with that name already exists. */
  skipped: string[];
  notes: string[];
}

/**
 * Match the parsed workouts to the user's library. Exercises are reused by name
 * (case-insensitive), a workout whose name already exists is skipped so a
 * second paste never duplicates, and an exercise whose kind clashes with the
 * library is left out of the workout rather than guessed at.
 */
export function buildImport(parsed: ImportWorkout[], library: Exercise[], existing: Workout[], makeId: () => string): ImportBuild {
  const out: ImportBuild = { exercises: [], workouts: [], preview: [], newExercises: [], skipped: [], notes: [] };
  const byName = new Map(library.map((e) => [e.name.toLowerCase(), e]));
  const taken = new Set(existing.filter((w) => !w.archived).map((w) => w.name.trim().toLowerCase()));

  for (const w of parsed) {
    const workoutKey = w.name.toLowerCase();
    if (taken.has(workoutKey)) { out.skipped.push(w.name); continue; }
    taken.add(workoutKey);

    const exercises: Workout['exercises'] = [];
    const kept: ImportExercise[] = [];
    for (const e of w.exercises) {
      let ex = byName.get(e.name.toLowerCase());
      if (ex && ex.kind !== e.kind) {
        out.notes.push(`${e.name} left out of ${w.name}: it is a ${ex.kind} exercise in your library but a ${e.kind} one in the import.`);
        continue;
      }
      if (!ex) {
        ex = { id: makeId(), name: e.name, kind: e.kind, restSeconds: null, primaryMuscle: e.primaryMuscle, secondaryMuscles: e.secondaryMuscles, archived: false };
        byName.set(e.name.toLowerCase(), ex);
        out.exercises.push(ex);
        out.newExercises.push(ex.name);
      } else if (ex.archived) {
        ex = { ...ex, archived: false };
        byName.set(e.name.toLowerCase(), ex);
        out.exercises.push(ex);
      }
      exercises.push({ exerciseId: ex.id, sets: e.sets.map((s) => ({ ...s })) });
      kept.push(e);
    }
    if (exercises.length === 0) { out.notes.push(`${w.name} skipped: none of its exercises could be used.`); continue; }
    out.preview.push({ ...w, exercises: kept });
    out.workouts.push({ id: makeId(), name: w.name, restSeconds: w.restSeconds, exercises, archived: false });
  }
  return out;
}

/** What to tell an LLM so the answer pastes straight into the import box. */
export const IMPORT_FORMAT_PROMPT = `Reply with JSON only, in this format, so I can import it into my workout app:

{
  "workouts": [
    {
      "name": "Push day",
      "restSeconds": 90,
      "exercises": [
        { "name": "Bench press", "kind": "reps", "muscle": "chest", "secondary": ["triceps", "shoulders"],
          "sets": [ { "reps": 8, "weight": 60 }, { "reps": 8, "weight": 60 }, { "reps": 6, "weight": 65 } ] },
        { "name": "Plank", "kind": "time", "muscle": "core", "sets": [ { "seconds": 60 }, { "seconds": 60 } ] }
      ]
    }
  ]
}

Rules: weight is in kg. "kind" is "reps" or "time". "muscle" and "secondary" are optional and must come from: ${MUSCLE_GROUPS.join(', ')}. Instead of listing sets you can write "sets": 3, "reps": 8, "weight": 60 on the exercise.`;
