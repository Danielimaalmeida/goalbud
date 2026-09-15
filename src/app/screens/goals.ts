import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatDayMonth } from '../core/dates';
import { childCompletions, describeSchedule, pluralise, totalDone, weeklyCount } from '../core/goals';
import type { Goal } from '../core/model';
import { AppStore } from '../core/store';
import { goalVar } from '../ui/goal-colour';

@Component({
  selector: 'app-goals',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="screen">
      <header class="page-head">
        <h1 class="h1">Goals</h1>
        <a class="btn" routerLink="/goals/new"><span class="plus">+</span>New</a>
      </header>
      <div class="screen-body is-tabbed">
        @if (active().length) {
          <div class="eyebrow">Active · {{ active().length }}</div>
          <div class="list">
            @for (g of active(); track g.id) {
              <a class="row" [routerLink]="['/goals', g.id]" [style.--goal]="colour(g)">
                <span class="dot"></span>
                <span class="grow">
                  <span class="nm"><span class="name">{{ g.name }}</span>@if (g.isExercise) { <span class="badge">WORKOUT</span> }</span>
                  <span class="meta">{{ meta(g) }}</span>
                </span>
                <span class="chev">›</span>
              </a>
            }
          </div>
        }

        @if (long().length) {
          <div class="eyebrow">Long goals</div>
          @for (g of long(); track g.id) {
            <div class="card lg" [style.--goal]="colour(g)">
              <div class="lg-head">
                <span class="dot"></span>
                <a class="grow" [routerLink]="['/goals', g.id]">
                  <div class="lg-name" [class.is-done]="g.completedOn">{{ g.name }}</div>
                  <div class="lg-meta">{{ longMeta(g) }}</div>
                </a>
                @if (g.completedOn) {
                  <button class="check is-sm" (click)="markLong(g, false)" aria-label="Undo done"></button>
                } @else {
                  <button class="ring is-sm" (click)="markLong(g, true)" aria-label="Mark done"></button>
                }
              </div>
              @if (children(g).length) {
                <div class="kids">
                  @for (c of children(g); track c.id) {
                    <a class="kid" [routerLink]="['/goals', c.id]"><i></i><span>{{ c.name }}<small> · {{ describe(c) }}</small></span></a>
                  }
                </div>
              }
            </div>
          }
        }

        @if (paused().length) {
          <div class="eyebrow">Paused · {{ paused().length }}</div>
          <div class="list is-muted">
            @for (g of paused(); track g.id) {
              <div class="row">
                <span class="dot is-muted"></span>
                <a class="grow" [routerLink]="['/goals', g.id]">
                  <span class="name is-muted">{{ g.name }}</span>
                  <span class="meta is-muted">Paused since {{ pausedSince(g) }} · hidden from Today</span>
                </a>
                <button class="btn is-soft-sage" (click)="store.resume(g)">Resume</button>
              </div>
            }
          </div>
        }

        @if (!active().length && !long().length && !paused().length) {
          <div class="empty">
            <div class="glyph"></div>
            <div class="title">No goals yet</div>
            <div class="body">A goal is anything you want to keep track of. Start with one.</div>
            <a class="btn" routerLink="/goals/new"><span class="plus">+</span>New goal</a>
          </div>
        }

        <a class="card arch" routerLink="/archive">
          <span class="row-action is-quiet grow">Archive</span>
          <span class="aside">{{ archivedCount() ? pluralise(archivedCount(), 'goal') : 'empty' }}</span>
          <span class="chev">›</span>
        </a>
      </div>
    </div>
  `,
  styles: `
    .plus { font-size: 17px; }
    .nm { display: flex; align-items: center; gap: 7px; }
    .lg { padding: 16px; margin-bottom: 4px; }
    .lg-head { display: flex; align-items: flex-start; gap: 12px; }
    .lg-head .dot { margin-top: 5px; }
    .lg-head .grow { flex: 1; min-width: 0; }
    .lg-name { font: 800 18px/1.2 var(--font); color: var(--ink); }
    .lg-name.is-done { color: var(--sage-ink); }
    .lg-meta { font: 500 13px/1.3 var(--font); color: var(--ink-3); margin-top: 5px; }
    .kids { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--line-soft); display: flex; flex-direction: column; gap: 12px; }
    .kid { display: flex; align-items: center; gap: 10px; font: 600 14px/1.2 var(--font); color: var(--ink-2); }
    .kid i { width: 22px; height: 2px; background: var(--line-strong); flex: none; }
    .kid small { font: 500 12px var(--font); color: var(--ink-4); }
    .arch { display: flex; align-items: center; gap: 12px; padding: 15px; margin-top: 4px; }
    .arch .aside { font: 600 13px/1 var(--font); color: var(--ink-5); }
    .arch .chev { font: 700 18px/1 var(--font); color: var(--ink-7); }
    .grow { flex: 1; min-width: 0; }
  `,
})
export class GoalsScreen {
  readonly store = inject(AppStore);
  readonly pluralise = pluralise;
  readonly describe = (g: Goal) => describeSchedule(g);

  private byOrder = (a: Goal, b: Goal) => a.sortOrder - b.sortOrder || a.createdOn.localeCompare(b.createdOn);
  readonly active = computed(() => this.store.goals().filter((g) => g.state === 'active' && g.shape !== 'long' && !g.parentId).sort(this.byOrder));
  readonly long = computed(() => this.store.goals().filter((g) => g.state === 'active' && g.shape === 'long').sort(this.byOrder));
  readonly paused = computed(() => this.store.goals().filter((g) => g.state === 'paused').sort(this.byOrder));
  readonly archivedCount = computed(() => this.store.goals().filter((g) => g.state === 'archived').length);

  colour(g: Goal) { return goalVar(g); }
  children(g: Goal): Goal[] { return this.store.goals().filter((c) => c.parentId === g.id && c.state !== 'archived').sort(this.byOrder); }

  meta(g: Goal): string {
    const entries = this.store.entries();
    if (g.shape === 'weekly') return `${describeSchedule(g)} · ${weeklyCount(entries, g.id, this.store.today())} this week`;
    const n = totalDone(entries, g.id);
    return n ? `${describeSchedule(g)} · ${pluralise(n, 'day')} logged` : describeSchedule(g);
  }
  longMeta(g: Goal): string {
    const n = childCompletions(g.id, this.store.goals(), this.store.entries());
    const sessions = `${pluralise(n, 'session')} so far`;
    if (g.completedOn) return `Done ${formatDayMonth(g.completedOn, this.store.today())} · ${sessions}`;
    return g.targetDate ? `By ${formatDayMonth(g.targetDate, this.store.today())} · ${sessions}` : sessions;
  }
  pausedSince(g: Goal): string {
    const p = g.pauses.find((x) => x.to === null);
    return p ? formatDayMonth(p.from, this.store.today()) : '';
  }
  markLong(g: Goal, done: boolean) {
    return this.store.saveGoal({ ...g, completedOn: done ? this.store.today() : null });
  }
}
