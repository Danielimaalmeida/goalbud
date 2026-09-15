import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { WEEKDAY_LETTERS, weekStart } from '../core/dates';
import { currentSchedule } from '../core/goals';
import { newId } from '../core/ids';
import { COLOUR_HEX, GOAL_COLOURS, type Goal, type GoalColour, type GoalShape, type Recurrence, type ScheduleVersion, type Weekday } from '../core/model';
import { AppStore } from '../core/store';
import { Glyph, GLYPHS } from '../ui/glyph';

type RepeatMode = 'daily' | 'everyN' | 'weekdays';

/**
 * New goal / edit goal. Shape first, then only the fields that shape needs.
 * Edits to target or schedule apply from the current week forward.
 */
@Component({
  selector: 'app-goal-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Glyph],
  template: `
    <div class="screen">
      <header class="form-head">
        <button class="ghost" (click)="cancel()">Cancel</button>
        <div class="title">{{ existing() ? 'Edit goal' : 'New goal' }}</div>
        <button class="btn" [disabled]="!name().trim() || busy()" (click)="save()">Save</button>
      </header>

      <div class="body">
        <section>
          <div class="lbl">Name</div>
          <label class="field"><input #nameInput [value]="name()" (input)="name.set(v($event))" placeholder="What do you want to keep track of?" autocomplete="off" /></label>
        </section>

        @if (!existing()) {
          <section>
            <div class="lbl">Shape</div>
            <div class="shapes">
              @for (s of shapes; track s.id) {
                <button class="shape" [class.is-on]="shape() === s.id" (click)="shape.set(s.id)">
                  <div class="sn">{{ s.name }}</div><div class="sd">{{ s.desc }}</div>
                </button>
              }
            </div>
          </section>
        }

        @if (shape() === 'scheduled') {
          <section>
            <div class="lbl">Repeats</div>
            <div class="card pad">
              <div class="tabs">
                <button class="pill-tab" [class.is-on]="repeat() === 'daily'" (click)="repeat.set('daily')">Every day</button>
                <button class="pill-tab" [class.is-on]="repeat() === 'everyN'" (click)="repeat.set('everyN')">Every N days</button>
                <button class="pill-tab" [class.is-on]="repeat() === 'weekdays'" (click)="repeat.set('weekdays')">Weekdays</button>
              </div>
              @if (repeat() === 'weekdays') {
                <div class="days">
                  @for (d of weekdays; track d) {
                    <button class="day" [class.is-on]="days().includes(d)" (click)="toggleDay(d)">{{ letters[d] }}</button>
                  }
                </div>
              } @else if (repeat() === 'everyN') {
                <div class="stepper">
                  <button class="step" (click)="n.set(max(2, n() - 1))" aria-label="Fewer">−</button>
                  <div class="sv">Every <b>{{ n() }}</b> days</div>
                  <button class="step" (click)="n.set(min(30, n() + 1))" aria-label="More">+</button>
                </div>
                <div class="hint">Counted from {{ existing() ? 'the day it was created' : 'today' }}.</div>
              } @else {
                <div class="days">
                  @for (d of weekdays; track d) { <span class="day is-on is-static">{{ letters[d] }}</span> }
                </div>
              }
            </div>
          </section>
        }

        @if (shape() === 'weekly') {
          <section>
            <div class="lbl">How often</div>
            <div class="card pad">
              <div class="stepper">
                <button class="step" (click)="times.set(max(1, times() - 1))" aria-label="Fewer">−</button>
                <div class="sv"><b>{{ times() }}</b> {{ times() === 1 ? 'time' : 'times' }} a week</div>
                <button class="step" (click)="times.set(min(7, times() + 1))" aria-label="More">+</button>
              </div>
              <div class="hint">Any days. The week starts on Monday, and a day counts once.</div>
            </div>
          </section>
        }

        @if (shape() === 'long') {
          <section>
            <div class="lbl">Target date</div>
            <label class="field"><input type="date" [value]="targetDate()" [min]="store.today()" (input)="targetDate.set(v($event))" /></label>
            <div class="hint">Shown as a date, nothing else. Nothing happens when it passes.</div>
          </section>
        } @else if (longGoals().length) {
          <section>
            <div class="lbl">Part of</div>
            <div class="card nopad">
              <button class="row" (click)="parentId.set(null)">
                <span class="row-action grow" [class.is-quiet]="parentId() !== null">On its own</span>
                @if (parentId() === null) { <span class="check is-xxs"></span> }
              </button>
              @for (p of longGoals(); track p.id) {
                <button class="row" (click)="parentId.set(p.id)">
                  <span class="dot" [style.--goal]="hex[p.colour ?? 'sage']"></span>
                  <span class="row-action grow" [class.is-quiet]="parentId() !== p.id">{{ p.name }}</span>
                  @if (parentId() === p.id) { <span class="check is-xxs"></span> }
                </button>
              }
            </div>
          </section>
        }

        <section>
          <div class="lbl">Colour &amp; icon</div>
          <div class="card pad col">
            <div class="swatches">
              @for (c of colours; track c) {
                <button class="sw" [class.is-on]="colour() === c" [style.background]="hex[c]" (click)="colour.set(c)" [attr.aria-label]="c"></button>
              }
            </div>
            <div class="icons" [class.is-all]="allIcons()">
              <button class="ico" [class.is-on]="icon() === null" (click)="icon.set(null)" aria-label="No icon"><i class="none"></i></button>
              @for (g of shownIcons(); track g) {
                <button class="ico" [class.is-on]="icon() === g" (click)="icon.set(g)" [style.--goal]="hex[colour()]"><app-glyph [name]="g" [size]="18" /></button>
              }
              @if (!allIcons()) { <button class="btn is-soft more" (click)="allIcons.set(true)">All {{ glyphCount }}</button> }
            </div>
          </div>
        </section>

        @if (shape() !== 'long') {
          <section>
            <button class="card wk" (click)="isExercise.set(!isExercise())">
              <span class="grow"><span class="wt">This is a workout</span><span class="wd">Finishing a session ticks it off</span></span>
              <span class="toggle" [class.is-on]="isExercise()"></span>
            </button>
          </section>
        }

        @if (existing()) {
          <div class="hint center">Changes to the schedule apply from this week on. Past weeks keep what they had.</div>
        }
      </div>
    </div>
  `,
  styles: `
    .body { flex: 1; padding: 16px 16px 40px; display: flex; flex-direction: column; gap: 18px; }
    .lbl { font: 800 11px/1 var(--font); color: var(--ink-4); letter-spacing: .09em; text-transform: uppercase; margin-bottom: 10px; }
    .field { display: flex; }
    .shapes { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
    .shape { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; padding: 14px; text-align: left; }
    .shape.is-on { background: var(--dark); border-color: var(--dark); }
    .sn { font: 800 14px/1.2 var(--font); color: var(--ink); }
    .sd { font: 500 11.5px/1.3 var(--font); color: var(--ink-4); margin-top: 5px; }
    .shape.is-on .sn { color: #fff; } .shape.is-on .sd { color: var(--dark-ink); }
    .card.pad { padding: 14px; border-radius: 18px; }
    .card.nopad { padding: 0; border-radius: 18px; overflow: hidden; }
    .card.col { display: flex; flex-direction: column; gap: 14px; }
    .tabs { display: flex; gap: 7px; margin-bottom: 14px; }
    .days { display: flex; gap: 6px; }
    .day { flex: 1; aspect-ratio: 1; border-radius: 50%; background: var(--fill); display: flex; align-items: center; justify-content: center; font: 800 12px var(--font); color: var(--ink-3); }
    .day.is-on { background: var(--sage); color: #fff; }
    .day.is-static { opacity: .9; }
    .stepper { display: flex; align-items: center; gap: 12px; }
    .step { width: 44px; height: 44px; border-radius: 14px; background: var(--fill); font: 800 20px/1 var(--font); color: var(--ink); display: flex; align-items: center; justify-content: center; }
    .sv { flex: 1; text-align: center; font: 600 15px/1 var(--font); color: var(--ink-3); }
    .sv b { font: 900 22px/1 var(--font); color: var(--ink); }
    .hint { font: 500 12.5px/1.4 var(--font); color: var(--ink-4); margin-top: 10px; }
    .hint.center { text-align: center; margin-top: 0; }
    .swatches { display: flex; gap: 8px; }
    .sw { flex: 1; aspect-ratio: 1; border-radius: 11px; border: 3px solid transparent; }
    .sw.is-on { border-color: var(--ink); }
    .icons { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .ico { width: 44px; height: 44px; border-radius: 14px; background: var(--fill); display: flex; align-items: center; justify-content: center; color: var(--ink-6); }
    .ico.is-on { background: color-mix(in srgb, var(--goal, var(--sage)) 14%, white); color: var(--goal, var(--sage)); }
    .ico .none { width: 16px; height: 16px; border-radius: 50%; border: 2px dashed currentColor; }
    .more { flex: 1; border-radius: 12px; padding: 15px 0; font-size: 12px; }
    .wk { display: flex; align-items: center; gap: 12px; padding: 16px; width: 100%; border-radius: 18px; }
    .wt { display: block; font: 700 15px/1.2 var(--font); color: var(--ink); }
    .wd { display: block; font: 500 12px/1.35 var(--font); color: var(--ink-4); margin-top: 4px; }
    .grow { flex: 1; min-width: 0; text-align: left; }
    .row .dot { width: 12px; height: 12px; }
  `,
})
export class GoalEditorScreen {
  readonly store = inject(AppStore);
  private router = inject(Router);
  private location = inject(Location);
  readonly id = input<string>();
  readonly existing = computed(() => (this.id() ? this.store.goal(this.id()!) ?? null : null));

