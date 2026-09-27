import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { formatElapsed } from '../core/dates';
import { describeSchedule, exerciseGoalsOn, pluralise } from '../core/goals';
import type { Exercise, ExerciseKind, Goal, Session, SessionExercise, SessionSet } from '../core/model';
import { allSetsDone, currentExercise, doneSets, emptySet, formatSet, formatTarget, isExerciseDone, isSessionPaused, nextExercise, nextOpenSet, pauseSession, resumeSession, sessionElapsedSeconds, sessionProgress, snapshotExercise } from '../core/sessions';
import { AppStore } from '../core/store';
import { goalVar } from '../ui/goal-colour';
import { ExercisePicker } from '../ui/exercise-picker';
import { Sheet } from '../ui/sheet';

/**
 * Live session, full-list layout. Every set saves immediately. Rest timer
 * auto-starts on tick, tap to skip, no sound. Time-based sets run a countdown:
 * start it by hand, it ticks itself at zero. Pause stops the clock, the set
 * timer and rest, and locks the screen until resumed. Finish closes as-is.
 * The list is a plan, not an order: tap any exercise to do it now.
 */
@Component({
  selector: 'app-session',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ExercisePicker, Sheet],
  template: `
    @if (session(); as s) {
      <div class="screen">
        <header class="top">
          <div class="grow"><div class="wn">{{ s.workoutName }}</div><div class="wm">{{ progress().done }} of {{ progress().total }} exercises</div></div>
          <div class="clock" [class.is-paused]="paused()">{{ elapsed() }}</div>
          @if (s.endedAt) {
            <button class="btn is-mint" (click)="leave()">Close</button>
          } @else {
            @if (!paused()) { <button class="pause" (click)="pause()" aria-label="Pause workout"><i></i></button> }
            <button class="btn is-mint" (click)="finish()">Finish</button>
          }
        </header>

        <div class="list-body" [class.has-rest]="resting()">
          @if (s.endedAt) {
            <div class="card quiet">This session is closed. {{ s.closedBy === 'midnight' ? 'It was left open and closed at midnight.' : '' }} {{ linkedGoal() ? 'It counted for ' + linkedGoal()!.name + '.' : 'It counted for no goal.' }}</div>
          }
          @for (ex of s.exercises; track $index; let i = $index) {
            @if (isDone(ex)) {
              <section class="card exd">
                <div class="eh"><span class="check is-xxs"></span><div class="en muted">{{ ex.name }}</div><div class="grow"></div><div class="em">{{ pluralise(ex.sets.length, 'set') }}</div></div>
                <div class="tags">
                  @for (set of done(ex); track $index) { <span class="tag is-done">{{ formatSet(set, ex.kind) }}</span> }
                </div>
                @if (!s.endedAt) { <button class="undo" (click)="untick(i, ex.sets.length - 1)">Undo last set</button> }
              </section>
            } @else if (i === current() && !s.endedAt) {
              <section class="card exc">
                <div class="eh"><div class="en big">{{ ex.name }}</div><div class="grow"></div><div class="em">set {{ open(ex) + 1 }} of {{ ex.sets.length }}</div></div>
                @for (set of ex.sets; track $index; let j = $index) {
                  <div class="srow" [class.is-cur]="j === open(ex)">
                    <span class="si" [class.is-cur]="j === open(ex)">{{ j + 1 }}</span>
                    @if (set.doneAt) {
                      <span class="sv done">{{ formatSet(set, ex.kind, { unit: true }) }}</span>
                      <button class="check is-xs" (click)="untick(i, j)" aria-label="Untick"></button>
                    } @else if (j === open(ex)) {
                      @if (ex.kind === 'reps') {
                        <div class="inputs">
                          <label class="in"><input type="number" inputmode="numeric" min="0" [value]="val(set, 'reps')" (change)="edit(i, j, 'reps', $event)" /><span>reps</span></label>
                          <label class="in"><input type="number" inputmode="decimal" min="0" step="0.5" [value]="val(set, 'weight')" (change)="edit(i, j, 'weight', $event)" placeholder="—" /><span>kg</span></label>
                        </div>
                      } @else if (timer()?.i === i && timer()?.j === j) {
                        <div class="run">
                          <span class="rt">{{ timerText() }}</span>
                          <span class="rb"><i [style.width.%]="timerPct()"></i></span>
                        </div>
                      } @else {
                        <div class="inputs">
                          <label class="in"><input type="number" inputmode="numeric" min="0" [value]="val(set, 'seconds')" (change)="edit(i, j, 'seconds', $event)" /><span>s</span></label>
                        </div>
                      }
                      @if (ex.kind === 'time') {
                        <button class="play" [class.is-on]="timer()?.i === i && timer()?.j === j && timerRunning()" (click)="timerToggle(i, j)"
                          [attr.aria-label]="timerOn(i, j) && timerRunning() ? 'Pause the set timer' : timerOn(i, j) ? 'Resume the set timer' : 'Start the set timer'">
                          <i></i>
                        </button>
                      }
                      <button class="ring is-active" (click)="tick(i, j)" aria-label="Set done"></button>
                    } @else {
                      <span class="sv next">{{ formatTarget(set.target, ex.kind) }}</span>
                      <span class="ring is-xs"></span>
                    }
                  </div>
                }
                <button class="addset" (click)="addSet(i)">+ Add a set</button>
              </section>
            } @else {
              <button class="card exn" (click)="focus.set(i)" [disabled]="!!s.endedAt" [attr.aria-label]="'Do ' + ex.name + ' now'">
                <span class="grow">
                  <span class="en">{{ ex.name }}</span>
                  <span class="ek">
                    @if (done(ex).length) { {{ done(ex).length }} of {{ ex.sets.length }} sets done · tap to continue }
                    @else { {{ pluralise(ex.sets.length, 'set') }}@if (ex.sets[0]) { · {{ formatTarget(ex.sets[0].target, ex.kind) }} } }
                  </span>
                </span>
                @if (!s.endedAt) {
                  @if (i === upNext()) { <span class="upnext">Up next</span> } @else { <span class="chev">›</span> }
                }
              </button>
            }
          }

          @if (!s.endedAt) {
            <div class="card addex">
              @if (available().length) {
                <button class="lib" (click)="picking.set(true)">
                  <span class="grow">Choose from your exercises</span><span class="aside">{{ available().length }}</span><span class="chev">›</span>
                </button>
              }
              <div class="addrow">
                <input class="addin" list="sess-ex" [value]="newName()" (input)="newName.set(v($event))" (keydown.enter)="addExercise()" [placeholder]="available().length ? 'Or type a new one…' : s.exercises.length ? 'Add another exercise…' : 'Type an exercise to start…'" autocomplete="off" />
                <datalist id="sess-ex">@for (e of available(); track e.id) { <option [value]="e.name"></option> }</datalist>
                <button class="btn is-sm is-dark" [disabled]="!newName().trim()" (click)="addExercise()">Add</button>
              </div>
              @if (isNew()) {
                <div class="tabs">
                  <button class="pill-tab" [class.is-on]="newKind() === 'reps'" (click)="newKind.set('reps')">Reps &amp; weight</button>
                  <button class="pill-tab" [class.is-on]="newKind() === 'time'" (click)="newKind.set('time')">Time</button>
                </div>
              }
            </div>
          }
          <div style="height:8px"></div>
        </div>

        @if (resting()) {
          <div class="rest" [class.is-frozen]="paused()">
            <div class="rt">{{ restLeft() }}</div>
            <div class="grow"><div class="rl">Rest</div><div class="bar"><i [style.width.%]="restPct()"></i></div></div>
            <button class="skip" (click)="skipRest()" [disabled]="paused()">Skip</button>
          </div>
        }

        @if (paused()) {
          <div class="veil">
            <div class="pausecard">
              <div class="pt">Paused</div>
              <div class="ps">The clock, set timers and rest are all stopped.</div>
              <button class="btn is-mint" (click)="resume()">Resume workout</button>
            </div>
          </div>
        }
      </div>
      @if (picking()) {
        <app-exercise-picker [exclude]="usedIds()" (pick)="addExisting($event)" (close)="picking.set(false)" />
      }
      @if (linking()) {
        <app-sheet (close)="linking.set(false)">
          <div class="title">Which goal does this count for?</div>
          <div class="sub">Finishing {{ s.workoutName }}. Only the goal you pick gets ticked.</div>
          <div class="opts">
            @for (g of candidates(); track g.id) {
              <button class="option" [style.--goal]="colour(g)" (click)="finishWith(g.id)">
                <span class="dot"></span>
                <span class="grow"><div class="name">{{ g.name }}</div><div class="meta">{{ describe(g) }}</div></span>
                <span class="chev">›</span>
              </button>
            }
            <button class="option" (click)="finishWith(null)">
              <span class="grow"><div class="name">None of them</div><div class="meta">Just close the session</div></span><span class="chev">›</span>
            </button>
          </div>
        </app-sheet>
      }
    }
  `,
  styles: `
    .top { background: var(--dark); padding: 16px 18px; display: flex; align-items: center; gap: 14px; position: sticky; top: 0; z-index: 2; }
    .grow { flex: 1; min-width: 0; }
    .wn { font: 800 19px/1.2 var(--font); color: #fff; }
    .wm { font: 600 12px/1.3 var(--font); color: var(--dark-ink); margin-top: 4px; }
    .clock { font: 900 22px/1 var(--font); color: #fff; font-variant-numeric: tabular-nums; }
    .clock.is-paused { color: var(--mint); opacity: .75; }
    .pause { width: 40px; height: 40px; border-radius: 50%; border: 2px solid var(--dark-4); color: #fff; display: flex; align-items: center; justify-content: center; flex: none; }
    .pause i, .play.is-on i { width: 12px; height: 14px; position: relative; }
    .pause i::before, .pause i::after, .play.is-on i::before, .play.is-on i::after { content: ''; position: absolute; top: 0; bottom: 0; width: 4px; border-radius: 2px; background: currentColor; }
    .pause i::before, .play.is-on i::before { left: 0; }
    .pause i::after, .play.is-on i::after { right: 0; }
    .top .btn { padding: 12px 16px; font-size: 13px; }
    .list-body { flex: 1; padding: 14px 14px 24px; display: flex; flex-direction: column; gap: 12px; }
    .list-body.has-rest { padding-bottom: 110px; }
    .card { padding: 14px; border-radius: var(--r-list); }
    .quiet { font: 500 13.5px/1.45 var(--font); color: var(--ink-3); background: var(--surface-muted); border-color: var(--line-muted); }
    .eh { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
    .en { font: 800 16px/1.2 var(--font); color: var(--ink); }
    .en.muted { color: var(--ink-3); }
    .en.big { font: 900 19px/1.2 var(--font); }
    .em { font: 600 12px/1 var(--font); color: var(--ink-4); }
    .ek { font: 500 12px/1.3 var(--font); color: var(--ink-4); margin-top: 4px; }
    .exc { border: 2px solid var(--ink); }
    .exc .eh { margin-bottom: 4px; }
    .exn { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; }
    .exn .en, .exn .ek { display: block; margin: 0; }
    .exn:disabled .en { color: var(--ink-3); }
    .exn .chev { font: 700 18px/1 var(--font); color: var(--ink-7); padding: 0 6px; }
    .upnext { font: 700 12px/1 var(--font); color: var(--ink-4); background: var(--fill); border-radius: 999px; padding: 10px 13px; }
    .srow { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--line-soft); }
    .srow:last-of-type { border-bottom: 0; }
    .srow.is-cur { padding: 10px 0 8px; }
    .si { width: 26px; font: 800 14px/1 var(--font); color: var(--ink-6); }
    .si.is-cur { font-weight: 900; font-size: 15px; color: var(--ink); }
    .sv { flex: 1; font: 700 15px/1 var(--font); }
    .sv.done { color: var(--ink-3); }
    .sv.next { color: var(--ink-6); }
    .inputs { flex: 1; display: flex; gap: 8px; }
    .in { display: flex; align-items: center; gap: 5px; background: var(--fill); border: 1.5px solid var(--line-strong); border-radius: 11px; padding: 9px 12px; flex: 1; min-width: 0; }
    .in input { width: 100%; min-width: 0; border: 0; background: none; outline: 0; font: 800 15px/1 var(--font); color: var(--ink); }
    .in span { font: 600 12px/1 var(--font); color: var(--ink-4); }
    .play { width: 40px; height: 40px; border-radius: 50%; background: var(--sage-tint); color: var(--sage); display: flex; align-items: center; justify-content: center; flex: none; }
    .play i { width: 0; height: 0; border-left: 11px solid currentColor; border-top: 7px solid transparent; border-bottom: 7px solid transparent; margin-left: 3px; }
    .play.is-on { background: var(--ink); color: #fff; }
    .play.is-on i { width: 12px; height: 14px; margin: 0; border: 0; }
    .run { flex: 1; min-width: 0; position: relative; display: flex; align-items: center; background: var(--ink); border-radius: 11px; padding: 11px 12px 14px; overflow: hidden; }
    .run .rt { font: 800 15px/1 var(--font); color: #fff; font-variant-numeric: tabular-nums; }
    .run .rb { position: absolute; left: 0; right: 0; bottom: 0; height: 4px; background: var(--dark-3); }
    .run .rb i { display: block; height: 100%; background: var(--mint); transition: width 1s linear; }
    .addset { margin-top: 8px; font: 700 13px/1 var(--font); color: var(--sage); padding: 6px 2px; }
    .undo { margin-top: 10px; font: 700 12px/1 var(--font); color: var(--ink-4); padding: 4px 0; }
    .tags { margin-top: 2px; }
    .addex { display: flex; flex-direction: column; gap: 10px; }
    .lib { display: flex; align-items: center; gap: 10px; width: 100%; background: var(--sage-tint); border-radius: 12px; padding: 13px 14px; font: 800 14px/1 var(--font); color: var(--sage); }
    .lib .aside { font: 700 12px/1 var(--font); color: var(--sage-ink-2); }
    .lib .chev { font: 700 18px/1 var(--font); color: var(--sage-ink-2); }
    .addrow { display: flex; gap: 8px; align-items: center; }
    .addin { flex: 1; border: 0; outline: 0; background: var(--fill); border-radius: 12px; padding: 13px 14px; font: 700 15px/1 var(--font); color: var(--ink); }
    .tabs { display: flex; gap: 7px; }
    .rest { position: fixed; left: 0; right: 0; bottom: 0; max-width: 480px; margin: 0 auto; background: var(--dark); padding: 14px 18px calc(16px + env(safe-area-inset-bottom, 0px)); display: flex; align-items: center; gap: 14px; z-index: 5; }
    .rest.is-frozen { pointer-events: none; opacity: .5; }
    .rest.is-frozen .bar i { transition: none; }
    .rt { font: 900 30px/1 var(--font); color: var(--mint); font-variant-numeric: tabular-nums; min-width: 66px; }
    .rl { font: 700 12px/1 var(--font); color: var(--dark-ink); margin-bottom: 8px; }
    .bar { height: 8px; border-radius: 4px; background: var(--dark-3); overflow: hidden; }
    .bar i { display: block; height: 100%; background: var(--mint); border-radius: 4px; transition: width 1s linear; }
    .skip { font: 800 13px/1 var(--font); color: #fff; border: 2px solid var(--dark-4); border-radius: 999px; padding: 11px 15px; }
    .veil { position: fixed; inset: 0; max-width: 480px; margin: 0 auto; z-index: 1; background: rgba(27, 30, 28, .38); display: flex; align-items: center; justify-content: center; padding: 24px; }
    .pausecard { width: 100%; max-width: 300px; background: var(--surface); border-radius: var(--r-card); padding: 26px 24px 24px; text-align: center; box-shadow: 0 18px 40px rgba(27, 30, 28, .18); }
    .pt { font: 900 24px/1.1 var(--font); color: var(--ink); letter-spacing: -.02em; }
    .ps { font: 500 13.5px/1.45 var(--font); color: var(--ink-3); margin: 8px 0 18px; }
    .opts { display: flex; flex-direction: column; gap: 10px; }
  `,
})
export class SessionScreen {
  readonly store = inject(AppStore);
  private router = inject(Router);
  readonly id = input.required<string>();
  readonly session = computed(() => this.store.session(this.id()) ?? null);
  readonly progress = computed(() => this.session() ? sessionProgress(this.session()!) : { done: 0, total: 0, current: -1 });
  /** The exercise the user tapped to do now. Any order is fine: a machine may be busy. */
  readonly focus = signal<number | null>(null);
  readonly current = computed(() => this.session() ? currentExercise(this.session()!, this.focus()) : -1);
  readonly upNext = computed(() => this.session() ? nextExercise(this.session()!, this.current()) : -1);
  readonly picking = signal(false);
  /** The "which goal?" sheet, shown on Finish when the session was not started from a goal. */
  readonly linking = signal(false);
  readonly candidates = computed(() => this.session() ? exerciseGoalsOn(this.store.goals(), this.session()!.date) : []);
  readonly linkedGoal = computed(() => {
    const id = this.session()?.goalId;
    return id ? this.store.goal(id) ?? null : null;
  });
  readonly colour = goalVar;
  readonly describe = describeSchedule;
  readonly usedIds = computed(() => this.session()?.exercises.map((e) => e.exerciseId) ?? []);
  readonly available = computed(() => {
    const used = new Set(this.usedIds());
    return this.store.activeExercises().filter((e) => !used.has(e.id));
  });
  readonly pluralise = pluralise;
  readonly formatSet = formatSet;
  readonly formatTarget = formatTarget;
  readonly isDone = isExerciseDone;
  readonly done = doneSets;
  readonly open = nextOpenSet;

