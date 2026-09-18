import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { exerciseMeta } from '../core/exercises';
import { newId } from '../core/ids';
import { APP_DEFAULT_REST_SECONDS, type Exercise, type ExerciseKind, type SetTarget, type Workout } from '../core/model';
import { AppStore } from '../core/store';
import { workoutDeleteDetail } from '../core/deletes';
import { ConfirmDelete } from '../ui/confirm-delete';
import { ExercisePicker } from '../ui/exercise-picker';

interface Draft {
  exercise: Exercise;
  sets: SetTarget[];
}

/**
 * Workout template editor. Exercises come from the library (a picker sheet)
 * or are created inline the first time a name is typed.
 */
@Component({
  selector: 'app-workout-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ConfirmDelete, ExercisePicker],
  template: `
    <div class="screen">
      <header class="form-head">
        <button class="ghost" (click)="cancel()">Cancel</button>
        <div class="title">{{ existing() ? 'Edit workout' : 'New workout' }}</div>
        <button class="btn" [disabled]="!name().trim() || busy()" (click)="save()">Save</button>
      </header>

      <div class="body">
        <section>
          <div class="lbl">Name</div>
          <label class="field"><input [value]="name()" (input)="name.set(v($event))" placeholder="Push day" autocomplete="off" /></label>
        </section>

        <section>
          <div class="lbl">Rest between sets</div>
          <div class="card pad stepper">
            <button class="step" (click)="bumpRest(-15)" aria-label="Less">−</button>
            <div class="sv"><b>{{ rest() ?? appRest }} s</b>{{ rest() === null ? ' · app default' : '' }}</div>
            <button class="step" (click)="bumpRest(15)" aria-label="More">+</button>
          </div>
        </section>

        <section>
          <div class="lbl">Exercises</div>
          <div class="exs">
            @for (d of drafts(); track d.exercise.id; let i = $index) {
              <div class="card ex">
                <div class="ex-head">
                  <div class="grow"><div class="ex-name">{{ d.exercise.name }}</div><div class="ex-kind">{{ meta(d.exercise) }}</div></div>
                  <button class="rm" (click)="remove(i)" aria-label="Remove from workout">×</button>
                </div>
                <div class="sets">
                  @for (s of d.sets; track $index; let j = $index) {
                    <div class="set">
                      <span class="idx">{{ j + 1 }}</span>
                      @if (d.exercise.kind === 'reps') {
                        <label class="num"><input type="number" inputmode="numeric" min="0" [value]="s.reps ?? ''" (change)="setVal(i, j, 'reps', $event)" placeholder="reps" /><span>reps</span></label>
                        <span class="x">×</span>
                        <label class="num"><input type="number" inputmode="decimal" min="0" step="0.5" [value]="s.weight ?? ''" (change)="setVal(i, j, 'weight', $event)" placeholder="—" /><span>kg</span></label>
                      } @else {
                        <label class="num"><input type="number" inputmode="numeric" min="0" [value]="s.seconds ?? ''" (change)="setVal(i, j, 'seconds', $event)" placeholder="60" /><span>s</span></label>
                      }
                      <button class="rm sm" (click)="removeSet(i, j)" [disabled]="d.sets.length === 1" aria-label="Remove set">×</button>
                    </div>
                  }
                </div>
                <button class="addset" (click)="addSet(i)">+ Add set</button>
              </div>
            }
          </div>

          <div class="card pad add">
            @if (suggestions().length) {
              <button class="lib" (click)="picking.set(true)">
                <span class="grow">Choose from your exercises</span><span class="aside">{{ suggestions().length }}</span><span class="chev">›</span>
              </button>
              <div class="or">or type a new one</div>
            }
            <div class="addrow">
              <input class="addin" list="ex-names" [value]="newName()" (input)="newName.set(v($event))" (keydown.enter)="add()" placeholder="Add an exercise…" autocomplete="off" />
              <datalist id="ex-names">@for (e of suggestions(); track e.id) { <option [value]="e.name"></option> }</datalist>
              <button class="btn is-sm" [disabled]="!newName().trim()" (click)="add()">Add</button>
            </div>
            @if (isNew()) {
              <div class="tabs">
                <button class="pill-tab" [class.is-on]="newKind() === 'reps'" (click)="newKind.set('reps')">Reps &amp; weight</button>
                <button class="pill-tab" [class.is-on]="newKind() === 'time'" (click)="newKind.set('time')">Time</button>
              </div>
              <div class="hint">New exercise. It joins your library and can be reused.</div>
            }
          </div>
        </section>

        @if (existing(); as w) {
          <div class="ends">
            <button class="card arch" (click)="archive(w)"><span class="row-action is-quiet grow">Archive workout</span><span class="aside">past sessions are kept</span><span class="chev">›</span></button>
            <button class="card arch" (click)="confirming.set(true)"><span class="row-action is-danger grow">Delete workout</span><span class="aside">gone for good</span><span class="chev">›</span></button>
          </div>
        }
      </div>
    </div>

    @if (picking()) {
      <app-exercise-picker [exclude]="usedIds()" (pick)="pickExisting($event)" (close)="picking.set(false)" />
    }
    @if (existing(); as w) {
      @if (confirming()) {
        <app-confirm-delete [name]="w.name" [detail]="deleteDetail(w)" (confirmed)="removeWorkout(w)" (cancelled)="confirming.set(false)" />
      }
    }
  `,
  styles: `
    .body { flex: 1; padding: 16px 16px 40px; display: flex; flex-direction: column; gap: 18px; }
    .lbl { font: 800 11px/1 var(--font); color: var(--ink-4); letter-spacing: .09em; text-transform: uppercase; margin-bottom: 10px; }
    .field { display: flex; }
    .card.pad { padding: 14px; border-radius: 18px; }
    .stepper { display: flex; align-items: center; gap: 12px; }
    .step { width: 44px; height: 44px; border-radius: 14px; background: var(--fill); font: 800 20px/1 var(--font); color: var(--ink); display: flex; align-items: center; justify-content: center; flex: none; }
    .sv { flex: 1; text-align: center; font: 600 14px/1 var(--font); color: var(--ink-3); }
    .sv b { font: 900 20px/1 var(--font); color: var(--ink); }
    .exs { display: flex; flex-direction: column; gap: 10px; margin-bottom: 10px; }
    .ex { padding: 14px; border-radius: 18px; }
    .ex-head { display: flex; align-items: center; gap: 10px; }
    .ex-name { font: 800 16px/1.2 var(--font); color: var(--ink); }
    .ex-kind { font: 500 12px/1.3 var(--font); color: var(--ink-4); margin-top: 3px; }
    .grow { flex: 1; min-width: 0; }
    .rm { width: 32px; height: 32px; border-radius: 10px; background: var(--fill); color: var(--ink-4); font: 700 18px/1 var(--font); display: flex; align-items: center; justify-content: center; flex: none; }
    .rm.sm { width: 28px; height: 28px; font-size: 15px; }
    .rm:disabled { opacity: .3; }
    .sets { display: flex; flex-direction: column; gap: 6px; margin-top: 12px; }
    .set { display: flex; align-items: center; gap: 8px; }
    .idx { width: 22px; font: 800 13px/1 var(--font); color: var(--ink-6); }
    .num { flex: 1; display: flex; align-items: center; gap: 6px; background: var(--fill); border: 1.5px solid var(--line-strong); border-radius: 11px; padding: 8px 12px; }
    .num input { width: 100%; border: 0; background: none; outline: 0; font: 800 15px/1 var(--font); color: var(--ink); }
    .num span { font: 600 12px/1 var(--font); color: var(--ink-4); }
    .x { font: 700 13px/1 var(--font); color: var(--ink-5); }
    .addset { margin-top: 10px; font: 700 13px/1 var(--font); color: var(--sage); padding: 6px 2px; }
    .add { display: flex; flex-direction: column; gap: 10px; }
    .lib { display: flex; align-items: center; gap: 10px; width: 100%; background: var(--sage-tint); border-radius: 12px; padding: 13px 14px; font: 800 14px/1 var(--font); color: var(--sage); }
    .lib .aside { font: 700 12px/1 var(--font); color: var(--sage-ink-2); }
    .lib .chev { font: 700 18px/1 var(--font); color: var(--sage-ink-2); }
    .or { font: 600 11.5px/1 var(--font); color: var(--ink-5); text-align: center; letter-spacing: .04em; text-transform: uppercase; }
    .addrow { display: flex; gap: 8px; align-items: center; }
    .addin { flex: 1; border: 0; outline: 0; background: var(--fill); border-radius: 12px; padding: 13px 14px; font: 700 15px/1 var(--font); color: var(--ink); }
    .tabs { display: flex; gap: 7px; }
    .hint { font: 500 12.5px/1.4 var(--font); color: var(--ink-4); }
    .ends { display: flex; flex-direction: column; gap: 10px; }
    .arch { display: flex; align-items: center; gap: 12px; padding: 15px; width: 100%; border-radius: var(--r-list); }
    .arch .aside { font: 500 12.5px/1 var(--font); color: var(--ink-5); }
    .arch .chev { font: 700 18px/1 var(--font); color: var(--ink-7); }
  `,
})
export class WorkoutEditorScreen {
  readonly store = inject(AppStore);
  private router = inject(Router);
  private location = inject(Location);
  readonly id = input<string>();
  readonly existing = computed(() => (this.id() ? this.store.workouts().find((w) => w.id === this.id()) ?? null : null));
  readonly appRest = APP_DEFAULT_REST_SECONDS;

