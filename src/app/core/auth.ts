import { InjectionToken, type Signal } from '@angular/core';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
}

export interface AuthProvider {
  /** undefined while the initial session is being restored. */
  readonly user: Signal<AuthUser | null | undefined>;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string, displayName: string): Promise<void>;
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;
}

export const AUTH = new InjectionToken<AuthProvider>('GoalbudAuth');
