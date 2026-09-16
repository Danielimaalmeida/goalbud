import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { addMonths, daysInMonth, formatDayMonth, formatMonthYear, weekday, yearMonth, ymToDate } from '../core/dates';
import { goalDeleteDetail } from '../core/deletes';
import { childCompletions, dayState, describeSchedule, doneInMonth, existsOn, pluralise, totalDone, type DayState } from '../core/goals';
import type { Goal } from '../core/model';
import { AppStore } from '../core/store';
import { ConfirmDelete } from '../ui/confirm-delete';
import { goalVar } from '../ui/goal-colour';

interface Cell {
  date: string;
  day: number;
  state: DayState;
  past: boolean;
  tappable: boolean;
}

/** Per-goal history: month calendar, one count, and the edit/pause/archive/delete actions. */
@Component({
  selector: 'app-goal-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ConfirmDelete],
  template: `
    @if (goal(); as g) {
      <div class="screen" [style.--goal]="colour(g)">
        <header class="detail-head">
          <button class="back" (click)="back()" aria-label="Back">‹</button>
          <div class="grow">
            <div class="title">{{ g.name }}</div>
            <div class="sub">{{ subtitle(g) }}</div>
          </div>
          <span class="dot lg"></span>
        </header>

        <div class="screen-body">
          @if (g.shape === 'long') {
            <div class="card stats">
              <div class="stat"><div class="num">{{ childDone() }}</div><div class="label">child completions</div></div>
              <div class="divider"></div>
              <div class="stat"><div class="num sm">{{ g.targetDate ? fmt(g.targetDate) : '—' }}</div><div class="label">target</div></div>
            </div>
            <div class="eyebrow">Part of this</div>
            @if (children().length) {
              <div class="list">
                @for (c of children(); track c.id) {
                  <a class="row" [routerLink]="['/goals', c.id]" [style.--goal]="colour(c)">
                    <span class="dot"></span>
                    <span class="grow"><span class="name">{{ c.name }}</span><span class="meta">{{ describe(c) }}</span></span>
                    <span class="chev">›</span>
                  </a>
                }
              </div>
            } @else {
              <div class="card quiet">Nothing yet. Add a goal and pick “{{ g.name }}” as what it’s part of.</div>
            }
            <button class="card done-toggle" (click)="toggleLong(g)">
              <span class="grow"><span class="row-action">{{ g.completedOn ? 'Done' : 'Mark as done' }}</span>
                <span class="hint">{{ g.completedOn ? 'Finished ' + fmt(g.completedOn) + '. Tap to undo.' : 'Only when you say so' }}</span></span>
              @if (g.completedOn) { <span class="check is-sm"></span> } @else { <span class="ring is-sm"></span> }
            </button>
          } @else {
            <div class="card stats">
              <div class="stat"><div class="num">{{ total() }}</div><div class="label">days logged</div></div>
              <div class="divider"></div>
              <div class="stat"><div class="num">{{ thisMonth() }}</div><div class="label">this month</div></div>
            </div>

            <div class="card">
              <div class="cal-head">
                <div class="month">{{ monthLabel() }}</div>
                <button class="nav" (click)="move(-1)" aria-label="Previous month">‹</button>
                <button class="nav" [disabled]="!canForward()" (click)="move(1)" aria-label="Next month">›</button>
              </div>
              <div class="grid heads"><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span></div>
              <div class="grid">
                @for (_ of leading(); track $index) { <span></span> }
                @for (c of cells(); track c.date) {
                  <button class="cell" [class]="'cell is-' + c.state" [class.is-past]="c.past" [disabled]="!c.tappable" (click)="tap(c)" [attr.aria-label]="c.date">
                    @if (c.state === 'skipped') { <i></i> } @else { {{ c.day }} }
                  </button>
                }
              </div>
              <div class="legend">
                <span><i class="l-done"></i>Done</span>
                <span><i class="l-skip"></i>Skipped</span>
                <span><i class="l-today"></i>Today</span>
              </div>
            </div>
          }

          <div class="list">
            @if (g.state !== 'archived') {
              <a class="row" [routerLink]="['/goals', g.id, 'edit']">
                <span class="row-action grow">Edit goal</span><span class="aside">from this week on</span><span class="chev">›</span>
              </a>
              @if (g.state === 'paused') {
                <button class="row" (click)="store.resume(g)">
                  <span class="row-action grow">Resume</span><span class="aside">back on Today</span><span class="chev">›</span>
                </button>
              } @else {
                <button class="row" (click)="store.pause(g)">
                  <span class="row-action grow">Pause</span><span class="aside">hides it from Today</span><span class="chev">›</span>
                </button>
              }
              <button class="row" (click)="archive(g)">
                <span class="row-action is-quiet grow">Archive</span><span class="aside">history is kept</span><span class="chev">›</span>
              </button>
            } @else {
              <button class="row" (click)="store.restoreGoal(g)">
                <span class="row-action grow">Restore</span><span class="aside">back to active</span><span class="chev">›</span>
              </button>
            }
            <button class="row" (click)="confirming.set(true)">
              <span class="row-action is-danger grow">Delete</span><span class="aside">gone for good</span><span class="chev">›</span>
            </button>
          </div>
        </div>
      </div>

      @if (confirming()) {
        <app-confirm-delete [name]="g.name" [detail]="deleteDetail(g)" (confirmed)="remove(g)" (cancelled)="confirming.set(false)" />
      }
    }
  `,
  styles: `
    .grow { flex: 1; min-width: 0; }
    .dot.lg { width: 20px; height: 20px; }
    .num.sm { font-size: 22px; line-height: 34px; }
    .cal-head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
    .month { font: 800 17px/1 var(--font); color: var(--ink); flex: 1; }
    .nav { font: 800 18px/1 var(--font); color: var(--ink-6); padding: 4px 8px; }
    .nav:disabled { color: var(--line-strong); }
    .grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; }
    .heads { margin-bottom: 8px; }
    .heads span { text-align: center; font: 700 11px/1 var(--font); color: var(--ink-5); }
    .cell { aspect-ratio: 1; border-radius: 50%; display: flex; align-items: center; justify-content: center; font: 600 13px var(--font); color: var(--sand-2); }
    .cell.is-past { color: var(--ink-7); }
    .cell.is-done { background: var(--goal); color: #fff; font-weight: 700; }
    .cell.is-skipped { background: var(--line-soft); }
    .cell.is-skipped i { width: 13px; height: 3px; border-radius: 2px; background: var(--ink-6); }
    .cell.is-open { border: 3px solid var(--ink); color: var(--ink); font-weight: 800; }
    .legend { display: flex; gap: 16px; margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--line-soft); }
    .legend span { display: flex; align-items: center; gap: 7px; font: 600 11.5px/1 var(--font); color: var(--ink-3); }
    .legend i { width: 14px; height: 14px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; }
    .l-done { background: var(--goal); }
    .l-skip { background: var(--line-soft); } .l-skip::after { content: ""; width: 7px; height: 2px; background: var(--ink-6); }
    .l-today { border: 2px solid var(--ink); }
    .done-toggle { display: flex; align-items: center; gap: 12px; padding: 16px; width: 100%; }
    .hint { display: block; font: 500 12.5px/1.35 var(--font); color: var(--ink-4); margin-top: 4px; }
    .quiet { font: 500 13.5px/1.45 var(--font); color: var(--ink-3); background: var(--surface-muted); border-color: var(--line-muted); }
  `,
})
export class GoalDetailScreen {
  readonly store = inject(AppStore);
  private router = inject(Router);
  private location = inject(Location);
  readonly id = input.required<string>();
  readonly goal = computed(() => this.store.goal(this.id()) ?? null);
  readonly describe = (g: Goal) => describeSchedule(g);

