import { InjectionToken } from '@angular/core';
import type { Exercise, Goal, GoalEntry, Profile, Session, Snapshot, Workout } from './model';

/**
 * Persistence boundary. Every write is a whole-row upsert so the app can
 * stay optimistic and simple; the store owns ordering and rollback.
 */
export interface Repo {
  loadAll(userId: string): Promise<Snapshot>;
  upsertGoal(userId: string, goal: Goal): Promise<void>;
  upsertEntry(userId: string, entry: GoalEntry): Promise<void>;
  deleteEntry(userId: string, entryId: string): Promise<void>;
  upsertExercise(userId: string, exercise: Exercise): Promise<void>;
  upsertWorkout(userId: string, workout: Workout): Promise<void>;
  upsertSession(userId: string, session: Session): Promise<void>;
  updateProfile(userId: string, profile: Profile): Promise<void>;

  /**
   * Permanent deletes. Each one also clears what the database would otherwise
   * refuse to orphan; the store detaches the rest before calling these, so
   * they are safe to retry.
   */
  deleteGoal(userId: string, goalId: string): Promise<void>;
  deleteExercise(userId: string, exerciseId: string): Promise<void>;
  deleteWorkout(userId: string, workoutId: string): Promise<void>;
}

export const REPO = new InjectionToken<Repo>('GoalbudRepo');

export class OfflineError extends Error {
  constructor() {
    super("Couldn't save. Looks like you're offline.");
    this.name = 'OfflineError';
  }
}
