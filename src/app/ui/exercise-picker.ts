import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { exerciseMeta, matchesQuery } from '../core/exercises';
import type { Exercise } from '../core/model';
import { AppStore } from '../core/store';
import { Sheet } from './sheet';

/**
 * "Add one of your exercises." A sheet over the library, searchable by name
 * or muscle group. Exercises already in the list being edited are left out.
 */
@Component({
  selector: 'app-exercise-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Sheet],
  template: `
    <app-sheet (close)="close.emit()">
      <div class="title">Your exercises</div>
      <div class="sub">Tap one to add it.</div>
      <label class="field search">
        <input [value]="query()" (input)="query.set(v($event))" placeholder="Search by name or muscle…" autocomplete="off" autofocus />
      </label>
      @if (rows().length) {
        <div class="list">
          @for (e of rows(); track e.id) {
            <button class="row" (click)="pick.emit(e)">
              <span class="grow"><span class="name">{{ e.name }}</span><span class="meta">{{ meta(e) }}</span></span>
              <span class="plus">+</span>
            </button>
          }
        </div>
      } @else if (query().trim()) {
        <div class="card quiet">Nothing matches "{{ query().trim() }}". Type it into the workout to create it.</div>
      } @else {
        <div class="card quiet">Every exercise in your library is already in this list.</div>
      }
    </app-sheet>
  `,
  styles: `
    .search { margin-bottom: 12px; padding: 12px 16px; }
    .search:focus-within { padding: 11px 15px; }
    .search input { font-size: 16px; }
    .grow { flex: 1; min-width: 0; }
    .plus { width: 32px; height: 32px; border-radius: 10px; background: var(--sage-tint); color: var(--sage); font: 800 18px/1 var(--font); display: flex; align-items: center; justify-content: center; flex: none; }
    .quiet { font: 500 13.5px/1.45 var(--font); color: var(--ink-3); background: var(--surface-muted); border-color: var(--line-muted); }
  `,
})
export class ExercisePicker {
  readonly store = inject(AppStore);
  /** Exercise ids to leave out: the ones already in the list being edited. */
  readonly exclude = input<string[]>([]);
  readonly pick = output<Exercise>();
  readonly close = output<void>();
  readonly query = signal('');
  readonly meta = exerciseMeta;

  readonly rows = computed(() => {
    const used = new Set(this.exclude());
    return this.store.activeExercises()
      .filter((e) => !used.has(e.id) && matchesQuery(e, this.query()))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  v(e: Event) { return (e.target as HTMLInputElement).value; }
}
