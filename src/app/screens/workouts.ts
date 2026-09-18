import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { exerciseMeta } from '../core/exercises';
import { pluralise } from '../core/goals';
import type { Exercise, Workout } from '../core/model';
import { sessionsForExercise, setCount } from '../core/sessions';
import { AppStore } from '../core/store';
import { WorkoutPicker } from './workout-picker';

@Component({
  selector: 'app-workouts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, WorkoutPicker],
  template: `
    <div class="screen">
      <header class="page-head"><h1 class="h1">Workouts</h1></header>
      <div class="screen-body is-tabbed">
        <button class="card card-dark start" (click)="picker.set(true)">
          <span class="go"></span>
          <span class="grow">
            <span class="st">{{ store.openSession() ? 'Back to ' + store.openSession()!.workoutName : 'Start a session' }}</span>
            <span class="sd">{{ store.openSession() ? 'Still open from earlier' : 'Pick a workout, or go freestyle' }}</span>
          </span>
        </button>

        <div class="eyebrow">Your workouts</div>
        @for (w of store.activeWorkouts(); track w.id) {
          <a class="card wo" [routerLink]="['/workouts', w.id, 'edit']">
            <div class="wo-head"><div class="wo-name">{{ w.name }}</div><div class="wo-meta">{{ pluralise(w.exercises.length, 'exercise') }} · {{ pluralise(setCount(w), 'set') }}</div></div>
            <div class="tags">
              @for (n of names(w); track $index) { <span class="tag is-quiet nm">{{ n }}</span> }
              @if (w.exercises.length > 3) { <span class="tag is-quiet">+{{ w.exercises.length - 3 }}</span> }
            </div>
          </a>
        }
        <a class="newwo" routerLink="/workouts/new"><span class="plus">+</span>New workout</a>

        <div class="eyebrow">Exercises · {{ store.activeExercises().length }}<span class="spacer"></span><a class="link" routerLink="/exercises">See all</a></div>
        @if (topExercises().length) {
          <div class="list">
            @for (e of topExercises(); track e.id) {
              <a class="row" [routerLink]="['/exercises', e.id]">
                <span class="grow"><span class="name sm">{{ e.name }}</span><span class="meta">{{ meta(e) }} · rest {{ e.restSeconds ?? 90 }} s</span></span>
                <span class="aside">{{ pluralise(count(e), 'session') }}</span>
                <span class="chev">›</span>
              </a>
            }
          </div>
        } @else {
          <div class="card quiet">Exercises get added the first time you type one into a workout. Nothing to set up first.</div>
        }
      </div>
      @if (picker()) { <app-workout-picker (close)="picker.set(false)" /> }
    </div>
  `,
  styles: `
    .start { display: flex; align-items: center; gap: 14px; width: 100%; text-align: left; }
    .go { width: 52px; height: 52px; border-radius: 50%; background: var(--mint); flex: none; display: flex; align-items: center; justify-content: center; }
    .go::after { content: ""; width: 0; height: 0; margin-left: 5px; border-left: 16px solid var(--dark); border-top: 11px solid transparent; border-bottom: 11px solid transparent; }
    .st { display: block; font: 900 19px/1.2 var(--font); color: #fff; }
    .sd { display: block; font: 500 13px/1.3 var(--font); color: var(--dark-ink); margin-top: 4px; }
    .grow { flex: 1; min-width: 0; }
    .wo { padding: 16px; border-radius: var(--r-list); display: block; }
    .wo-head { display: flex; align-items: center; gap: 12px; }
    .wo-name { flex: 1; font: 800 18px/1.2 var(--font); color: var(--ink); }
    .wo-meta { font: 600 12px/1 var(--font); color: var(--ink-4); }
    .tags { margin-top: 12px; }
    .tag.nm { color: #5C625E; font-weight: 600; font-size: 12px; padding: 9px 11px; border-radius: 8px; }
    .newwo { border: 2px dashed var(--sand); border-radius: var(--r-list); padding: 15px; display: flex; align-items: center; justify-content: center; gap: 8px; font: 700 14px/1 var(--font); color: var(--ink-4); }
    .plus { font: 800 17px/1 var(--font); }
    .name.sm { font-size: 15px; }
    .quiet { font: 500 13.5px/1.45 var(--font); color: var(--ink-3); background: var(--surface-muted); border-color: var(--line-muted); }
  `,
})
export class WorkoutsScreen {
  readonly store = inject(AppStore);
  readonly picker = signal(false);
  readonly pluralise = pluralise;
  readonly setCount = setCount;
  readonly meta = exerciseMeta;

  readonly topExercises = computed(() =>
    [...this.store.activeExercises()].sort((a, b) => this.count(b) - this.count(a)).slice(0, 3));

  names(w: Workout): string[] {
    return w.exercises.slice(0, 3).map((e) => this.store.exercises().find((x) => x.id === e.exerciseId)?.name ?? '?');
  }
  count(e: Exercise): number {
    return sessionsForExercise(this.store.sessions(), e.id).length;
  }
}
