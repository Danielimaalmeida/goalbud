import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { Router } from '@angular/router';
import { formatShort } from '../core/dates';
import { pluralise } from '../core/goals';
import type { Goal, Workout } from '../core/model';
import { buildSessionExercises } from '../core/sessions';
import { AppStore } from '../core/store';
import { Sheet } from '../ui/sheet';

/**
 * "Which workout are you doing?" Opens from an exercise goal on Today, or
 * from the Workouts tab. Both routes produce the same session.
 */
@Component({
  selector: 'app-workout-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Sheet],
  template: `
    <app-sheet (close)="close.emit()">
      <div class="title">{{ goal()?.name ?? 'Start a session' }}</div>
      <div class="sub">Which workout are you doing?</div>
      <div class="opts">
        @if (store.openSession(); as open) {
          <button class="option is-primary" (click)="go(open.id)">
            <div class="grow"><div class="name">Back to {{ open.workoutName }}</div><div class="meta">Still open from earlier</div></div><div class="go"></div>
          </button>
        }
        @for (w of workouts(); track w.id; let first = $first) {
          <button class="option" [class.is-primary]="first && !store.openSession()" (click)="start(w)">
            <div class="grow"><div class="name">{{ w.name }}</div><div class="meta">{{ meta(w) }}</div></div>
            @if (first && !store.openSession()) { <div class="go"></div> } @else { <div class="chev">›</div> }
          </button>
        }
        <button class="option" (click)="start(null)">
          <div class="grow"><div class="name">Freestyle</div><div class="meta">Add exercises as you go</div></div><div class="chev">›</div>
        </button>
      </div>
      @if (goal(); as g) {
        <div class="foot">
          <button class="btn is-soft" (click)="skip(g)">Skip today</button>
          <button class="btn is-soft" (click)="tick(g)">Just tick it</button>
        </div>
      }
    </app-sheet>
  `,
  styles: `
    .opts { display: flex; flex-direction: column; gap: 10px; }
    .grow { flex: 1; }
    .foot { display: flex; gap: 10px; margin-top: 16px; }
    .foot .btn { flex: 1; border-radius: 16px; padding: 16px; font-size: 14px; }
  `,
})
export class WorkoutPicker {
  readonly store = inject(AppStore);
  private router = inject(Router);
  /** The exercise goal that opened the picker, if any. */
  readonly goal = input<Goal | null>(null);
  readonly close = output<void>();
  readonly workouts = computed(() => this.store.activeWorkouts());

  meta(w: Workout): string {
    const last = this.store.lastSessionDate(w.id);
    const n = pluralise(w.exercises.length, 'exercise');
    if (!last) return n;
    const d = last === this.store.today() ? 'today' : last === this.store.yesterday() ? 'yesterday' : formatShort(last).slice(0, 3);
    return `${n} · last done ${d}`;
  }
  /** Started from a goal, the session counts for that goal and nothing else. */
  async start(w: Workout | null) {
    const s = await this.store.startSession(w, buildSessionExercises(w, this.store.exercises()), this.goal()?.id ?? null);
    this.go(s.id);
  }
  /** Resuming an open session from a goal points it at that goal, unless it already has one. */
  async go(id: string) {
    const g = this.goal();
    const open = this.store.session(id);
    if (g && open && open.goalId === null) await this.store.linkSession(id, g.id);
    this.close.emit();
    void this.router.navigate(['/session', id]);
  }
  async skip(g: Goal) {
    this.close.emit();
    await this.store.skip(g.id, this.store.today());
  }
  async tick(g: Goal) {
    this.close.emit();
    await this.store.setDone(g.id, this.store.today(), true);
  }
}