  readonly shapes: { id: GoalShape; name: string; desc: string }[] = [
    { id: 'scheduled', name: 'Scheduled', desc: 'On chosen days' },
    { id: 'weekly', name: 'Weekly count', desc: 'N times a week' },
    { id: 'log', name: 'Just log it', desc: 'No target' },
    { id: 'long', name: 'Long goal', desc: 'With a target date' },
  ];
  readonly weekdays: Weekday[] = [1, 2, 3, 4, 5, 6, 7];
  readonly letters = WEEKDAY_LETTERS;
  readonly colours = GOAL_COLOURS;
  readonly hex = COLOUR_HEX;
  readonly glyphCount = GLYPHS.length;
  readonly max = Math.max;
  readonly min = Math.min;

  readonly name = signal('');
  readonly shape = signal<GoalShape>('scheduled');
  readonly repeat = signal<RepeatMode>('daily');
  readonly days = signal<Weekday[]>([1, 2, 3, 4, 5]);
  readonly n = signal(2);
  readonly times = signal(3);
  readonly targetDate = signal('');
  readonly parentId = signal<string | null>(null);
  readonly colour = signal<GoalColour>('sage');
  readonly icon = signal<string | null>(null);
  readonly allIcons = signal(false);
  readonly isExercise = signal(false);
  readonly busy = signal(false);

