import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AUTH } from '../core/auth';

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
          @if (mode() === 'up') {
            <label class="field is-stacked"><span class="field-label">Your name</span>
              <input name="name" autocomplete="name" [value]="name()" (input)="name.set(v($event))" placeholder="What should we call you?" /></label>
          }
          <label class="field is-stacked"><span class="field-label">Email</span>
            <input name="email" type="email" autocomplete="email" inputmode="email" required [value]="email()" (input)="email.set(v($event))" placeholder="you@example.com" /></label>
          <label class="field is-stacked"><span class="field-label">Password</span>
            <input name="password" type="password" [attr.autocomplete]="mode() === 'up' ? 'new-password' : 'current-password'" required minlength="6" [value]="password()" (input)="password.set(v($event))" placeholder="••••••••" /></label>
          @if (error(); as err) { <div class="err">{{ err }}</div> }
        </div>

        <div class="actions">
          <button class="btn is-block" type="submit" [disabled]="busy()">{{ mode() === 'in' ? 'Sign in' : 'Create account' }}</button>
          <div class="or"><i></i><span>or</span><i></i></div>
          <button class="btn is-block is-outline" type="button" (click)="google()" [disabled]="busy()"><span class="gdot"></span>Continue with Google</button>
        </div>

        <div class="switch">
          @if (mode() === 'in') {
            New here? <button type="button" (click)="mode.set('up')">Create an account</button>
          } @else {
            Already have an account? <button type="button" (click)="mode.set('in')">Sign in</button>
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
    .fields label { display: block; }
    .err { font: 600 13px/1.4 var(--font); color: var(--ink-3); background: var(--fill); border-radius: 14px; padding: 12px 14px; }
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
  readonly mode = signal<'in' | 'up'>('in');
  readonly name = signal('');
  readonly email = signal('');
  readonly password = signal('');
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);

  constructor() {
    // Coming back from a confirmation email or Google, the session lands a moment after the page. Move on when it does.
    effect(() => {
      if (this.auth.user()) void this.router.navigate(['/today'], { replaceUrl: true });
    });
  }

  v(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }
  async submit(e: Event) {
    e.preventDefault();
    await this.run(() => this.mode() === 'in'
      ? this.auth.signIn(this.email().trim(), this.password())
      : this.auth.signUp(this.email().trim(), this.password(), this.name().trim()));
  }
  google() {
    return this.run(() => this.auth.signInWithGoogle());
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
