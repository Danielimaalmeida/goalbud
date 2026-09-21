import { InjectionToken, type Signal } from '@angular/core';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
}

export interface SignUpResult {
  /** True when the account exists but is waiting for its confirmation email to be opened. */
  confirmationSent: boolean;
}

/** Sign-in was refused because the account's email has not been confirmed yet. */
export class EmailNotConfirmedError extends Error {
  constructor() {
    super('Email not confirmed');
    this.name = 'EmailNotConfirmedError';
  }
}

export interface AuthProvider {
  /** undefined while the initial session is being restored. */
  readonly user: Signal<AuthUser | null | undefined>;
  /** Set when the page was opened from an email link that no longer works (expired or already used). */
  readonly linkError: Signal<string | null>;
  signIn(email: string, password: string): Promise<void>;
  /** Resolves once the account exists; check `confirmationSent` before promising the user a session. */
  signUp(email: string, password: string, displayName: string): Promise<SignUpResult>;
  /** Send the confirmation email again for an account that has not been confirmed. */
  resendConfirmation(email: string): Promise<void>;
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;
}

export const AUTH = new InjectionToken<AuthProvider>('GoalbudAuth');
