import { Injectable, inject, InjectionToken, signal } from '@angular/core';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { EmailNotConfirmedError, type AuthProvider, type AuthUser, type SignUpResult } from './auth';
import type { Exercise, Goal, GoalEntry, Profile, Session, Snapshot, Workout } from './model';
import { OfflineError, type Repo } from './repo';

export const SUPABASE = new InjectionToken<SupabaseClient>('Supabase', {
  providedIn: 'root',
  factory: () => createClient(environment.supabaseUrl, environment.supabaseAnonKey),
});

function fail(error: { message: string; code?: string; details?: string | null } | null, what = ''): void {
  if (!error) return;
  if (!navigator.onLine || /failed to fetch|networkerror|load failed/i.test(error.message)) throw new OfflineError();
  throw new Error(`${what ? what + ': ' : ''}${error.message}${error.code ? ` (${error.code})` : ''}`);
}

/** PostgREST's transient "this token was issued in the future" rejection (PGRST303). */
function clockSkewed(error: { message: string; code?: string } | null): boolean {
  return !!error && (error.code === 'PGRST303' || /issued at future/i.test(error.message));
}

/* Row ↔ model mapping. Rows are snake_case; nested lists live in jsonb. */
const toGoal = (r: any): Goal => ({
  id: r.id, name: r.name, shape: r.shape, colour: r.colour, icon: r.icon, isExercise: r.is_exercise,
  state: r.state, parentId: r.parent_id, schedule: r.schedule ?? [], pauses: r.pauses ?? [],
  targetDate: r.target_date, completedOn: r.completed_on, createdOn: r.created_on, archivedOn: r.archived_on,
  sortOrder: r.sort_order,
});
const fromGoal = (userId: string, g: Goal) => ({
  id: g.id, user_id: userId, name: g.name, shape: g.shape, colour: g.colour, icon: g.icon, is_exercise: g.isExercise,
  state: g.state, parent_id: g.parentId, schedule: g.schedule, pauses: g.pauses, target_date: g.targetDate,
  completed_on: g.completedOn, created_on: g.createdOn, archived_on: g.archivedOn, sort_order: g.sortOrder,
});
const toEntry = (r: any): GoalEntry => ({ id: r.id, goalId: r.goal_id, date: r.date, kind: r.kind, loggedAt: r.logged_at });
const fromEntry = (userId: string, e: GoalEntry) => ({ id: e.id, user_id: userId, goal_id: e.goalId, date: e.date, kind: e.kind, logged_at: e.loggedAt });
const toExercise = (r: any): Exercise => ({
  id: r.id, name: r.name, kind: r.kind, restSeconds: r.rest_seconds,
  primaryMuscle: r.primary_muscle ?? null, secondaryMuscles: r.secondary_muscles ?? [], archived: r.archived,
});
const fromExercise = (userId: string, e: Exercise) => ({
  id: e.id, user_id: userId, name: e.name, kind: e.kind, rest_seconds: e.restSeconds,
  primary_muscle: e.primaryMuscle, secondary_muscles: e.secondaryMuscles, archived: e.archived,
});
const toWorkout = (r: any): Workout => ({ id: r.id, name: r.name, restSeconds: r.rest_seconds, exercises: r.exercises ?? [], archived: r.archived });
const fromWorkout = (userId: string, w: Workout) => ({ id: w.id, user_id: userId, name: w.name, rest_seconds: w.restSeconds, exercises: w.exercises, archived: w.archived });
const toSession = (r: any): Session => ({
  id: r.id, workoutId: r.workout_id, workoutName: r.workout_name, goalId: r.goal_id ?? null, date: r.date, startedAt: r.started_at,
  endedAt: r.ended_at, closedBy: r.closed_by, pausedAt: r.paused_at ?? null, pausedSeconds: r.paused_seconds ?? 0,
  exercises: r.exercises ?? [],
});
const fromSession = (userId: string, s: Session) => ({
  id: s.id, user_id: userId, workout_id: s.workoutId, workout_name: s.workoutName, goal_id: s.goalId, date: s.date,
  started_at: s.startedAt, ended_at: s.endedAt, closed_by: s.closedBy, paused_at: s.pausedAt, paused_seconds: s.pausedSeconds,
  exercises: s.exercises,
});
const toProfile = (r: any, fallback: { email: string; displayName: string }): Profile => ({
  id: r?.id, displayName: r?.display_name ?? fallback.displayName, email: r?.email ?? fallback.email,
  reminderTime: r?.reminder_time ? String(r.reminder_time).slice(0, 5) : null,
});

@Injectable()
export class SupabaseRepo implements Repo {
  private db = inject(SUPABASE);
  private auth = inject(SupabaseAuth);