  readonly longGoals = computed(() => this.store.goals().filter((g) => g.shape === 'long' && g.state === 'active' && g.id !== this.id()));
  readonly shownIcons = computed(() => (this.allIcons() ? [...GLYPHS] : GLYPHS.slice(0, 4)));

  constructor() {
    queueMicrotask(() => {
      const g = this.existing();
      if (g) this.fill(g);
      else document.querySelector<HTMLInputElement>('input')?.focus();
    });
  }

  private fill(g: Goal) {
    this.name.set(g.name);
    this.shape.set(g.shape);
    this.colour.set(g.colour ?? 'sage');
    this.icon.set(g.icon);
    this.allIcons.set(!!g.icon && GLYPHS.indexOf(g.icon as never) >= 4);
    this.isExercise.set(g.isExercise);
    this.parentId.set(g.parentId);
    this.targetDate.set(g.targetDate ?? '');
    const s = currentSchedule(g);
    if (s?.recurrence) {
      const r = s.recurrence;
      this.repeat.set(r.kind);
      if (r.kind === 'everyN') this.n.set(r.n);
      if (r.kind === 'weekdays') this.days.set(r.days);
    }
    if (s?.timesPerWeek) this.times.set(s.timesPerWeek);
  }

  v(e: Event) { return (e.target as HTMLInputElement).value; }
  toggleDay(d: Weekday) {
    const cur = this.days();
    this.days.set(cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort());
  }
  cancel() { history.length > 1 ? this.location.back() : void this.router.navigate(['/goals']); }

  async save() {
    const g = this.existing();
    const today = this.store.today();
    const shape = g?.shape ?? this.shape();
    const version: ScheduleVersion = { from: weekStart(today) };
    if (shape === 'scheduled') version.recurrence = this.recurrence(g);
    if (shape === 'weekly') version.timesPerWeek = this.times();

    // A new version replaces this week's, if any; earlier weeks keep theirs.
    const schedule = shape === 'scheduled' || shape === 'weekly'
      ? [...(g?.schedule ?? []).filter((x) => x.from !== version.from), version]
      : [];

    const goal: Goal = {
      id: g?.id ?? newId(),
      name: this.name().trim(),
      shape,
      colour: this.colour(),
      icon: this.icon(),
      isExercise: shape === 'long' ? false : this.isExercise(),
      state: g?.state ?? 'active',
      parentId: shape === 'long' ? null : this.parentId(),
      schedule,
      pauses: g?.pauses ?? [],
      targetDate: shape === 'long' ? this.targetDate() || null : null,
      completedOn: g?.completedOn ?? null,
      createdOn: g?.createdOn ?? today,
      archivedOn: g?.archivedOn ?? null,
      sortOrder: g?.sortOrder ?? this.store.goals().length,
    };
    this.busy.set(true);
    await this.store.saveGoal(goal);
    this.busy.set(false);
    if (this.store.saveError()) return;
    if (g) this.cancel();
    else void this.router.navigate(['/goals'], { replaceUrl: true });
  }

  private recurrence(existing: Goal | null): Recurrence {
    switch (this.repeat()) {
      case 'daily': return { kind: 'daily' };
      case 'weekdays': return { kind: 'weekdays', days: this.days().length ? this.days() : [1, 2, 3, 4, 5] };
      case 'everyN': {
        const prev = currentSchedule(existing ?? { schedule: [] } as unknown as Goal)?.recurrence;
        const anchor = prev?.kind === 'everyN' ? prev.anchor : existing?.createdOn ?? this.store.today();
        return { kind: 'everyN', n: this.n(), anchor };
      }
    }
  }
}
