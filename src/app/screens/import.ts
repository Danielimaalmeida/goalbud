import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { buildImport, IMPORT_FORMAT_PROMPT, parseImport } from '../core/import';
import { pluralise } from '../core/goals';
import { formatTarget } from '../core/sessions';
import { AppStore } from '../core/store';

const EXAMPLE_CSV = `workout,exercise,sets,reps,weight,seconds,kind,rest
Push day,Bench press,3,8,60,,reps,90
Push day,Plank,2,,,60,time,90`;

/**
 * Paste CSV or JSON, check the preview, then add the workouts. Exercises that
 * already exist are reused by name; nothing existing is changed or deleted.
 */
@Component({
  selector: 'app-import',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="screen">
      <header class="detail-head">
        <button class="back" (click)="back()" aria-label="Back">‹</button>
        <div class="grow"><div class="title">Import workouts</div><div class="sub">Paste CSV or JSON as text</div></div>
      </header>
      <div class="screen-body">
        <textarea class="paste" rows="9" placeholder="Paste workouts here" aria-label="Workouts to import" [value]="text()" (input)="text.set(val($event))"></textarea>

        @if (text().trim() === '') {
          <div class="card quiet">
            One workout per name, one exercise per name. JSON can nest exercises and sets; CSV takes one line per exercise with a <b>sets</b> count, or one line per set.
            Weight is in kg. Existing exercises are reused by name, and a workout whose name you already have is skipped.
          </div>
          <div class="eyebrow">Help</div>
          <div class="actions">
            <button class="btn is-soft" (click)="copy(prompt, 'prompt')">{{ copied() === 'prompt' ? 'Copied' : 'Copy format for an LLM' }}</button>
            <button class="btn is-soft" (click)="text.set(example)">Try an example (CSV)</button>
          </div>
        } @else {
          @for (e of parsed().errors; track $index) { <div class="card problem" role="alert">{{ e }}</div> }
          @for (n of build().notes; track $index) { <div class="card warn">{{ n }}</div> }
          @for (w of parsed().warnings; track $index) { <div class="card warn">{{ w }}</div> }

          @if (build().workouts.length) {
            <div class="eyebrow">Will add · {{ pluralise(build().workouts.length, 'workout') }}</div>
            @for (w of build().preview; track $index) {
              <div class="card wo">
                <div class="wn">{{ w.name }}</div>
                <div class="wm">{{ pluralise(w.exercises.length, 'exercise') }} · rest {{ w.restSeconds ?? 90 }} s</div>
                @for (e of w.exercises; track $index) {
                  <div class="ex">
                    <div class="en">{{ e.name }} @if (isNew(e.name)) { <span class="new">new</span> }</div>
                    <div class="tags">
                      @for (t of e.sets; track $index) { <span class="tag is-quiet">{{ target(t, e.kind) }}</span> }
                    </div>
                  </div>
                }
              </div>
            }
          }
          @if (build().skipped.length) {
            <div class="card quiet">Skipped, you already have a workout with this name: {{ build().skipped.join(', ') }}. Rename it in the text to import it anyway.</div>
          }
          @if (parsed().errors.length === 0 && build().workouts.length === 0 && !build().skipped.length && !build().notes.length) {
            <div class="card quiet">Nothing to import yet.</div>
          }

          <button class="btn is-block go" [disabled]="busy() || build().workouts.length === 0" (click)="run()">
            {{ build().workouts.length ? 'Import ' + pluralise(build().workouts.length, 'workout') : 'Nothing to import' }}
          </button>
          @if (parsed().errors.length && build().workouts.length) { <div class="hint">Workouts with a problem are left out.</div> }
        }
      </div>
    </div>
  `,
  styles: `
    .grow { flex: 1; min-width: 0; }
    .paste { width: 100%; box-sizing: border-box; resize: vertical; background: var(--surface); border: 1px solid var(--line-strong); border-radius: var(--r-list); padding: 14px; font: 500 13px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--ink); }
    .paste:focus { outline: 0; border: 2px solid var(--ink); padding: 13px; }
    .quiet { font: 500 13.5px/1.45 var(--font); color: var(--ink-3); background: var(--surface-muted); border-color: var(--line-muted); }
    .problem { font: 600 13.5px/1.45 var(--font); color: var(--danger); background: var(--danger-tint); border-color: var(--danger-tint); }
    .warn { font: 500 13px/1.45 var(--font); color: var(--ink-3); background: var(--fill); }
    .actions { display: flex; flex-direction: column; gap: 10px; }
    .wo { padding: 16px; border-radius: var(--r-list); }
    .wn { font: 800 16px/1.2 var(--font); color: var(--ink); }
    .wm { font: 500 12px/1.3 var(--font); color: var(--ink-4); margin-top: 3px; }
    .ex { margin-top: 14px; }
    .en { font: 700 13.5px/1.2 var(--font); color: var(--ink-2); margin-bottom: 8px; }
    .new { font: 700 11px/1 var(--font); color: var(--sage-ink-2); background: var(--sage-tint); border-radius: 6px; padding: 3px 6px; margin-left: 6px; }
    .tags { display: flex; flex-wrap: wrap; gap: 7px; }
    .go { margin-top: 16px; }
    .hint { font: 500 12.5px/1.4 var(--font); color: var(--ink-4); margin-top: 10px; text-align: center; }
  `,
})
export class ImportScreen {
  readonly store = inject(AppStore);
  private router = inject(Router);
  private location = inject(Location);

  readonly text = signal('');
  readonly busy = signal(false);
  readonly copied = signal<'prompt' | null>(null);
  readonly prompt = IMPORT_FORMAT_PROMPT;
  readonly example = EXAMPLE_CSV;
  readonly pluralise = pluralise;

  readonly parsed = computed(() => parseImport(this.text()));
  /** Same merge the import will do, with throwaway ids, for the preview. */
  readonly build = computed(() => {
    let n = 0;
    return buildImport(this.parsed().workouts, this.store.exercises(), this.store.workouts(), () => `preview-${n++}`);
  });
  private newNames = computed(() => new Set(this.build().newExercises.map((x) => x.toLowerCase())));

  val(e: Event) { return (e.target as HTMLTextAreaElement).value; }
  isNew(name: string) { return this.newNames().has(name.toLowerCase()); }
  target = formatTarget;

  async copy(value: string, which: 'prompt') {
    try {
      await navigator.clipboard.writeText(value);
      this.copied.set(which);
      setTimeout(() => this.copied.set(null), 2000);
    } catch {
      this.text.set(value);
    }
  }

  async run() {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const build = buildImport(this.parsed().workouts, this.store.exercises(), this.store.workouts(), () => crypto.randomUUID());
      if (await this.store.importWorkouts(build)) void this.router.navigate(['/workouts']);
    } finally {
      this.busy.set(false);
    }
  }

  back() { history.length > 1 ? this.location.back() : void this.router.navigate(['/you']); }
}
