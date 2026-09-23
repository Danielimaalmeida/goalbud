import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { formatDayMonth, formatShort } from '../core/dates';
import { kindLabel } from '../core/exercises';
import { pluralise } from '../core/goals';
import { APP_DEFAULT_REST_SECONDS, type Session, type SessionExercise, type SessionSet, type SetTarget, type Workout } from '../core/model';
import { buildSessionExercises, doneSetCount, doneSets, formatSet, formatTarget, isBestInSession, sessionsForWorkout, setCount, touchedExercises } from '../core/sessions';
import { AppStore } from '../core/store';

interface PlanRow {
  exerciseId: string;
  name: string;
  kind: SessionExercise['kind'];
  targets: SetTarget[];
}

/**
 * A workout's plan and its history: every session done from it, newest first,
 * with the actual reps and weights. Tap an exercise for its own history.
 */
@Component({
  selector: 'app-workout-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    @if (workout(); as w) {
      <div class="screen">
        <header class="detail-head">
          <button class="back" (click)="back()" aria-label="Back">‹</button>
          <div class="grow">
            <div class="title">{{ w.name }}</div>
            <div class="sub">{{ subtitle(w) }}</div>
          </div>
        </header>
        <div class="screen-body">
          <div class="card stats">
            <div class="stat"><div class="num">{{ history().length }}</div><div class="label">sessions</div></div>
            <div class="divider"></div>
            <div class="stat">
              <div class="num sm">{{ lastDone() ?? '—' }}</div>
              <div class="label">last done</div>
            </div>
          </div>

          @if (!w.archived) {
            @if (openForThis(); as open) {
              <button class="card card-dark start" (click)="resume(open)">
                <span class="go"></span>
                <span class="grow">
                  <span class="st">Back to {{ w.name }}</span>
                  <span class="sd">Still open from earlier</span>
                </span>
              </button>
            } @else {
              <button class="card card-dark start" (click)="start(w)">
                <span class="go"></span>
                <span class="grow">
                  <span class="st">Start this workout</span>
                  <span class="sd">{{ startHint() }}</span>
                </span>
              </button>
            }
          }

          <div class="eyebrow">History</div>
          @if (history().length) {
            @for (s of history(); track s.id) {
              <div class="card sess">
                <div class="sh">
                  <div class="hdate">{{ fmt(s.date) }}</div>
                  <div class="hcount">{{ pluralise(doneCount(s), 'set') }}</div>
                </div>
                @for (e of touched(s); track $index) {
                  <div class="histex">
                    <div class="hname">{{ e.name }}</div>
                    <div class="tags">
                      @for (set of done(e); track $index) {
                        <span class="tag" [class.is-best]="best(e, set)">{{ formatSet(set, e.kind) }}</span>
                      }
                    </div>
                  </div>
                }
                @if (s.endedAt === null) {
                  <div class="note">Still open. Pick it up whenever.</div>
                } @else if (s.closedBy === 'midnight') {
                  <div class="note">Left open, closed at midnight. Counted.</div>
                }
              </div>
            }
          } @else {
            <div class="card quiet">No sessions yet. Do this workout once and your reps and weights show up here.</div>
          }

          <div class="eyebrow">The plan</div>
          @for (p of plan(); track p.exerciseId) {
            <a class="card pex" [routerLink]="['/exercises', p.exerciseId]">
              <div class="ph">
                <div class="grow"><div class="pn">{{ p.name }}</div><div class="pk">{{ kindLabel(p.kind) }}</div></div>
                <span class="chev">›</span>
              </div>
              <div class="tags">
                @for (t of p.targets; track $index) { <span class="tag is-quiet">{{ formatTarget(t, p.kind) }}</span> }
              </div>
            </a>
          }

          <div class="eyebrow">Settings</div>
          <div class="list">
            <a class="row" [routerLink]="['/workouts', w.id, 'edit']">
              <span class="row-action grow">Edit workout</span><span class="aside">plan, exercises, sets</span><span class="chev">›</span>
            </a>
            @if (w.archived) {
              <button class="row" (click)="restore(w)"><span class="row-action grow">Restore</span><span class="aside">back to your workouts</span><span class="chev">›</span></button>
            } @else {
              <button class="row" (click)="archive(w)"><span class="row-action is-quiet grow">Archive</span><span class="aside">history is kept</span><span class="chev">›</span></button>
            }
          </div>
        </div>
      </div>
    } @else {
      <div class="screen">
        <header class="detail-head">
          <button class="back" (click)="back()" aria-label="Back">‹</button>
          <div class="grow"><div class="title">Workout</div></div>
        </header>
        <div class="screen-body">
          <div class="card quiet">This workout is not here anymore.</div>
        </div>
      </div>
    }
  `,
  styles: `
    .grow { flex: 1; min-width: 0; }
    .start { display: flex; align-items: center; gap: 14px; width: 100%; text-align: left; }
    .go { width: 52px; height: 52px; border-radius: 50%; background: var(--mint); flex: none; display: flex; align-items: center; justify-content: center; }
    .go::after { content: ""; width: 0; height: 0; margin-left: 5px; border-left: 16px solid var(--dark); border-top: 11px solid transparent; border-bottom: 11px solid transparent; }
    .st { display: block; font: 900 19px/1.2 var(--font); color: #fff; }
    .sd { display: block; font: 500 13px/1.3 var(--font); color: var(--dark-ink); margin-top: 4px; }
    .sess { padding: 16px; border-radius: var(--r-list); }
    .sh { display: flex; align-items: baseline; gap: 10px; }
    .hdate { flex: 1; font: 800 15px/1 var(--font); color: var(--ink); }
    .hcount { font: 600 12px/1 var(--font); color: var(--ink-4); }
    .histex { margin-top: 14px; }
    .sh + .histex { margin-top: 12px; }
    .hname { font: 700 13.5px/1.2 var(--font); color: var(--ink-2); margin-bottom: 8px; }
    .tags { display: flex; flex-wrap: wrap; gap: 7px; }
    .note { font: 500 12px/1.3 var(--font); color: var(--ink-5); margin-top: 12px; }
    .pex { padding: 16px; border-radius: var(--r-list); display: block; }
    .ph { display: flex; align-items: center; gap: 10px; }
    .pn { font: 800 16px/1.2 var(--font); color: var(--ink); }
    .pk { font: 500 12px/1.3 var(--font); color: var(--ink-4); margin-top: 3px; }
    .chev { font: 700 18px/1 var(--font); color: var(--ink-7); }
    .pex .tags { margin-top: 12px; }
    .stat .num.sm { font-size: 24px; }
    .quiet { font: 500 13.5px/1.45 var(--font); color: var(--ink-3); background: var(--surface-muted); border-color: var(--line-muted); }
  `,
})
export class WorkoutDetailScreen {
  readonly store = inject(AppStore);
  private router = inject(Router);
  private location = inject(Location);
  readonly id = input.required<string>();

  readonly workout = computed(() => this.store.workouts().find((w) => w.id === this.id()) ?? null);
  readonly history = computed(() => sessionsForWorkout(this.store.sessions(), this.id()));
  readonly openForThis = computed(() => {
    const open = this.store.openSession();
    return open && open.workoutId === this.id() ? open : null;
  });
  readonly lastDone = computed(() => {
    const s = this.history()[0];
    if (!s) return null;
    if (s.date === this.store.today()) return 'Today';
    if (s.date === this.store.yesterday()) return 'Yesterday';
    return formatDayMonth(s.date, this.store.today());
  });
  readonly startHint = computed(() => {
    const last = this.lastDone();
    return last ? `Last done ${last.toLowerCase()}` : 'Every set saves itself as you tick';
  });
  readonly plan = computed<PlanRow[]>(() => {
    const w = this.workout();
    if (!w) return [];
    return w.exercises.flatMap((we) => {
      const ex = this.store.exercises().find((e) => e.id === we.exerciseId);
      return ex ? [{ exerciseId: ex.id, name: ex.name, kind: ex.kind, targets: we.sets }] : [];
    });
  });

  readonly pluralise = pluralise;
  readonly setCount = setCount;
  readonly doneCount = doneSetCount;
  readonly touched = touchedExercises;
  readonly done = doneSets;
  readonly formatSet = formatSet;
  readonly formatTarget = formatTarget;
  readonly kindLabel = kindLabel;

  subtitle(w: Workout): string {
    return `${pluralise(w.exercises.length, 'exercise')} · ${pluralise(setCount(w), 'set')} · rest ${w.restSeconds ?? APP_DEFAULT_REST_SECONDS} s`;
  }
  fmt(d: string) { return formatShort(d); }
  best(e: SessionExercise, set: SessionSet) { return isBestInSession(e, set); }

  async start(w: Workout) {
    const s = await this.store.startSession(w, buildSessionExercises(w, this.store.exercises()));
    if (this.store.saveError()) return;
    void this.router.navigate(['/session', s.id]);
  }
  resume(s: Session) { void this.router.navigate(['/session', s.id]); }

  async archive(w: Workout) {
    await this.store.saveWorkout({ ...w, archived: true });
    if (this.store.saveError()) return;
    this.back();
  }
  async restore(w: Workout) {
    await this.store.saveWorkout({ ...w, archived: false });
  }

  back() { history.length > 1 ? this.location.back() : void this.router.navigate(['/workouts']); }
}