  readonly confirming = signal(false);
  readonly view = signal(yearMonth(this.store.today()));
  readonly monthLabel = computed(() => formatMonthYear(this.view().year, this.view().month));
  readonly canForward = computed(() => {
    const t = yearMonth(this.store.today());
    const v = this.view();
    return v.year < t.year || (v.year === t.year && v.month < t.month);
  });
  readonly leading = computed(() => Array.from({ length: weekday(ymToDate(this.view().year, this.view().month)) - 1 }));
  readonly cells = computed<Cell[]>(() => {
    const g = this.goal();
    if (!g) return [];
    const { year, month } = this.view();
    const today = this.store.today();
    const entries = this.store.entries();
    return Array.from({ length: daysInMonth(year, month) }, (_, i) => {
      const date = ymToDate(year, month, i + 1);
      return {
        date, day: i + 1,
        state: dayState(g, entries, date, today),
        past: date < today,
        tappable: date <= today && existsOn(g, date) && g.state !== 'archived',
      };
    });
  });
  readonly total = computed(() => totalDone(this.store.entries(), this.id()));
  readonly thisMonth = computed(() => doneInMonth(this.store.entries(), this.id(), ymToDate(this.view().year, this.view().month)));
  readonly childDone = computed(() => childCompletions(this.id(), this.store.goals(), this.store.entries()));
  readonly children = computed(() => this.store.goals().filter((c) => c.parentId === this.id() && c.state !== 'archived'));

  colour(g: Goal) { return goalVar(g); }
  fmt(d: string) { return formatDayMonth(d, this.store.today()); }
  subtitle(g: Goal): string {
    const since = `since ${formatDayMonth(g.createdOn, this.store.today())}`;
    if (g.state === 'paused') return `Paused · ${since}`;
    if (g.state === 'archived') return `Archived · ${since}`;
    if (g.shape === 'long') return g.targetDate ? `By ${this.fmt(g.targetDate)} · ${since}` : since;
    return `${describeSchedule(g)} · ${since}`;
  }
  move(n: number) { this.view.set(addMonths(this.view().year, this.view().month, n)); }
  back() { history.length > 1 ? this.location.back() : void this.router.navigate(['/goals']); }

  /** Tapping a day toggles it done. Off days are allowed and look the same. */
  tap(c: Cell) {
    const g = this.goal();
    if (!g) return;
    void this.store.setDone(g.id, c.date, c.state !== 'done');
  }
  toggleLong(g: Goal) {
    return this.store.saveGoal({ ...g, completedOn: g.completedOn ? null : this.store.today() });
  }
  async archive(g: Goal) {
    await this.store.archiveGoal(g);
    void this.router.navigate(['/goals']);
  }

  deleteDetail(g: Goal): string {
    return goalDeleteDetail(g, this.store.goals(), this.store.entries());
  }
  async remove(g: Goal) {
    this.confirming.set(false);
    await this.store.deleteGoal(g);
    if (this.store.saveError()) return;
    void this.router.navigate(['/goals']);
  }
  pluralise = pluralise;
}
