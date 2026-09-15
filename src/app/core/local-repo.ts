import { Injectable, signal } from '@angular/core';
import type { AuthProvider, AuthUser } from './auth';
import { seedSnapshot } from './local-seed';
import type { Exercise, Goal, GoalEntry, Profile, Session, Snapshot, Workout } from './model';
import { OfflineError, type Repo } from './repo';

const KEY = 'goalbud.local';
const AUTH_KEY = 'goalbud.local.user';

function read(): Record<string, Snapshot> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
}
function write(all: Record<string, Snapshot>) {
  localStorage.setItem(KEY, JSON.stringify(all));
}

/**
 * In-browser store for development. Seeds demo data the first time a user
 * signs in. Simulates the online-only rule: writes fail while offline.
 */
@Injectable()
export class LocalRepo implements Repo {
  private snap(userId: string): Snapshot {
    const all = read();
    if (!all[userId]) {
      const user = LocalAuth.stored();
      all[userId] = seedSnapshot(userId, user?.email ?? 'daniel@example.com', user?.displayName ?? 'Daniel');
      write(all);
    }
    return all[userId];
  }
  private async save(userId: string, mutate: (s: Snapshot) => void): Promise<void> {
    await new Promise((r) => setTimeout(r, 60));
    if (!navigator.onLine) throw new OfflineError();
    const all = read();
    const s = all[userId] ?? this.snap(userId);
    mutate(s);
    all[userId] = s;
    write(all);
  }
  async loadAll(userId: string): Promise<Snapshot> {
    await new Promise((r) => setTimeout(r, 120));
    return structuredClone(this.snap(userId));
  }
  upsertGoal(u: string, goal: Goal) { return this.save(u, (s) => upsert(s.goals, goal)); }
  upsertEntry(u: string, entry: GoalEntry) { return this.save(u, (s) => upsert(s.entries, entry)); }
  deleteEntry(u: string, id: string) { return this.save(u, (s) => { s.entries = s.entries.filter((e) => e.id !== id); }); }
  upsertExercise(u: string, e: Exercise) { return this.save(u, (s) => upsert(s.exercises, e)); }
  upsertWorkout(u: string, w: Workout) { return this.save(u, (s) => upsert(s.workouts, w)); }
  upsertSession(u: string, x: Session) { return this.save(u, (s) => upsert(s.sessions, x)); }
  updateProfile(u: string, p: Profile) { return this.save(u, (s) => { s.profile = p; }); }
}

function upsert<T extends { id: string }>(list: T[], item: T) {
  const i = list.findIndex((x) => x.id === item.id);
  if (i >= 0) list[i] = item;
  else list.push(item);
}

/** Accepts any email and password. Stores the user in localStorage. */
@Injectable()
export class LocalAuth implements AuthProvider {
  readonly user = signal<AuthUser | null | undefined>(LocalAuth.stored());

  static stored(): AuthUser | null {
    try {
      return JSON.parse(localStorage.getItem(AUTH_KEY) ?? 'null');
    } catch {
      return null;
    }
  }
  private set(u: AuthUser | null) {
    if (u) localStorage.setItem(AUTH_KEY, JSON.stringify(u));
    else localStorage.removeItem(AUTH_KEY);
    this.user.set(u);
  }
  async signIn(email: string): Promise<void> {
    await new Promise((r) => setTimeout(r, 200));
    const name = email.split('@')[0] || 'you';
    this.set({ id: 'local-' + email.toLowerCase(), email, displayName: name[0].toUpperCase() + name.slice(1) });
  }
  async signUp(email: string, _password: string, displayName: string): Promise<void> {
    await new Promise((r) => setTimeout(r, 200));
    this.set({ id: 'local-' + email.toLowerCase(), email, displayName: displayName || email.split('@')[0] });
  }
  async signInWithGoogle(): Promise<void> {
    await this.signIn('daniel@example.com');
  }
  async signOut(): Promise<void> {
    this.set(null);
  }
}
