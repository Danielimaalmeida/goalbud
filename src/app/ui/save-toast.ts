import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AppStore } from '../core/store';

/** "Offline, try again" state for failed writes (spec §8). */
@Component({
  selector: 'app-save-toast',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.saveError(); as err) {
      <div class="toast" role="alert">
        <div class="grow">{{ err.message }}</div>
        <button class="btn" (click)="err.retry()">Try again</button>
        <button class="dismiss" (click)="store.saveError.set(null)" aria-label="Dismiss">×</button>
      </div>
    }
  `,
  styles: `.dismiss { color: var(--dark-ink); font: 700 20px/1 var(--font); padding: 0 2px; }`,
})
export class SaveToast {
  readonly store = inject(AppStore);
}
