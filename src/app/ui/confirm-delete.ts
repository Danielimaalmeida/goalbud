import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Sheet } from './sheet';

/**
 * The one gate in front of a permanent delete. It always names what is going
 * and what survives, so the choice is made with the consequence in view.
 */
@Component({
  selector: 'app-confirm-delete',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Sheet],
  template: `
    <app-sheet (close)="cancelled.emit()">
      <div class="title">Delete {{ name() }}?</div>
      <div class="sub">{{ detail() }}</div>
      <div class="opts">
        <button class="btn is-block is-danger" (click)="confirmed.emit()">Delete permanently</button>
        <button class="btn is-block is-soft" (click)="cancelled.emit()">Keep it</button>
      </div>
    </app-sheet>
  `,
  styles: `.opts { display: flex; flex-direction: column; gap: 10px; }`,
})
export class ConfirmDelete {
  readonly name = input.required<string>();
  /** What goes, what stays. Ends with "This cannot be undone." */
  readonly detail = input.required<string>();
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();
}
