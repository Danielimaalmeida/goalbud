import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { STATE_WORD, canMark, cellState, goalsInWeek, weekRowMeta, type CellState } from '../core/calendar';
import { formatLong, weekDays } from '../core/dates';
import type { Goal, LocalDate } from '../core/model';
import { AppStore } from '../core/store';
import { goalVar } from '../ui/goal-colour';

interface Cell {
  date: LocalDate;
  state: CellState;
  tappable: boolean;
  label: string;
}

interface Row {
  goal: Goal;
  meta: string;
  cells: Cell[];
}

/** One card per goal with a circle for each day. Tap a day up to today to tick it, tap again to clear it. */
@Component({
  selector: 'app-calendar-week',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cards">
      @for (row of rows(); track row.goal.id) {
        <div class="gcard" [style.--goal]="colour(row.goal)">
          <div class="top">
            <span class="bar"></span>
            <div class="info">
              <div class="name">{{ row.goal.name }}</div>
              @if (row.meta) { <div class="meta">{{ row.meta }}</div> }
            </div>
          </div>
          <div class="cells">
            @for (c of row.cells; track c.date) {
              <button class="hit" [disabled]="!c.tappable" [attr.aria-label]="c.label" [attr.aria-pressed]="c.state === 'done'" (click)="tap(row.goal, c)">
                <span [class]="'c is-' + c.state">
                  @if (c.state === 'skipped') { <i class="dash"></i> } @else if (c.state === 'free') { <i class="pip"></i> }
                </span>
              </button>
            }
          </div>
        </div>
      }
    </div>
    <p class="hint">Tap a day to mark it. Tap again to clear.</p>
  `,
  styles: `
    :host { display: block; padding-bottom: calc(28px + env(safe-area-inset-bottom, 0px)); }
    .cards { display: flex; flex-direction: column; gap: 10px; padding: 2px 14px 0; }
    .gcard { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-list); padding: 13px 16px 6px; }
    .top { display: flex; align-items: stretch; gap: 12px; }
    .bar { flex: none; width: 5px; border-radius: 3px; background: var(--goal); }
    .info { flex: 1; min-width: 0; padding: 1px 0; }
    .name { font: 700 16px/1.2 var(--font); color: var(--ink); }
    .meta { font: 500 12px/1.3 var(--font); color: var(--ink-4); margin-top: 3px; }
    .cells { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); column-gap: 6px; margin-top: 6px; }
    .hit { width: 100%; height: 44px; display: flex; align-items: center; justify-content: center; }
    .c { box-sizing: border-box; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
    .c.is-done { background: var(--goal); }
    .c.is-skipped { background: var(--line-soft); }
    .c.is-open { border: 3px solid var(--sand); }
    .c.is-soon { border: 3px solid var(--line); }
    .dash { width: 13px; height: 3px; border-radius: 2px; background: var(--ink-6); }
    .pip { width: 5px; height: 5px; border-radius: 50%; background: var(--sand-2); }
    .hint { margin: 0; padding: 16px 28px 0; text-align: center; font: 500 12.5px/1.45 var(--font); color: var(--ink-4); }
  `,
})
export class CalendarWeek {
  private readonly store = inject(AppStore);
  /** The Monday the week starts on. */
  readonly start = input.required<LocalDate>();

  readonly rows = computed<Row[]>(() => {
    const goals = this.store.goals();
    const entries = this.store.entries();
    const today = this.store.today();
    const ws = this.start();
    const days = weekDays(ws);
    return goalsInWeek(goals, entries, ws).map((goal) => ({
      goal,
      meta: weekRowMeta(goal, goals, entries, ws, today),
      cells: days.map((date) => {
        const state = cellState(goal, entries, date, today);
        return { date, state, tappable: canMark(goal, date, today), label: `${goal.name}, ${formatLong(date)}, ${STATE_WORD[state]}` };
      }),
    }));
  });

  colour(goal: Goal) {
    return goalVar(goal);
  }

  /** Done becomes cleared; anything else, a skip included, becomes done. */
  tap(goal: Goal, cell: Cell) {
    void this.store.setDone(goal.id, cell.date, cell.state !== 'done');
  }
}
