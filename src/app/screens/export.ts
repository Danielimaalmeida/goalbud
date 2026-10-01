import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { buildWorkoutExport, EXPORT_RANGES, type ExportRange, sessionsToExport } from '../core/export';
import { pluralise } from '../core/goals';
import { AppStore } from '../core/store';

/**
 * Turns the workout history into plain text to paste into an LLM, with a
 * range and an optional single workout. Nothing leaves the device unless the
 * person copies or downloads it.
 */
@Component({
  selector: 'app-export',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="screen">
      <header class="detail-head">
        <button class="back" (click)="back()" aria-label="Back">‹</button>
        <div class="grow"><div class="title">Export workouts</div><div class="sub">As text, ready to paste into an LLM</div></div>
      </header>
      <div class="screen-body">
        <div class="eyebrow">Range</div>
        <div class="chips">
          @for (r of ranges; track r.id) {
            <button class="chip" [class.is-on]="range() === r.id" (click)="range.set(r.id)">{{ r.label }}</button>
          }
        </div>

        <div class="eyebrow">Workouts</div>
        <div class="chips">
          <button class="chip" [class.is-on]="workoutId() === null" (click)="workoutId.set(null)">All</button>
          @for (w of store.workouts(); track w.id) {
            <button class="chip" [class.is-on]="workoutId() === w.id" (click)="workoutId.set(w.id)">{{ w.name }}</button>
          }
        </div>

        <div class="eyebrow">Preview · {{ pluralise(count(), 'session') }}</div>
        <textarea class="preview" readonly rows="14" [value]="text()" aria-label="Exported workouts" (focus)="selectAll($event)"></textarea>

        <div class="actions">
          <button class="btn is-block" (click)="copy()">{{ copied() ? 'Copied' : 'Copy text' }}</button>
          <button class="btn is-block is-soft" (click)="download()">Download .txt</button>
        </div>
        @if (failed()) { <div class="note">Could not copy. Tap the text above, select all and copy by hand.</div> }
      </div>
    </div>
  `,
  styles: `
    .grow { flex: 1; min-width: 0; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 2px; }
    .chip { font: 700 13px/1 var(--font); color: var(--ink-2); background: var(--fill); border-radius: var(--r-pill); padding: 11px 14px; }
    .chip.is-on { background: var(--sage); color: #fff; font-weight: 800; }
    .preview { width: 100%; box-sizing: border-box; resize: vertical; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-list); padding: 14px; font: 500 12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--ink-2); }
    .actions { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }
    .note { font: 500 12.5px/1.4 var(--font); color: var(--ink-4); margin-top: 12px; }
  `,
})
export class ExportScreen {
  readonly store = inject(AppStore);
  private router = inject(Router);
  private location = inject(Location);

  /** Optional `?workout=<id>` from a workout's own page. */
  readonly workout = input<string | undefined>();

  readonly ranges = EXPORT_RANGES;
  readonly range = signal<ExportRange>('12w');
  readonly workoutId = signal<string | null>(null);
  readonly copied = signal(false);
  readonly failed = signal(false);
  readonly pluralise = pluralise;

  private args = computed(() => ({
    workouts: this.store.workouts(),
    exercises: this.store.exercises(),
    sessions: this.store.sessions(),
    today: this.store.today(),
    range: this.range(),
    workoutId: this.workoutId(),
  }));
  readonly text = computed(() => buildWorkoutExport(this.args()));
  readonly count = computed(() => sessionsToExport(this.args()).length);

  constructor() {
    queueMicrotask(() => {
      const id = this.workout();
      if (id && this.store.workouts().some((w) => w.id === id)) this.workoutId.set(id);
    });
  }

  selectAll(e: Event) { (e.target as HTMLTextAreaElement).select(); }

  async copy() {
    this.failed.set(false);
    try {
      await navigator.clipboard.writeText(this.text());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      this.failed.set(true);
    }
  }

  download() {
    const url = URL.createObjectURL(new Blob([this.text()], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `goalbud-workouts-${this.store.today()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  back() { history.length > 1 ? this.location.back() : void this.router.navigate(['/you']); }
}