  private readonly now = signal(Date.now());
  /** True while the whole workout is paused: clock, timers and edits are frozen. */
  readonly paused = computed(() => {
    const s = this.session();
    return !!s && isSessionPaused(s);
  });
  /** Wall clock for the session; frozen at the moment it was paused. */
  private readonly clockNow = computed(() => {
    const s = this.session();
    return s && isSessionPaused(s) ? new Date(s.pausedAt!).getTime() : this.now();
  });
  readonly elapsed = computed(() => {
    const s = this.session();
    if (!s) return '0:00';
    return formatElapsed(sessionElapsedSeconds(s, this.now()));
  });

  private readonly restEnd = signal<number | null>(null);
  private readonly restTotal = signal(90);
  readonly resting = computed(() => this.restEnd() !== null && this.restEnd()! > this.clockNow());
  readonly restLeft = computed(() => formatElapsed(((this.restEnd() ?? 0) - this.clockNow()) / 1000 + 0.999));
  readonly restPct = computed(() => Math.max(0, Math.min(100, (((this.restEnd() ?? 0) - this.clockNow()) / 1000 / this.restTotal()) * 100)));

  /**
   * The one time-based set counting down right now. `endAt` is an absolute
   * timestamp while running; when held (`held` says by whom) `left` keeps the
   * remaining seconds so it can carry on where it stopped.
   */
  readonly timer = signal<{ i: number; j: number; total: number; left: number; endAt: number | null; held: 'user' | 'pause' | null } | null>(null);
  readonly timerRunning = computed(() => (this.timer()?.endAt ?? null) !== null);
  readonly timerLeft = computed(() => {
    const t = this.timer();
    if (!t) return 0;
    return Math.max(0, t.endAt === null ? t.left : (t.endAt - this.clockNow()) / 1000);
  });
  readonly timerText = computed(() => formatElapsed(Math.ceil(this.timerLeft())));
  readonly timerPct = computed(() => {
    const t = this.timer();
    return !t || t.total <= 0 ? 0 : Math.max(0, Math.min(100, (this.timerLeft() / t.total) * 100));
  });

