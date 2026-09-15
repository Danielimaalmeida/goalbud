import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { pluralise } from '../core/goals';
import { sessionsForExercise } from '../core/sessions';
import { AppStore } from '../core/store';

@Component({
  selector: 'app-exercises',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="screen">
      <header class="detail-head">
        <button class="back" (click)="back()" aria-label="Back">‹</button>
        <div class="grow"><div class="title">Exercises</div><div class="sub">{{ pluralise(rows().length, 'exercise') }} · added as you type them</div></div>
      </header>
      <div class="screen-body">
        <div class="list">
          @for (r of rows(); track r.id) {
            <a class="row" [routerLink]="['/exercises', r.id]">
              <span class="grow"><span class="name">{{ r.name }}</span><span class="meta">{{ r.kind === 'reps' ? 'Reps & weight' : 'Time' }} · rest {{ r.restSeconds ?? 90 }} s</span></span>
              <span class="aside">{{ pluralise(r.sessions, 'session') }}</span>
              <span class="chev">›</span>
            </a>
          }
        </div>
      </div>
    </div>
  `,
  styles: `.grow { flex: 1; min-width: 0; }`,
})
export class ExercisesScreen {
  readonly store = inject(AppStore);
  private router = inject(Router);
  private location = inject(Location);
  readonly pluralise = pluralise;
  readonly rows = computed(() =>
    this.store.activeExercises()
      .map((e) => ({ ...e, sessions: sessionsForExercise(this.store.sessions(), e.id).length }))
      .sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name)));
  back() { history.length > 1 ? this.location.back() : void this.router.navigate(['/workouts']); }
}
