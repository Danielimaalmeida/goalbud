import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { formatDayMonth } from '../core/dates';
import { describeSchedule, pluralise, totalDone } from '../core/goals';
import type { Goal } from '../core/model';
import { AppStore } from '../core/store';
import { goalVar } from '../ui/goal-colour';

/** Nothing is deleted. Archived goals, exercises and workouts live here and can come back. */
@Component({
  selector: 'app-archive',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="screen">
      <header class="detail-head">
        <button class="back" (click)="back()" aria-label="Back">‹</button>
        <div class="grow"><div class="title">Archive</div><div class="sub">History and session links are kept</div></div>
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
              </div>
            }
          </div>
        }
        @if (workouts().length) {
          <div class="eyebrow">Workouts · {{ workouts().length }}</div>
          <div class="list is-muted">
            @for (w of workouts(); track w.id) {
              <div class="row">
                <span class="grow"><span class="name is-muted">{{ w.name }}</span><span class="meta is-muted">{{ pluralise(w.exercises.length, 'exercise') }}</span></span>
                <button class="btn is-soft-sage" (click)="store.saveWorkout({ ...w, archived: false })">Restore</button>
              </div>
            }
          </div>
        }
        @if (!goals().length && !exercises().length && !workouts().length) {
          <div class="card quiet">Nothing archived. Anything you archive later shows up here, history intact.</div>
        }
      </div>
    </div>
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

  colour(g: Goal) { return goalVar(g); }
  meta(g: Goal): string {
    const n = totalDone(this.store.entries(), g.id);
    const when = g.archivedOn ? ` · archived ${formatDayMonth(g.archivedOn, this.store.today())}` : '';
    return n ? `${describeSchedule(g)} · ${pluralise(n, 'day')} logged${when}` : `${describeSchedule(g)}${when}`;
  }
  back() { history.length > 1 ? this.location.back() : void this.router.navigate(['/you']); }
}