  readonly newName = signal('');
  readonly newKind = signal<ExerciseKind>('reps');
  readonly isNew = computed(() => {
    const n = this.newName().trim().toLowerCase();
    return n.length > 0 && !this.store.exercises().some((e) => e.name.toLowerCase() === n);
  });

  constructor() {
    const t = setInterval(() => this.now.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(t));
    // A countdown that reaches zero ticks its set, exactly like tapping the ring.
    effect(() => {
      const timer = this.timer();
      if (!timer || timer.endAt === null) return;
      if (this.clockNow() >= timer.endAt) {
        this.timer.set(null);
        void this.tick(timer.i, timer.j);
      }
    });
  }

  v(e: Event) { return (e.target as HTMLInputElement).value; }
  val(set: SessionSet, f: 'reps' | 'weight' | 'seconds'): string {
    const x = set[f] ?? set.target[f];
    return x === null ? '' : String(x);
  }

  private update(mut: (s: Session) => Session) {
    const s = this.session();
    if (!s) return Promise.resolve();
    return this.store.saveSession(mut(structuredClone(s)));
  }

  edit(i: number, j: number, f: 'reps' | 'weight' | 'seconds', e: Event) {
    const raw = (e.target as HTMLInputElement).value;
    const val = raw === '' ? null : Number(raw);
    return this.update((s) => { s.exercises[i].sets[j][f] = val; return s; });
  }

