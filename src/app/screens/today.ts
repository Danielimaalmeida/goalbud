import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatClock, formatLong, partOfDay } from '../core/dates';
import { countWord, describeSchedule, entryFor, showsOnToday, weeklyCount } from '../core/goals';
import type { Goal, GoalEntry } from '../core/model';
import { AppStore } from '../core/store';
import { Glyph } from '../ui/glyph';
import { goalVar } from '../ui/goal-colour';
import { WorkoutPicker } from './workout-picker';

interface Item {
  goal: Goal;
  parent: Goal | null;
  entry: GoalEntry | undefined;
  meta: string;
}

@Component({
  selector: 'app-today',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Glyph, WorkoutPicker],
  template: `
    <div class="screen">
      <header class="head">
        <div class="date-line">{{ dateLine() }}</div>
        <h1 class="h1-lg">{{ greeting() }}</h1>
        @if (lead(); as l) { <div class="lead">{{ l }}</div> }
      </header>

      @if (store.activeGoals().length === 0) {
        <div class="empty">
          <div class="glyph"></div>
          <div class="title">Nothing here yet</div>
          <div class="body">Add the first thing you want to keep track of. One is plenty to start.</div>
          <a class="btn" routerLink="/goals/new"><span class="plus">+</span>Add a goal</a>
          <a class="after" routerLink="/workouts">or set up a workout</a>
        </div>
      } @else {
        <div class="screen-body is-tabbed">
          @for (it of open(); track it.goal.id) {
            <article class="tcard" [class.is-skipped]="it.entry?.kind === 'skip'" [style.--goal]="colour(it.goal)">
              <div class="main">
                <button class="cbody" (click)="toggle(it.goal.id)">
                  <span class="chip-icon" [class.is-muted]="it.entry?.kind === 'skip'">
                    @if (it.goal.icon) { <app-glyph [name]="it.goal.icon" /> } @else { <i class="nodot"></i> }
                  </span>
                  <span class="text">
                    @if (it.parent) { <span class="parent">{{ it.parent.name }}</span> }
                    <span class="ctitle">{{ it.goal.name }}</span>
                    <span class="cmeta">{{ it.entry?.kind === 'skip' ? 'Life happens. You can pick it up later.' : it.meta }}</span>
                  </span>
                </button>
                @if (it.entry?.kind === 'skip') {
                  <button class="dash" (click)="unskip(it.goal)" aria-label="Pick it back up"></button>
                } @else if (it.goal.isExercise) {
                  <button class="play" (click)="picker.set(it.goal)" aria-label="Pick a workout"></button>
                } @else if (it.goal.shape === 'weekly') {
                  <button class="btn is-goal plus1" (click)="mark(it.goal)">+1</button>
                } @else if (it.goal.shape === 'log') {
                  <button class="btn logbtn" (click)="mark(it.goal)">Log</button>
                } @else {
                  <button class="ring" (click)="mark(it.goal)" aria-label="Done"></button>
                }
              </div>
              @if (expanded() === it.goal.id && it.entry?.kind !== 'skip') {
                <div class="actions">
                  <button class="btn is-soft is-sm" (click)="skip(it.goal)">Skip today</button>
                  <a class="btn is-soft is-sm" [routerLink]="['/goals', it.goal.id]">History</a>
                </div>
              }
            </article>
          }

          @if (open().length === 0) {
            <div class="card quiet">
              <div class="qt">{{ done().length ? 'That’s everything for today.' : 'Nothing due today.' }}</div>
              <div class="qb">{{ done().length ? 'Nice. The rest of the day is yours.' : 'Weekly and anytime goals show up here; scheduled ones only on their days.' }}</div>
            </div>
          }

          @if (done().length) {
            <div class="eyebrow">Done today · {{ done().length }}</div>
            @for (it of done(); track it.goal.id) {
              <article class="tcard is-done" [style.--goal]="colour(it.goal)">
                <div class="main">
                  <a class="cbody" [routerLink]="['/goals', it.goal.id]">
                    <span class="chip-icon is-done">
                      @if (it.goal.icon) { <app-glyph [name]="it.goal.icon" /> } @else { <i class="nodot"></i> }
                    </span>
                    <span class="text">
                      @if (it.parent) { <span class="parent">{{ it.parent.name }}</span> }
                      <span class="ctitle">{{ it.goal.name }}</span>
                      <span class="cmeta">{{ it.meta }}</span>
                    </span>
                  </a>
                  <button class="check" (click)="undo(it.goal)" aria-label="Undo"></button>
                </div>
              </article>
            }
          }
        </div>
      }

      @if (picker(); as g) { <app-workout-picker [goal]="g" (close)="picker.set(null)" /> }
    </div>
  `,
  styles: `
    .head { padding: 22px 20px 14px; }
    .head .h1-lg { margin-top: 8px; }
    .tcard { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-card); padding: 16px; display: flex; flex-direction: column; gap: 14px; }
    .tcard.is-skipped { background: var(--surface-muted); border-color: var(--line-muted); }
    .tcard.is-done { background: var(--sage-tint); border-color: var(--sage-tint-2); }
    .main { display: flex; align-items: center; gap: 14px; }
    .cbody { flex: 1; min-width: 0; display: flex; align-items: center; gap: 14px; text-align: left; }
    .text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .ctitle { font: 800 18px/1.2 var(--font); color: var(--ink); }
    .is-skipped .ctitle { color: var(--ink-3); }
    .is-done .ctitle { color: var(--sage-ink); }
    .cmeta { font: 500 13px/1.3 var(--font); color: var(--ink-3); margin-top: 4px; }
    .is-skipped .cmeta { color: var(--ink-4); }
    .is-done .cmeta { color: var(--sage-ink-2); }
    .parent { font: 600 11px/1 var(--font); color: var(--goal); letter-spacing: .05em; text-transform: uppercase; margin-bottom: 5px; }
    .nodot { width: 14px; height: 14px; border-radius: 50%; background: currentColor; opacity: .55; }
    .actions { display: flex; gap: 8px; }
    .plus1 { padding: 16px 20px; font-size: 16px; }
    .logbtn { background: color-mix(in srgb, var(--goal) 14%, white); color: color-mix(in srgb, var(--goal) 75%, black); padding: 16px 20px; font-size: 15px; }
    .quiet { background: var(--surface-muted); border-color: var(--line-muted); }
    .qt { font: 800 16px/1.3 var(--font); color: var(--ink); }
    .qb { font: 500 13px/1.45 var(--font); color: var(--ink-3); margin-top: 4px; }
    .plus { font-size: 18px; }
    .empty { padding-bottom: 120px; }
  `,
})
export class TodayScreen {
  readonly store = inject(AppStore);
  readonly expanded = signal<string | null>(null);
  readonly picker = signal<Goal | null>(null);
  private touched = false;

