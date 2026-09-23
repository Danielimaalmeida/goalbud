import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { formatDayMonth } from '../core/dates';
import { exerciseDeleteDetail, goalDeleteDetail, workoutDeleteDetail } from '../core/deletes';
import { describeSchedule, pluralise, totalDone } from '../core/goals';
import type { Exercise, Goal, Workout } from '../core/model';
import { AppStore } from '../core/store';
import { ConfirmDelete } from '../ui/confirm-delete';
import { goalVar } from '../ui/goal-colour';

type Pending =
  | { kind: 'goal'; item: Goal }
  | { kind: 'exercise'; item: Exercise }
  | { kind: 'workout'; item: Workout };

/** Archived goals, exercises and workouts. They can come back, or go for good. */
@Component({
  selector: 'app-archive',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ConfirmDelete],
  template: `
    <div class="screen">
      <header class="detail-head">
        <button class="back" (click)="back()" aria-label="Back">‹</button>
        <div class="grow"><div class="title">Archive</div><div class="sub">Restore keeps the history. Delete does not.</div></div>
      </header>
      <div class="screen-body">
        @if (goals().length) {
          <div class="eyebrow">Goals · {{ goals().length }}</div>
          <div class="list is-muted">
            @for (g of goals(); track g.id) {
              <div class="row" [style.--goal]="colour(g)">
                <span class="dot is-muted"></span>
                <a class="grow" [routerLink]="['/goals', g.id]"><span class="name is-muted">{{ g.name }}</span><span class="meta is-muted">{{ meta(g) }}</span></a>
                <button class="btn is-soft-sage" (click)="store.restoreGoal(g)">Restore</button>
                <button class="btn is-soft-danger" (click)="ask({ kind: 'goal', item: g })">Delete</button>
              </div>
            }
          </div>
        }
        @if (exercises().length) {
          <div class="eyebrow">Exercises · {{ exercises().length }}</div>
          <div class="list is-muted">
            @for (e of exercises(); track e.id) {
              <div class="row">
                <a class="grow" [routerLink]="['/exercises', e.id]"><span class="name is-muted">{{ e.name }}</span></a>
                <button class="btn is-soft-sage" (click)="store.saveExercise({ ...e, archived: false })">Restore</button>
                <button class="btn is-soft-danger" (click)="ask({ kind: 'exercise', item: e })">Delete</button>
              </div>
            }
          </div>
        }
        @if (workouts().length) {
          <div class="eyebrow">Workouts · {{ workouts().length }}</div>
          <div class="list is-muted">
            @for (w of workouts(); track w.id) {
              <div class="row">
                <a class="grow" [routerLink]="['/workouts', w.id]"><span class="name is-muted">{{ w.name }}</span><span class="meta is-muted">{{ pluralise(w.exercises.length, 'exercise') }}</span></a>
                <button class="btn is-soft-sage" (click)="store.saveWorkout({ ...w, archived: false })">Restore</button>
                <button class="btn is-soft-danger" (click)="ask({ kind: 'workout', item: w })">Delete</button>
              </div>
            }
          </div>
        }
        @if (!goals().length && !exercises().length && !workouts().length) {
          <div class="card quiet">Nothing archived. Anything you archive later shows up here, history intact.</div>
        }
      </div>
    </div>

    @if (pending(); as p) {
      <app-confirm-delete [name]="p.item.name" [detail]="detail(p)" (confirmed)="remove(p)" (cancelled)="pending.set(null)" />
    }
  `,
  styles: `
    .grow { flex: 1; min-width: 0; }
    .quiet { font: 500 13.5px/1.45 var(--font); color: var(--ink-3); background: var(--surface-muted); border-color: var(--line-muted); }
  `,
})
export class ArchiveScreen {
  readonly store = inject(AppStore);
  private router = inject(Router);
  private location = inject(Location);
  readonly pluralise = pluralise;
  readonly goals = computed(() => this.store.goals().filter((g) => g.state === 'archived'));
  readonly exercises = computed(() => this.store.exercises().filter((e) => e.archived));
  readonly workouts = computed(() => this.store.workouts().filter((w) => w.archived));

  readonly pending = signal<Pending | null>(null);

  ask(p: Pending) { this.pending.set(p); }
  detail(p: Pending): string {
    switch (p.kind) {
      case 'goal': return goalDeleteDetail(p.item, this.store.goals(), this.store.entries());
      case 'exercise': return exerciseDeleteDetail(p.item, this.store.workouts(), this.store.sessions());
      case 'workout': return workoutDeleteDetail(p.item, this.store.sessions());
    }
  }
  remove(p: Pending) {
    this.pending.set(null);
    switch (p.kind) {
      case 'goal': return this.store.deleteGoal(p.item);
      case 'exercise': return this.store.deleteExercise(p.item);
      case 'workout': return this.store.deleteWorkout(p.item);
    }
  }

  colour(g: Goal) { return goalVar(g); }
  meta(g: Goal): string {
    const n = totalDone(this.store.entries(), g.id);
    const when = g.archivedOn ? ` · archived ${formatDayMonth(g.archivedOn, this.store.today())}` : '';
    return n ? `${describeSchedule(g)} · ${pluralise(n, 'day')} logged${when}` : `${describeSchedule(g)}${when}`;
  }
  back() { history.length > 1 ? this.location.back() : void this.router.navigate(['/you']); }
}