  /** Tick a set: actuals default to the target, save now, start rest unless nothing is left. */
  async tick(i: number, j: number) {
    const s = this.session();
    if (!s) return;
    const ex = s.exercises[i];
    const isLast = allSetsDone(s, { i, j });
    this.clearTimer(i, j);
    await this.update((x) => {
      const set = x.exercises[i].sets[j];
      set.reps = set.reps ?? set.target.reps;
      set.weight = set.weight ?? set.target.weight;
      set.seconds = set.seconds ?? set.target.seconds;
      set.doneAt = new Date().toISOString();
      return x;
    });
    if (!isLast && ex.restSeconds > 0) {
      this.restTotal.set(ex.restSeconds);
      this.restEnd.set(Date.now() + ex.restSeconds * 1000);
    }
  }
  untick(i: number, j: number) {
    this.clearTimer(i, j);
    this.restEnd.set(null);
    return this.update((s) => { s.exercises[i].sets[j].doneAt = null; return s; });
  }
  addSet(i: number) {
    return this.update((s) => {
      const ex = s.exercises[i];
      ex.sets.push(emptySet(ex.kind, ex.sets.at(-1)?.target));
      return s;
    });
  }
  async addExercise() {
    const name = this.newName().trim();
    if (!name) return;
    const ex = await this.store.ensureExercise(name, this.newKind());
    if (this.store.saveError()) return;
    await this.append(ex);
    this.newName.set('');
    this.newKind.set('reps');
  }
  addExisting(ex: Exercise) {
    this.picking.set(false);
    return this.append(ex);
  }
  /** Add an exercise to the session with as many sets as the one before it. */
  private append(ex: Exercise) {
    const s = this.session();
    if (!s || this.usedIds().includes(ex.id)) return Promise.resolve();
    const workoutRest = s.workoutId ? this.store.workouts().find((w) => w.id === s.workoutId)?.restSeconds ?? null : null;
    const like = s.exercises.at(-1)?.sets.length ?? 3;
    const targets = Array.from({ length: like }, () => (ex.kind === 'reps' ? { reps: 10, weight: null, seconds: null } : { reps: null, weight: null, seconds: 60 }));
    const snap: SessionExercise = snapshotExercise(ex, targets, workoutRest);
    return this.update((x) => { x.exercises.push(snap); return x; });
  }
  skipRest() { this.restEnd.set(null); }

