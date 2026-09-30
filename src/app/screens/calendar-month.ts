import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { STATE_WORD, dayMeta, dayRows, firstDate, monthWeeks, type DayRow, type MonthDay } from '../core/calendar';
import { formatLong } from '../core/dates';
import type { Goal, LocalDate } from '../core/model';
import { AppStore } from '../core/store';
import { goalVar } from '../ui/goal-colour';

interface Item {
  row: DayRow;
  meta: string;
  label: string;
}

/**
 * The month as a grid, one dot per goal ticked each day. Pick a day and its
 * goals are listed underneath, ready to tick or clear.
 */
@Component({
  selector: 'app-calendar-month',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet],
  template: `
    <div class="gridcard">
      <div class="heads"><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span></div>
      @for (week of weeks(); track $index) {
        <div class="wk">
          @for (d of week; track $index) {
            @if (d) {
              <button class="day" [class.is-selected]="d.date === selected()" [disabled]="d.disabled" [attr.aria-label]="dayLabel(d)" [attr.aria-pressed]="d.date === selected()" (click)="pick.emit(d.date)">
                <span [class]="'num is-' + d.state">{{ d.day }}</span>
                <span class="dots">@for (hex of d.dots; track $index) { <i [style.background]="hex"></i> }</span>
              </button>
            } @else {
              <span class="pad"></span>
            }
          }
        </div>
      }
    </div>

    <h2 class="dayname">{{ title() }}</h2>
    @if (main().length) {
      <div class="list"><ng-container [ngTemplateOutlet]="rows" [ngTemplateOutletContext]="{ $implicit: main() }" /></div>
    } @else if (!other().length) {
      <div class="card quiet">Nothing to show for this day.</div>
    }
    @if (other().length) {
      <button class="card more" [attr.aria-expanded]="showOther()" (click)="toggleOther()">
        <span class="row-action is-quiet grow">Other goals</span>
        <span class="aside">{{ other().length }}</span>
        <span class="chev" [class.is-open]="showOther()">›</span>
      </button>
      @if (showOther()) {
        <div class="list"><ng-container [ngTemplateOutlet]="rows" [ngTemplateOutletContext]="{ $implicit: other() }" /></div>
      }
    }

    <ng-template #rows let-items>
      @for (it of items; track it.row.goal.id) {
        <div class="row" [style.--goal]="colour(it.row.goal)">
          <span class="bar"></span>
          <span class="grow">
            <span class="name" [class.is-muted]="it.row.state === 'skipped'">{{ it.row.goal.name }}</span>
            <span class="meta">{{ it.meta }}</span>
          </span>
          <button class="ctl" [disabled]="!it.row.editable" [attr.aria-label]="it.label" [attr.aria-pressed]="it.row.state === 'done'" (click)="tap(it.row)">
            <span [class]="'mark is-' + it.row.state">
              @if (it.row.state === 'done') { <i class="tick"></i> } @else if (it.row.state === 'skipped') { <i class="dash"></i> }
            </span>
          </button>
        </div>
      }
    </ng-template>
  `,
  styles: `
    :host { display: block; padding: 10px 14px calc(28px + env(safe-area-inset-bottom, 0px)); }
    :host > * + * { margin-top: 12px; }
    .gridcard { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-card-2); padding: 14px 10px 10px; }
    .heads, .wk { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
    .heads { padding-bottom: 6px; }
    .heads span { text-align: center; font: 700 11px/1 var(--font); color: var(--ink-5); }
    .pad { height: 52px; }
    .day { box-sizing: border-box; width: 100%; height: 52px; border-radius: 14px; display: flex; flex-direction: column; align-items: center; padding-top: 4px; }
    .day.is-selected { background: var(--sage-tint-2); }
    .num { box-sizing: border-box; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font: 700 13px/1 var(--font); color: var(--ink-2); }
    .num.is-today { box-shadow: inset 0 0 0 3px var(--ink); font-weight: 800; color: var(--ink); }
    .num.is-future { font-weight: 600; color: var(--sand-2); }
    .num.is-before { font-weight: 600; color: var(--ink-7); }
    .dots { display: flex; flex-wrap: wrap; justify-content: center; gap: 3px; width: 24px; margin-top: 3px; }
    .dots i { width: 6px; height: 6px; border-radius: 50%; }
    .dayname { margin: 18px 8px 0; font: 800 17px/1.2 var(--font); color: var(--ink); }
    .dayname + * { margin-top: 8px; }
    .bar { flex: none; align-self: stretch; width: 5px; border-radius: 3px; background: var(--goal); }
    .row { padding: 8px 4px 8px 14px; }
    .ctl { flex: none; width: 52px; height: 56px; display: flex; align-items: center; justify-content: center; }
    .mark { box-sizing: border-box; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
    .mark.is-open { border: 3px solid var(--sand); }
    .mark.is-done { background: var(--goal); }
    .mark.is-skipped { background: var(--line-soft); }
    .tick { width: 16px; height: 9px; border-left: 3px solid #fff; border-bottom: 3px solid #fff; transform: rotate(-45deg) translate(1px, -2px); border-radius: 1px; }
    .dash { width: 14px; height: 3px; border-radius: 2px; background: var(--ink-6); }
    .quiet { font: 500 13.5px/1.45 var(--font); color: var(--ink-3); background: var(--surface-muted); border-color: var(--line-muted); }
    .more { box-sizing: border-box; width: 100%; display: flex; align-items: center; gap: 12px; padding: 15px; }
    .more .aside { font: 600 13px/1 var(--font); color: var(--ink-5); }
    .more .chev { display: inline-block; font: 700 18px/1 var(--font); color: var(--ink-7); }
    .more .chev.is-open { transform: rotate(90deg); }
    .grow { flex: 1; min-width: 0; }
  `,
})
export class CalendarMonth {
  private readonly store = inject(AppStore);
  readonly year = input.required<number>();
  readonly month = input.required<number>();
  /** The day whose goals are listed. */
  readonly selected = input.required<LocalDate>();
  readonly pick = output<LocalDate>();

  /** The day "Other goals" was opened for, so picking another day closes it again. */
  private readonly openedFor = signal<LocalDate | null>(null);
  readonly showOther = computed(() => this.openedFor() === this.selected());

  readonly title = computed(() => formatLong(this.selected()));

  readonly weeks = computed(() => {
    const today = this.store.today();
    const goals = this.store.goals();
    return monthWeeks(goals, this.store.entries(), this.year(), this.month(), today, firstDate(goals) ?? today);
  });

  private readonly split = computed(() => dayRows(this.store.goals(), this.store.entries(), this.selected(), this.store.today()));
  readonly main = computed(() => this.split().main.map((r) => this.item(r)));
  readonly other = computed(() => this.split().other.map((r) => this.item(r)));

  private item(row: DayRow): Item {
    const date = this.selected();
    const meta = dayMeta(row, this.store.goals(), this.store.entries(), this.store.sessions(), date, this.store.today());
    return { row, meta, label: `${row.goal.name}, ${formatLong(date)}, ${STATE_WORD[row.state]}` };
  }

  colour(goal: Goal) {
    return goalVar(goal);
  }
  dayLabel(d: MonthDay): string {
    return d.done ? `${formatLong(d.date)}, ${d.done} done` : formatLong(d.date);
  }
  toggleOther() {
    this.openedFor.set(this.showOther() ? null : this.selected());
  }

  /** Done becomes cleared; anything else, a skip included, becomes done. */
  tap(row: DayRow) {
    void this.store.setDone(row.goal.id, this.selected(), row.state !== 'done');
  }
}
