import { ChangeDetectionStrategy, Component, output } from '@angular/core';

/** Bottom sheet with scrim. Content is projected. */
@Component({
  selector: 'app-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="scrim" (click)="close.emit()"></div>
    <div class="sheet" role="dialog" aria-modal="true">
      <div class="grip"></div>
      <ng-content />
    </div>
  `,
})
export class Sheet {
  readonly close = output<void>();
}