  /* ---------- set countdown ---------- */

  /** Is the running/held timer the one for this set? */
  timerOn(i: number, j: number): boolean {
    const t = this.timer();
    return !!t && t.i === i && t.j === j;
  }
  /** Start the countdown for a time set from its target seconds. */
  startTimer(i: number, j: number) {
    const s = this.session();
    if (!s || this.paused()) return;
    const set = s.exercises[i].sets[j];
    const secs = set.seconds ?? set.target.seconds ?? 0;
    if (set.doneAt || secs <= 0) return;
    this.timer.set({ i, j, total: secs, left: secs, endAt: Date.now() + secs * 1000, held: null });
  }
  /** Play/pause for the set timer: start it, hold it, or pick it back up. */
  timerToggle(i: number, j: number) {
    const t = this.timer();
    if (!t || t.i !== i || t.j !== j) return this.startTimer(i, j);
    if (t.endAt !== null) this.timer.set({ ...t, left: Math.max(0, (t.endAt - this.clockNow()) / 1000), endAt: null, held: 'user' });
    else this.timer.set({ ...t, endAt: this.clockNow() + t.left * 1000, held: null });
  }
  private clearTimer(i: number, j: number) {
    if (this.timerOn(i, j)) this.timer.set(null);
  }

  /* ---------- pause ---------- */