  async loadAll(userId: string): Promise<Snapshot> {
    const read = () => Promise.all([
      this.db.from('profiles').select('*').eq('id', userId).maybeSingle(),
      this.db.from('goals').select('*').eq('user_id', userId).order('sort_order'),
      this.db.from('goal_entries').select('*').eq('user_id', userId),
      this.db.from('exercises').select('*').eq('user_id', userId).order('name'),
      this.db.from('workouts').select('*').eq('user_id', userId).order('name'),
      this.db.from('sessions').select('*').eq('user_id', userId).order('started_at', { ascending: false }),
    ]);
    let results = await read();
    // Right after a fresh sign-in or a confirmation link, PostgREST can briefly reject the
    // just-issued JWT ("JWT issued at future", PGRST303) while its clock catches up with the
    // auth server's. The session is fine, so wait a moment and read again.
    for (let attempt = 0; attempt < 2 && results.some((r) => clockSkewed(r.error)); attempt++) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      results = await read();
    }
    const [profile, goals, entries, exercises, workouts, sessions] = results;
    const named = { profile, goals, entries, exercises, workouts, sessions };
    for (const [what, r] of Object.entries(named)) fail(r.error, what);
    const u = this.auth.user();
    return {
      profile: toProfile(profile.data, { email: u?.email ?? '', displayName: u?.displayName ?? '' }),
      goals: (goals.data ?? []).map(toGoal),
      entries: (entries.data ?? []).map(toEntry),
      exercises: (exercises.data ?? []).map(toExercise),
      workouts: (workouts.data ?? []).map(toWorkout),
      sessions: (sessions.data ?? []).map(toSession),
    };
  }
  async upsertGoal(u: string, g: Goal) { fail((await this.db.from('goals').upsert(fromGoal(u, g))).error); }
  async upsertEntry(u: string, e: GoalEntry) { fail((await this.db.from('goal_entries').upsert(fromEntry(u, e), { onConflict: 'goal_id,date' })).error); }
  async deleteEntry(u: string, id: string) { fail((await this.db.from('goal_entries').delete().eq('id', id).eq('user_id', u)).error); }
  async upsertExercise(u: string, e: Exercise) { fail((await this.db.from('exercises').upsert(fromExercise(u, e))).error); }
  async upsertWorkout(u: string, w: Workout) { fail((await this.db.from('workouts').upsert(fromWorkout(u, w))).error); }
  async upsertSession(u: string, s: Session) { fail((await this.db.from('sessions').upsert(fromSession(u, s))).error); }
  async updateProfile(u: string, p: Profile) {
    fail((await this.db.from('profiles').upsert({ id: u, display_name: p.displayName, email: p.email, reminder_time: p.reminderTime })).error);
  }

  /* Deletes. Dependants are cleared first: the database refuses to orphan them. */
  async deleteGoal(u: string, id: string) {
    fail((await this.db.from('goal_entries').delete().eq('goal_id', id).eq('user_id', u)).error, 'history');
    fail((await this.db.from('goals').delete().eq('id', id).eq('user_id', u)).error, 'goal');
  }
  async deleteExercise(u: string, id: string) {
    fail((await this.db.from('exercises').delete().eq('id', id).eq('user_id', u)).error, 'exercise');
  }
  async deleteWorkout(u: string, id: string) {
    fail((await this.db.from('sessions').update({ workout_id: null }).eq('workout_id', id).eq('user_id', u)).error, 'sessions');
    fail((await this.db.from('workouts').delete().eq('id', id).eq('user_id', u)).error, 'workout');
  }
}

@Injectable()
export class SupabaseAuth implements AuthProvider {
  private db = inject(SUPABASE);
  readonly user = signal<AuthUser | null | undefined>(undefined);
  readonly linkError = signal<string | null>(null);

  constructor() {
    this.linkError.set(linkErrorFromUrl());
    this.db.auth.getSession().then(({ data }) => this.user.set(toUser(data.session?.user)));
    this.db.auth.onAuthStateChange((_event, session) => {
      this.user.set(toUser(session?.user));
      // A failed link is only worth explaining while the user is still signed out.
      if (session) this.linkError.set(null);
    });
  }
  async signIn(email: string, password: string) {
    const { error } = await this.db.auth.signInWithPassword({ email, password });
    if (error) throw isEmailUnconfirmed(error) ? new EmailNotConfirmedError() : new Error(error.message);
  }
  async signUp(email: string, password: string, displayName: string): Promise<SignUpResult> {
    const { data, error } = await this.db.auth.signUp({
      email, password,
      options: { data: { display_name: displayName }, emailRedirectTo: redirectTo() },
    });
    if (error) throw new Error(error.message);
    // With email confirmation on, the account exists but has no session yet.
    return { confirmationSent: !data.session };
  }
  async resendConfirmation(email: string) {
    const { error } = await this.db.auth.resend({ type: 'signup', email, options: { emailRedirectTo: redirectTo() } });
    if (error) throw new Error(error.message);
  }
  async signInWithGoogle() {
    const { error } = await this.db.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectTo() } });
    if (error) throw new Error(error.message);
  }
  async signOut() {
    await this.db.auth.signOut();
  }
}

function redirectTo(): string {
  return location.origin + '/today';
}

/** GoTrue refuses sign-in with this code (or message) until the confirmation link is opened. */
function isEmailUnconfirmed(error: { code?: string; message: string }): boolean {
  return error.code === 'email_not_confirmed' || /not confirmed/i.test(error.message);
}

/**
 * A confirmation link that was already used (or has expired) lands back here with
 * `error_code` in the hash instead of tokens. Read it before the client clears it.
 */
function linkErrorFromUrl(): string | null {
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  if (!params.get('error') && !params.get('error_code')) return null;
  return params.get('error_code') === 'otp_expired'
    ? 'That link has expired or was already used. Sign in, or send yourself a new one.'
    : "That sign-in link didn't work. Please try again.";
}

function toUser(u: { id: string; email?: string; user_metadata?: Record<string, any> } | null | undefined): AuthUser | null {
  if (!u) return null;
  const email = u.email ?? '';
  const meta = u.user_metadata ?? {};
  const name = meta['display_name'] || meta['full_name'] || meta['name'] || email.split('@')[0] || 'you';
  return { id: u.id, email, displayName: name };
}
