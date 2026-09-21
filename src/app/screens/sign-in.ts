import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AUTH, EmailNotConfirmedError } from '../core/auth';

@Component({
  selector: 'app-sign-in',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="screen wrap">
      <form class="body" (submit)="submit($event)">
        <div>
          <div class="logo"><span></span></div>
          <h1 class="brand">Goalbud</h1>
          <p class="tagline">Keep track of the things you meant to do. Nothing here keeps score against you.</p>
        </div>

        <div class="fields">
          @if (linkError(); as err) { <div class="err">{{ err }}</div> }

          @if (sentTo(); as email) {
            <div class="notice">
              <div class="notice-title">Check your inbox</div>
              <div class="notice-body">We sent a confirmation link to <b>{{ email }}</b>. Open it to finish creating your account.</div>
              <button class="btn is-soft-sage" type="button" (click)="resend(email)" [disabled]="busy()">{{ resent() ? 'Sent again' : 'Send the link again' }}</button>
            </div>
          } @else {
            @if (mode() === 'up') {
              <label class="field is-stacked"><span class="field-label">Your name</span>
                <input name="name" autocomplete="name" [value]="name()" (input)="name.set(v($event))" placeholder="What should we call you?" /></label>
            }
            <label class="field is-stacked"><span class="field-label">Email</span>
              <input name="email" type="email" autocomplete="email" inputmode="email" required [value]="email()" (input)="email.set(v($event))" placeholder="you@example.com" /></label>
            <label class="field is-stacked"><span class="field-label">Password</span>
              <input name="password" type="password" [attr.autocomplete]="mode() === 'up' ? 'new-password' : 'current-password'" required minlength="6" [value]="password()" (input)="password.set(v($event))" placeholder="••••••••" /></label>
          }

          @if (unconfirmed(); as email) {
            <div class="notice">
              <div class="notice-title">Confirm your email first</div>
              <div class="notice-body">The account for <b>{{ email }}</b> still needs its confirmation link opened.</div>
              <button class="btn is-soft-sage" type="button" (click)="resend(email)" [disabled]="busy()">{{ resent() ? 'Sent again' : 'Send the link again' }}</button>
            </div>
          }
          @if (error(); as err) { <div class="err">{{ err }}</div> }
        </div>

        <div class="actions">
          @if (!sentTo()) {
            <button class="btn is-block" type="submit" [disabled]="busy()">{{ mode() === 'in' ? 'Sign in' : 'Create account' }}</button>
            <div class="or"><i></i><span>or</span><i></i></div>
            <button class="btn is-block is-outline" type="button" (click)="google()" [disabled]="busy()"><span class="gdot"></span>Continue with Google</button>
          }
        </div>

        <div class="switch">
          @if (sentTo()) {
            <button type="button" (click)="switchMode('in')">Back to sign in</button>
          } @else if (mode() === 'in') {
            New here? <button type="button" (click)="switchMode('up')">Create an account</button>
          } @else {
            Already have an account? <button type="button" (click)="switchMode('in')">Sign in</button>
          }
        </div>
      </form>
    </div>
  `,
  styles: `
    .wrap { padding: 0 22px; }
    .body { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 26px; padding: 30px 0; }
    .logo { width: 64px; height: 64px; border-radius: 22px; background: var(--sage); display: flex; align-items: center; justify-content: center; margin-bottom: 22px; }
    .logo span { width: 24px; height: 24px; border-radius: 50%; border: 6px solid #fff; }
    .brand { font: 900 38px/1.05 var(--font); color: var(--ink); letter-spacing: -.03em; margin: 0; }
    .tagline { font: 500 15px/1.5 var(--font); color: var(--ink-3); margin: 10px 0 0; max-width: 290px; }
    .fields { display: flex; flex-direction: column; gap: 10px; }
    .err { font: 600 13px/1.4 var(--font); color: var(--ink-3); background: var(--fill); border-radius: 14px; padding: 12px 14px; }
    .notice { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; background: var(--sage-tint); border-radius: 14px; padding: 14px 16px; }
    .notice-title { font: 800 14.5px/1.2 var(--font); color: var(--sage-ink-3); }
    .notice-body { font: 500 13.5px/1.45 var(--font); color: var(--sage-ink-2); }
    .actions { display: flex; flex-direction: column; gap: 12px; }
    .or { display: flex; align-items: center; gap: 12px; padding: 2px 0; }
    .or i { flex: 1; height: 1px; background: var(--line-strong); }
    .or span { font: 600 11.5px/1 var(--font); color: var(--ink-5); }
    .gdot { width: 20px; height: 20px; border-radius: 50%; background: var(--line-strong); }
    .switch { text-align: center; font: 600 13.5px/1 var(--font); color: var(--ink-3); }
    .switch button { color: var(--sage); font-weight: 800; }
  `,
})
export class SignInScreen {
  private auth = inject(AUTH);
  private router = inject(Router);
  readonly linkError = this.auth.linkError;
  readonly mode = signal<'in' | 'up'>('in');
  readonly name = signal('');
  readonly email = signal('');
  readonly password = signal('');
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  /** Set once a confirmation email is waiting: the account exists but has no session yet. */
  readonly sentTo = signal<string | null>(null);
  /** Set when sign-in is refused because the email has not been confirmed. */
  readonly unconfirmed = signal<string | null>(null);
  readonly resent = signal(false);

  constructor() {
    // Coming back from a confirmation email or Google, the session lands a moment after the page. Move on when it does.
    effect(() => {
      if (this.auth.user()) void this.router.navigate(['/today'], { replaceUrl: true });
    });
  }

  v(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }
  switchMode(mode: 'in' | 'up') {
    this.mode.set(mode);
    this.error.set(null);
    this.sentTo.set(null);
    this.unconfirmed.set(null);
    this.resent.set(false);
  }
  async submit(e: Event) {
    e.preventDefault();
    const email = this.email().trim();
    await this.run(async () => {
      if (this.mode() === 'in') {
        try {
          await this.auth.signIn(email, this.password());
        } catch (err) {
          if (err instanceof EmailNotConfirmedError) {
            this.unconfirmed.set(email);
            return;
          }
          throw err;
        }
      } else {
        const result = await this.auth.signUp(email, this.password(), this.name().trim());
        if (result.confirmationSent) this.sentTo.set(email);
      }
    });
  }
  google() {
    return this.run(() => this.auth.signInWithGoogle());
  }
  async resend(email: string) {
    this.busy.set(true);
    this.error.set(null);
    this.resent.set(false);
    try {
      await this.auth.resendConfirmation(email);
      this.resent.set(true);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : "That didn't work. Try again.");
    } finally {
      this.busy.set(false);
    }
  }
  private async run(fn: () => Promise<void>) {
    this.busy.set(true);
    this.error.set(null);
    try {
      await fn();
      if (this.auth.user()) await this.router.navigate(['/today']);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : "That didn't work. Try again.");
    } finally {
      this.busy.set(false);
    }
  }
}
