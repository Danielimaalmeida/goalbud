import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { dayInMonth, firstDate, monthAgo, weekAgo } from '../core/calendar';
import { WEEKDAY_LETTERS, addDays, addMonths, formatMonthYear, formatWeekRange, monthStart, weekDays, weekStart, weekday, yearMonth, ymToDate } from '../core/dates';
import type { LocalDate } from '../core/model';
import { AppStore } from '../core/store';
import { CalendarMonth } from './calendar-month';
import { CalendarWeek } from './calendar-week';

type View = 'week' | 'month';

/**
 * Week and month over all goals, reached from Today. Go back as far as the first
 * goal, and tick what you forgot. Days still to come stay locked.
 */
@Component({
  selector: 'app-calendar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CalendarWeek, CalendarMonth],
  template: `
    <div class="screen">
      <header class="cal-head">
        <div class="detail-head">
          <button class="back" (click)="back()" aria-label="Back to Today">‹</button>
          @if (hasGoals()) {
            <div class="grow">
              <div class="title">{{ title() }}</div>
              <div class="sub">{{ sub() }}</div>
            </div>
            @if (away()) { <button class="btn is-soft-sage jump" (click)="jump()">{{ jumpLabel() }}</button> }
          }
        </div>
        @if (hasGoals()) {
          <div class="controls">
            <div class="seg" role="group" aria-label="View">
              <button class="pill-tab" [class.is-on]="view() === 'week'" [attr.aria-pressed]="view() === 'week'" (click)="showWeek()">Week</button>
              <button class="pill-tab" [class.is-on]="view() === 'month'" [attr.aria-pressed]="view() === 'month'" (click)="showMonth()">Month</button>
            </div>
            <span class="grow"></span>
            <button class="nav" [disabled]="!canBack()" (click)="step(-1)" [attr.aria-label]="'Previous ' + view()">‹</button>
            <button class="nav" [disabled]="!canForward()" (click)="step(1)" [attr.aria-label]="'Next ' + view()">›</button>
          </div>
          @if (view() === 'week') {
            <div class="days">
              @for (d of days(); track d) {
                <div class="day">
                  <span class="dl">{{ letter(d) }}</span>
                  <span class="dn" [class.is-today]="d === today()" [class.is-soon]="d > today()">{{ dayNum(d) }}</span>
                </div>
              }
            </div>
          }
        }
      </header>

      @if (!hasGoals()) {
        <div class="empty">
          <div class="glyph"></div>
          <div class="title">Nothing to show yet</div>
          <div class="body">Goals you add will show up here, week by week.</div>
          <a class="btn" routerLink="/goals/new"><span class="plus">+</span>Add a goal</a>
        </div>
      } @else if (view() === 'week') {
        <app-calendar-week [start]="ws()" />
      } @else {
        <app-calendar-month [year]="month().year" [month]="month().month" [selected]="selected()" (pick)="selected.set($event)" />
      }
    </div>
  `,
  styles: `
    .cal-head { position: sticky; top: 0; z-index: 2; background: var(--bg); }
    .detail-head { padding-bottom: 2px; }
    .back { height: 44px; margin-left: -8px; font-size: 30px; }
    .grow { flex: 1; min-width: 0; }
    .title { white-space: nowrap; }
    .btn.jump { flex: none; height: 44px; padding: 0 16px; font-size: 13px; }
    .controls { display: flex; align-items: center; gap: 4px; padding: 10px 18px 0 20px; }
    .seg { display: flex; gap: 6px; width: 196px; }
    .seg .pill-tab { padding: 14px 0; }
    .nav { width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; font: 800 30px/1 var(--font); color: var(--ink-3); }
    .nav:disabled { color: var(--line-strong); }
    .days { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); column-gap: 6px; padding: 8px 31px 6px; }
    .day { display: flex; flex-direction: column; align-items: center; gap: 4px; }
    .dl { font: 700 11px/1 var(--font); color: var(--ink-5); }
    .dn { box-sizing: border-box; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font: 700 14px/1 var(--font); color: var(--ink-2); }
    .dn.is-today { box-shadow: inset 0 0 0 3px var(--ink); font-weight: 800; color: var(--ink); }
    .dn.is-soon { font-weight: 600; color: var(--sand-2); }
    .plus { font-size: 18px; }
  `,
})
export class CalendarScreen {
  readonly store = inject(AppStore);
  private router = inject(Router);
  private location = inject(Location);

  readonly today = this.store.today;
  readonly view = signal<View>('week');
  /** The Monday of the week on show. */
  readonly ws = signal<LocalDate>(weekStart(this.store.today()));
  readonly month = signal(yearMonth(this.store.today()));
  /** The day picked in the month view. */
  readonly selected = signal<LocalDate>(this.store.today());

  readonly hasGoals = computed(() => firstDate(this.store.goals()) !== null);
  /** The earliest day there is anything to see. */
  private readonly first = computed(() => firstDate(this.store.goals()) ?? this.store.today());

  readonly days = computed(() => weekDays(this.ws()));
  readonly title = computed(() => (this.view() === 'week' ? formatWeekRange(this.ws()) : formatMonthYear(this.month().year, this.month().month)));
  readonly sub = computed(() => (this.view() === 'week' ? weekAgo(this.ws(), this.today()) : monthAgo(this.month().year, this.month().month, this.today())));
  readonly jumpLabel = computed(() => (this.view() === 'week' ? 'This week' : 'This month'));

  private monthDate = computed(() => ymToDate(this.month().year, this.month().month));
  readonly away = computed(() => (this.view() === 'week' ? this.ws() !== weekStart(this.today()) : this.monthDate() !== monthStart(this.today())));
  readonly canBack = computed(() => (this.view() === 'week' ? this.ws() > weekStart(this.first()) : this.monthDate() > monthStart(this.first())));
  /** The week or month on show is never past the current one, so being away from it is being able to go forward. */
  readonly canForward = computed(() => this.away());

  letter(d: LocalDate) {
    return WEEKDAY_LETTERS[weekday(d)];
  }
  dayNum(d: LocalDate) {
    return Number(d.slice(8));
  }

  step(n: number) {
    if (n < 0 ? !this.canBack() : !this.canForward()) return;
    if (this.view() === 'week') {
      this.ws.set(addDays(this.ws(), 7 * n));
      return;
    }
    const m = addMonths(this.month().year, this.month().month, n);
    this.month.set(m);
    this.selected.set(dayInMonth(m.year, m.month, this.selected(), this.today()));
  }

  jump() {
    if (this.view() === 'week') {
      this.ws.set(weekStart(this.today()));
    } else {
      this.month.set(yearMonth(this.today()));
      this.selected.set(this.today());
    }
  }

  /** The week of the day picked in the month view. */
  showWeek() {
    this.ws.set(weekStart(this.selected()));
    this.view.set('week');
  }

  /** The month of the week on show, on the day picked if it is in that week, else the last day of the week that has happened. */
  showMonth() {
    const last = addDays(this.ws(), 6);
    const latest = last > this.today() ? this.today() : last;
    const picked = this.selected() >= this.ws() && this.selected() <= last ? this.selected() : latest;
    this.month.set(yearMonth(picked));
    this.selected.set(picked);
    this.view.set('month');
  }

  back() {
    history.length > 1 ? this.location.back() : void this.router.navigate(['/today']);
  }
}