  readonly name = signal('');
  readonly rest = signal<number | null>(null);
  readonly drafts = signal<Draft[]>([]);
  readonly newName = signal('');
  readonly newKind = signal<ExerciseKind>('reps');
  readonly busy = signal(false);
  readonly confirming = signal(false);
  readonly picking = signal(false);
  readonly meta = exerciseMeta;

  readonly usedIds = computed(() => this.drafts().map((d) => d.exercise.id));
  readonly suggestions = computed(() => {
    const used = new Set(this.usedIds());
    return this.store.activeExercises().filter((e) => !used.has(e.id));
  });
  readonly isNew = computed(() => {
    const n = this.newName().trim().toLowerCase();
    return n.length > 0 && !this.store.exercises().some((e) => e.name.toLowerCase() === n);
  });

  constructor() {
    queueMicrotask(() => {
      const w = this.existing();
      if (!w) return;
      this.name.set(w.name);
      this.rest.set(w.restSeconds);
      this.drafts.set(w.exercises.flatMap((we) => {
        const ex = this.store.exercises().find((e) => e.id === we.exerciseId);
        return ex ? [{ exercise: ex, sets: we.sets.map((s) => ({ ...s })) }] : [];
      }));
    });
  }

  v(e: Event) { return (e.target as HTMLInputElement).value; }
  bumpRest(delta: number) {
    const cur = this.rest() ?? APP_DEFAULT_REST_SECONDS;
    const next = Math.max(0, Math.min(600, cur + delta));
    this.rest.set(next === APP_DEFAULT_REST_SECONDS ? null : next);
  }
  async add() {
    const name = this.newName().trim();
    if (!name) return;
    const ex = await this.store.ensureExercise(name, this.newKind());
    if (this.store.saveError()) return;
    this.addDraft(ex);
    this.newName.set('');
    this.newKind.set('reps');
  }
  pickExisting(ex: Exercise) {
    this.picking.set(false);
    this.addDraft(ex);
  }
  /** Same number of sets as the exercise before it, so a workout stays even. */
  private addDraft(ex: Exercise) {
    if (this.usedIds().includes(ex.id)) return;
    const last = this.drafts().at(-1);
    const template: SetTarget = ex.kind === 'reps' ? { reps: 10, weight: null, seconds: null } : { reps: null, weight: null, seconds: 60 };
    const sets = Array.from({ length: last?.sets.length ?? 3 }, () => ({ ...template }));
    this.drafts.set([...this.drafts(), { exercise: ex, sets }]);
  }
  remove(i: number) { this.drafts.set(this.drafts().filter((_, k) => k !== i)); }
  addSet(i: number) {
    this.drafts.set(this.drafts().map((d, k) => (k === i ? { ...d, sets: [...d.sets, { ...(d.sets.at(-1) ?? { reps: 10, weight: null, seconds: 60 }) }] } : d)));
  }
  removeSet(i: number, j: number) {
    this.drafts.set(this.drafts().map((d, k) => (k === i ? { ...d, sets: d.sets.filter((_, m) => m !== j) } : d)));
  }
  setVal(i: number, j: number, field: keyof SetTarget, e: Event) {
    const raw = (e.target as HTMLInputElement).value;
    const val = raw === '' ? null : Number(raw);
    this.drafts.set(this.drafts().map((d, k) => (k === i ? { ...d, sets: d.sets.map((s, m) => (m === j ? { ...s, [field]: val } : s)) } : d)));
  }
  cancel() { history.length > 1 ? this.location.back() : void this.router.navigate(['/workouts']); }

  async save() {
    const w = this.existing();
    const workout: Workout = {
      id: w?.id ?? newId(),
      name: this.name().trim(),
      restSeconds: this.rest(),
      exercises: this.drafts().map((d) => ({ exerciseId: d.exercise.id, sets: d.sets })),
      archived: w?.archived ?? false,
    };
    this.busy.set(true);
    await this.store.saveWorkout(workout);
    this.busy.set(false);
    if (this.store.saveError()) return;
    void this.router.navigate(['/workouts'], { replaceUrl: true });
  }
  async archive(w: Workout) {
    await this.store.saveWorkout({ ...w, archived: true });
    void this.router.navigate(['/workouts'], { replaceUrl: true });
  }

  deleteDetail(w: Workout): string {
    return workoutDeleteDetail(w, this.store.sessions());
  }
  async removeWorkout(w: Workout) {
    this.confirming.set(false);
    await this.store.deleteWorkout(w);
    if (this.store.saveError()) return;
    void this.router.navigate(['/workouts'], { replaceUrl: true });
  }
}
