/** Plain local date string, YYYY-MM-DD. Never a UTC timestamp. */
export type LocalDate = string;

export type GoalShape = 'scheduled' | 'weekly' | 'log' | 'long';
export type GoalState = 'active' | 'paused' | 'archived';

export const GOAL_COLOURS = ['sage', 'teal', 'blue', 'purple', 'rose', 'rust', 'gold', 'stone'] as const;
export type GoalColour = (typeof GOAL_COLOURS)[number];
export const DEFAULT_COLOUR: GoalColour = 'sage';

export const COLOUR_HEX: Record<GoalColour, string> = {
  sage: '#3F6F52',
  teal: '#2F7D8C',
  blue: '#4A5EC8',
  purple: '#7E5BA6',
  rose: '#C25B77',
  rust: '#C2643A',
  gold: '#C79A2E',
  stone: '#7A7468',
};

/** Weekday numbers: 1 = Monday … 7 = Sunday. Week starts Monday. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type Recurrence =
  | { kind: 'daily' }
  | { kind: 'everyN'; n: number; anchor: LocalDate }
  | { kind: 'weekdays'; days: Weekday[] };

/**
 * A goal's target and schedule can change, but only from the current week
 * forward. Each edit adds a version effective from a Monday; past weeks keep
 * the version they had.
 */
export interface ScheduleVersion {
  /** Monday the version applies from. */
  from: LocalDate;
  recurrence?: Recurrence; // scheduled goals
  timesPerWeek?: number; // weekly count goals
}

export interface PauseSpan {
  from: LocalDate;
  /** Exclusive: the first day the goal is active again. Null while paused. */
  to: LocalDate | null;
}

export interface Goal {
  id: string;
  name: string;
  shape: GoalShape;
  colour: GoalColour | null;
  icon: string | null;
  isExercise: boolean;
  state: GoalState;
  /** Long goal this goal belongs to, if any. */
  parentId: string | null;
  schedule: ScheduleVersion[];
  pauses: PauseSpan[];
  /** Long goals only. */
  targetDate: LocalDate | null;
  /** Long goals only: set when the user taps it done. */
  completedOn: LocalDate | null;
  createdOn: LocalDate;
  archivedOn: LocalDate | null;
  sortOrder: number;
}

export type EntryKind = 'done' | 'skip';

/** One row per goal per day. "done" counts; "skip" never does. */
export interface GoalEntry {
  id: string;
  goalId: string;
  date: LocalDate;
  kind: EntryKind;
  /** ISO timestamp, for the "Logged 8:12" line only. */
  loggedAt: string;
}

export type ExerciseKind = 'reps' | 'time';

export const MUSCLE_GROUPS = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms',
  'core', 'hips', 'glutes', 'quads', 'hamstrings', 'calves',
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders', biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms',
  core: 'Core', hips: 'Hips', glutes: 'Glutes', quads: 'Quads', hamstrings: 'Hamstrings', calves: 'Calves',
};

export interface Exercise {
  id: string;
  name: string;
  kind: ExerciseKind;
  restSeconds: number | null;
  /** Optional. The muscle the exercise is mainly for. */
  primaryMuscle: MuscleGroup | null;
  /** Optional. Muscles that also work, never including the primary one. */
  secondaryMuscles: MuscleGroup[];
  archived: boolean;
}

export interface SetTarget {
  reps: number | null;
  weight: number | null;
  seconds: number | null;
}

export interface WorkoutExercise {
  exerciseId: string;
  sets: SetTarget[];
}

export interface Workout {
  id: string;
  name: string;
  restSeconds: number | null;
  exercises: WorkoutExercise[];
  archived: boolean;
}

export interface SessionSet {
  target: SetTarget;
  reps: number | null;
  weight: number | null;
  seconds: number | null;
  /** ISO timestamp when ticked, null while open. */
  doneAt: string | null;
}

export interface SessionExercise {
  exerciseId: string;
  /** Snapshot of the name at the time. */
  name: string;
  kind: ExerciseKind;
  restSeconds: number;
  sets: SessionSet[];
}

export type SessionClosedBy = 'user' | 'midnight';

/** A live or past workout session. A snapshot: never linked to template content. */
export interface Session {
  id: string;
  workoutId: string | null;
  workoutName: string;
  /**
   * The exercise goal this session counts for, if any. Set when started from
   * a goal on Today, or chosen on Finish. Only this goal is ticked.
   */
  goalId: string | null;
  date: LocalDate;
  startedAt: string;
  endedAt: string | null;
  closedBy: SessionClosedBy | null;
  /** ISO timestamp while the session is paused, null otherwise. */
  pausedAt: string | null;
  /** Total seconds spent paused, so elapsed time excludes them. */
  pausedSeconds: number;
  exercises: SessionExercise[];
}

export interface Profile {
  id: string;
  displayName: string;
  email: string;
  /** "HH:MM" local, null = reminder off. */
  reminderTime: string | null;
}

export interface Snapshot {
  profile: Profile;
  goals: Goal[];
  entries: GoalEntry[];
  exercises: Exercise[];
  workouts: Workout[];
  sessions: Session[];
}

export const APP_DEFAULT_REST_SECONDS = 90;