  readonly dateLine = computed(() => formatLong(this.store.today()));
  readonly greeting = computed(() => `${partOfDay()}, ${this.store.profile()?.displayName.split(' ')[0] ?? 'you'}`);

  private readonly items = computed<Item[]>(() => {
    const today = this.store.today();
    const goals = this.store.goals();
    const entries = this.store.entries();
    return goals
      .filter((g) => showsOnToday(g, entries, today))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.createdOn.localeCompare(b.createdOn))
      .map((goal) => {
        const entry = entryFor(entries, goal.id, today);
        const parent = goal.parentId ? goals.find((g) => g.id === goal.parentId) ?? null : null;
        return { goal, parent, entry, meta: this.meta(goal, entry, entries, today) };
      });
  });
  readonly open = computed(() => this.items().filter((i) => i.entry?.kind !== 'done'));
  readonly done = computed(() => this.items().filter((i) => i.entry?.kind === 'done'));

  readonly lead = computed(() => {
    const n = this.open().filter((i) => !i.entry).length;
    if (this.store.activeGoals().length === 0) return null;
    if (n === 0) return this.done().length ? 'All done for today.' : null;
    return n === 1 ? 'One thing is open today.' : `${countWord(n)} things are open today.`;
  });

  constructor() {
    // Skip sits in the open on the first active card until the user picks another.
    queueMicrotask(() => {
      if (!this.touched) this.expanded.set(this.open().find((i) => !i.entry)?.goal.id ?? null);
    });
  }

  private meta(goal: Goal, entry: GoalEntry | undefined, entries: GoalEntry[], today: string): string {
    const logged = entry?.kind === 'done' ? `Logged ${formatClock(entry.loggedAt)}` : null;
    if (goal.shape === 'weekly') {
      const n = weeklyCount(entries, goal.id, today);
      const count = `${n} this week`;
      return logged ? `${logged} · ${count}` : `${count} · ${describeSchedule(goal)}`;
    }
    if (logged) return logged;
    if (goal.isExercise) return 'Pick a workout to start';
    if (goal.shape === 'log') return 'Whenever';
    return describeSchedule(goal);
  }

  colour(goal: Goal) {
    return goalVar(goal);
  }
  toggle(id: string) {
    this.touched = true;
    this.expanded.set(this.expanded() === id ? null : id);
  }
  mark(g: Goal) { return this.store.setDone(g.id, this.store.today(), true); }
  undo(g: Goal) { return this.store.setDone(g.id, this.store.today(), false); }
  skip(g: Goal) { return this.store.skip(g.id, this.store.today()); }
  unskip(g: Goal) { return this.store.unskip(g.id, this.store.today()); }
}
