import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AUTH } from '../core/auth';
import { entryFor, pluralise, showsOnToday } from '../core/goals';
import { AppStore } from '../core/store';

@Component({
  selector: 'app-you',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="screen">
      <header class="page-head"><h1 class="h1">You</h1></header>
      <div class="screen-body is-tabbed">
        <div class="card who">
          <div class="avatar">{{ initial() }}</div>
          <div class="grow"><div class="nm">{{ store.profile()?.displayName }}</div><div class="em">{{ store.profile()?.email }}</div></div>
        </div>

        <div class="card">
          <div class="nudge">
            <div class="grow"><div class="nt">Daily nudge</div><div class="nd">One notification, only if something is still open.</div></div>
            <button class="toggle" [class.is-on]="reminderOn()" (click)="toggleReminder()" aria-label="Daily nudge"></button>
          </div>
          @if (reminderOn()) {
            <label class="time">
              <span class="tl">Time</span>
              <input type="time" [value]="store.profile()?.reminderTime" (change)="setTime($event)" />
            </label>
            <div class="looks">
              <div class="ll">Looks like</div>
              <div class="lt">“{{ preview() }}”</div>
            </div>
          }
        </div>

        <div class="list">
          <a class="row" routerLink="/archive"><span class="row-action grow">Archive</span><span class="aside">{{ archiveMeta() }}</span><span class="chev">›</span></a>
          <div class="row"><span class="row-action grow">Week starts</span><span class="aside strong">Monday</span></div>
          <button class="row" (click)="editing.set(!editing())"><span class="row-action grow">Account</span><span class="chev">›</span></button>
          @if (editing()) {
            <div class="row acct">
              <label class="field grow"><input [value]="name()" (input)="name.set(v($event))" placeholder="Your name" /></label>
              <button class="btn is-sm" [disabled]="!name().trim()" (click)="saveName()">Save</button>
            </div>
          }
        </div>

        <button class="card signout" (click)="signOut()">Sign out</button>
        <div class="version">Goalbud · v1</div>
      </div>
    </div>
  `,
  styles: `
    .who { display: flex; align-items: center; gap: 14px; }
    .avatar { width: 52px; height: 52px; border-radius: 50%; background: var(--sage); display: flex; align-items: center; justify-content: center; font: 900 20px var(--font); color: #fff; flex: none; }
    .grow { flex: 1; min-width: 0; }
    .nm { font: 800 17px/1.2 var(--font); color: var(--ink); }
    .em { font: 500 13px/1.3 var(--font); color: var(--ink-4); margin-top: 4px; }
    .nudge { display: flex; align-items: center; gap: 12px; }
    .nt { font: 800 17px/1.2 var(--font); color: var(--ink); }
    .nd { font: 500 12.5px/1.4 var(--font); color: var(--ink-4); margin-top: 4px; }
    .time { margin-top: 16px; display: flex; align-items: center; gap: 12px; background: var(--fill); border-radius: 18px; padding: 12px 16px; }
    .tl { flex: 1; font: 700 14px/1 var(--font); color: var(--ink-3); }
    .time input { border: 0; background: none; outline: 0; font: 900 26px/1 var(--font); color: var(--ink); font-variant-numeric: tabular-nums; text-align: right; }
    .looks { margin-top: 14px; background: var(--sage-tint); border-radius: 16px; padding: 14px; }
    .ll { font: 600 11px/1 var(--font); color: var(--sage-ink-2); letter-spacing: .06em; text-transform: uppercase; margin-bottom: 7px; }
    .lt { font: 600 13.5px/1.45 var(--font); color: var(--sage-ink-3); }
    .aside.strong { font: 600 12.5px/1 var(--font); color: var(--ink-3); }
    .acct { gap: 8px; }
    .acct .field { padding: 10px 14px; border-radius: 14px; }
    .acct .field input { font-size: 15px; }
    .signout { display: flex; align-items: center; justify-content: center; padding: 17px; border-radius: var(--r-tile); font: 800 14px/1 var(--font); color: var(--ink-3); width: 100%; }
  `,
})
export class YouScreen {
  readonly store = inject(AppStore);
  private auth = inject(AUTH);
  readonly editing = signal(false);
  readonly name = signal('');

  readonly initial = computed(() => (this.store.profile()?.displayName ?? '?').trim().charAt(0).toUpperCase());
  readonly reminderOn = computed(() => !!this.store.profile()?.reminderTime);
  readonly archiveMeta = computed(() => {
    const g = this.store.goals().filter((x) => x.state === 'archived').length;
    const e = this.store.exercises().filter((x) => x.archived).length;
    return g || e ? `${pluralise(g, 'goal')} · ${pluralise(e, 'exercise')}` : 'empty';
  });
  /** What tonight's message would say: what is open, never what was missed. */
  readonly preview = computed(() => {
    const today = this.store.today();
    const entries = this.store.entries();
    const open = this.store.goals().filter((g) => showsOnToday(g, entries, today) && !entryFor(entries, g.id, today));
    if (open.length === 0) return 'Nothing is sent when everything is done.';
    const names = open.slice(0, 3).map((g) => g.name);
    return `You have ${pluralise(open.length, 'goal')} today: ${names.join(', ')}${open.length > 3 ? '…' : '.'}`;
  });

  constructor() {
    queueMicrotask(() => this.name.set(this.store.profile()?.displayName ?? ''));
  }
  v(e: Event) { return (e.target as HTMLInputElement).value; }
  toggleReminder() {
    return this.store.updateProfile({ reminderTime: this.reminderOn() ? null : '18:30' });
  }
  setTime(e: Event) {
    const t = this.v(e);
    if (t) return this.store.updateProfile({ reminderTime: t });
    return Promise.resolve();
  }
  async saveName() {
    await this.store.updateProfile({ displayName: this.name().trim() });
    this.editing.set(false);
  }
  signOut() { return this.auth.signOut(); }
}
