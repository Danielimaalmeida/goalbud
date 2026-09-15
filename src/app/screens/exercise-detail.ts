import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { formatShort } from '../core/dates';
import { pluralise } from '../core/goals';
import { APP_DEFAULT_REST_SECONDS, type Exercise, type Session, type SessionExercise } from '../core/model';
import { bestSet, doneSets, formatSet, isBestInSession, sessionsForExercise } from '../core/sessions';
import { AppStore } from '../core/store';

/** Per-exercise history: actuals per session. The chart is a promise until there is a month of data. */
@Component({
  selector: 'app-exercise-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (exercise(); as ex) {
      <div class="screen">
        <header class="detail-head">
          <button class="back" (click)="back()" aria-label="Back">‹</button>
          <div class="grow"><div class="title">{{ ex.name }}</div><div class="sub">{{ ex.kind === 'reps' ? 'Reps & weight' : 'Time' }} · rest {{ rest(ex) }} s</div></div>
        </header>
        <div class="screen-body">
          <div class="card stats">
            <div class="stat"><div class="num">{{ sessions().length }}</div><div class="label">sessions</div></div>
            <div class="divider"></div>
            <div class="stat">
              @if (best(); as b) {
                <div class="num">{{ topValue(b, ex) }}<small> {{ ex.kind === 'reps' ? 'kg' : 's' }}</small></div>
              } @else { <div class="num">—</div> }
              <div class="label">{{ ex.kind === 'reps' ? 'top set' : 'longest' }}</div>
            </div>
          </div>

          <div class="promise">
            <div class="bars"><i style="height:14px"></i><i style="height:22px"></i><i style="height:18px"></i><i style="height:30px"></i></div>
            <div class="pt">A progress chart appears once there is about a month of data.</div>
          </div>

          @if (sessions().length) {
            <div class="eyebrow">Sessions</div>
            @for (s of sessions(); track s.id) {
              <div class="card sess">
                <div class="sh"><div class="sd">{{ fmt(s.date) }}</div><div class="sw">{{ s.workoutName }}</div></div>
                <div class="tags">
                  @for (set of sets(s, ex.id); track $index) {
                    <span class="tag" [class.is-best]="isBest(s, ex.id, set)">{{ formatSet(set, ex.kind) }}</span>
                  }
                </div>
                @if (s.closedBy === 'midnight') { <div class="note">Left open, closed at midnight. Counted.</div> }
              </div>
            }
          } @else {
            <div class="card quiet">No sessions with {{ ex.name }} yet.</div>
          }

          <div class="eyebrow">Settings</div>
          <div class="list">
            <div class="row">
              <span class="row-action grow">Rest between sets</span>
              <button class="step" (click)="setRest(ex, -15)" aria-label="Less rest">−</button>
              <span class="rv">{{ rest(ex) }} s</span>
              <button class="step" (click)="setRest(ex, 15)" aria-label="More rest">+</button>
            </div>
            <button class="row" (click)="toggleKind(ex)">
              <span class="row-action grow">Kind</span><span class="aside">{{ ex.kind === 'reps' ? 'Reps & weight' : 'Time' }}</span><span class="chev">›</span>
            </button>
            @if (ex.archived) {
              <button class="row" (click)="store.saveExercise({ ...ex, archived: false })"><span class="row-action grow">Restore</span><span class="chev">›</span></button>
            } @else {
              <button class="row" (click)="archive(ex)"><span class="row-action is-quiet grow">Archive</span><span class="aside">history is kept</span><span class="chev">›</span></button>
            }
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .grow { flex: 1; min-width: 0; }
    .stat .num { font-size: 30px; }
    .promise { background: var(--surface-muted); border: 1px dashed var(--sand); border-radius: var(--r-tile); padding: 16px; display: flex; align-items: center; gap: 12px; }
    .bars { display: flex; align-items: flex-end; gap: 4px; height: 34px; }
    .bars i { width: 7px; border-radius: 2px; background: var(--sand); }
    .pt { flex: 1; font: 500 12.5px/1.45 var(--font); color: var(--ink-4); }
    .sess { padding: 16px; border-radius: var(--r-list); }
    .sh { display: flex; align-items: baseline; gap: 10px; }
    .sd { flex: 1; font: 800 15px/1 var(--font); color: var(--ink); }
    .sw { font: 600 12px/1 var(--font); color: var(--ink-4); }
    .tags { margin-top: 12px; }
    .note { font: 500 12px/1.3 var(--font); color: var(--ink-5); margin-top: 12px; }
    .quiet { font: 500 13.5px/1.45 var(--font); color: var(--ink-3); background: var(--surface-muted); border-color: var(--line-muted); }
    .step { width: 36px; height: 36px; border-radius: 12px; background: var(--fill); font: 800 18px/1 var(--font); color: var(--ink); display: flex; align-items: center; justify-content: center; }
    .rv { font: 800 14px/1 var(--font); color: var(--ink); min-width: 42px; text-align: center; font-variant-numeric: tabular-nums; }
  `,
})
export class ExerciseDetailScreen {
  readonly store = inject(AppStore);
  private router = inject(Router);
  private location = inject(Location);
  readonly id = input.required<string>();
  readonly exercise = computed(() => this.store.exercises().find((e) => e.id === this.id()) ?? null);
  readonly sessions = computed(() => sessionsForExercise(this.store.sessions(), this.id()));
  readonly best = computed(() => {
    const ex = this.exercise();
    return ex ? bestSet(this.sessions(), ex.id, ex.kind) : null;
  });
  readonly formatSet = formatSet;
  readonly pluralise = pluralise;

  rest(ex: Exercise) { return ex.restSeconds ?? APP_DEFAULT_REST_SECONDS; }
  fmt(d: string) { return formatShort(d); }
  topValue(b: { weight: number | null; seconds: number | null }, ex: Exercise): string {
    const v = ex.kind === 'reps' ? b.weight : b.seconds;
    return v === null ? '—' : String(v);
  }
  sets(s: Session, exerciseId: string) {
    const e = s.exercises.find((x) => x.exerciseId === exerciseId);
    return e ? doneSets(e) : [];
  }
  isBest(s: Session, exerciseId: string, set: SessionExercise['sets'][0]) {
    const e = s.exercises.find((x) => x.exerciseId === exerciseId);
    return e ? isBestInSession(e, set) : false;
  }
  setRest(ex: Exercise, delta: number) {
    return this.store.saveExercise({ ...ex, restSeconds: Math.max(0, Math.min(600, this.rest(ex) + delta)) });
  }
  toggleKind(ex: Exercise) {
    return this.store.saveExercise({ ...ex, kind: ex.kind === 'reps' ? 'time' : 'reps' });
  }
  async archive(ex: Exercise) {
    await this.store.saveExercise({ ...ex, archived: true });
    this.back();
  }
  back() { history.length > 1 ? this.location.back() : void this.router.navigate(['/workouts']); }
}