  /**
   * Pause the workout: the clock freezes and the set timer is held. The rest
   * timer stops with the frozen clock, and is shifted forward on resume.
   */
  pause() {
    const s = this.session();
    if (!s || s.endedAt || isSessionPaused(s)) return Promise.resolve();
    this.timer.update((t) => (t && t.endAt !== null ? { ...t, left: Math.max(0, (t.endAt - this.clockNow()) / 1000), endAt: null, held: 'pause' } : t));
    return this.update((x) => pauseSession(x, new Date()));
  }
  resume() {
    const s = this.session();
    if (!s || !isSessionPaused(s)) return Promise.resolve();
    const pausedMs = Date.now() - new Date(s.pausedAt!).getTime();
    this.timer.update((t) => (t && t.held === 'pause' ? { ...t, endAt: Date.now() + t.left * 1000, held: null } : t));
    this.restEnd.update((end) => (end === null ? end : end + pausedMs));
    return this.update((x) => resumeSession(x, new Date()));
  }

  /** Started from a goal: close and tick it. Otherwise ask which goal, if there is any to pick. */
  finish() {
    const s = this.session();
    if (!s) return Promise.resolve();
    if (s.goalId === null && this.candidates().length) { this.linking.set(true); return Promise.resolve(); }
    return this.finishWith(s.goalId);
  }
  async finishWith(goalId: string | null) {
    this.linking.set(false);
    await this.store.finishSession(this.id(), 'user', goalId);
    if (!this.store.saveError()) this.leave();
  }
  leave() { void this.router.navigate(['/today']); }
}
