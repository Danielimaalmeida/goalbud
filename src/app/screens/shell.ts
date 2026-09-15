import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { formatElapsed } from '../core/dates';
import { AppStore } from '../core/store';
import { BottomNav } from '../ui/bottom-nav';
import { Sheet } from '../ui/sheet';

/** Tabbed shell. Also owns the "still going?" prompt for a session left open. */
@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, BottomNav, Sheet],
  template: `
    @if (store.loadError(); as err) {
      <div class="screen"><div class="empty">
        <div class="title">Couldn't load</div>
        <div class="body">{{ err }}</div>
        <button class="btn" (click)="store.load()">Try again</button>
      </div></div>
    } @else if (!store.loaded()) {
      <div class="screen"><div class="empty"><div class="body">Loading…</div></div></div>
    } @else {
      <router-outlet />
      @if (resumable(); as s) {
        <app-sheet (close)="dismissed.set(true)">
          <div class="title">Still going?</div>
          <div class="sub">{{ s.workoutName }} has been open for {{ elapsed(s.startedAt) }}. Whatever you did already counts.</div>
          <div class="opts">
            <button class="option is-primary" (click)="continueSession(s.id)">
              <div class="grow"><div class="name">Still going</div><div class="meta">Back to the session</div></div><div class="go"></div>
            </button>
            <button class="option" (click)="finish(s.id)">
              <div class="grow"><div class="name">Finished</div><div class="meta">Close it as it is</div></div><div class="chev">›</div>
            </button>
          </div>
        </app-sheet>
      }
    }
    <app-bottom-nav />
  `,
  styles: `.opts { display: flex; flex-direction: column; gap: 10px; } .grow { flex: 1; }`,
})
export class Shell {
  readonly store = inject(AppStore);
  private router = inject(Router);
  readonly dismissed = signal(false);
  readonly resumable = computed(() => {
    const s = this.store.openSession();
    return !this.dismissed() && s && s.date === this.store.today() ? s : null;
  });

  elapsed(iso: string): string {
    const secs = (Date.now() - new Date(iso).getTime()) / 1000;
    return secs < 3600 ? `${Math.max(1, Math.round(secs / 60))} min` : formatElapsed(secs).replace(/:\d\d$/, '') + ' h';
  }
  continueSession(id: string) {
    this.dismissed.set(true);
    void this.router.navigate(['/session', id]);
  }
  async finish(id: string) {
    this.dismissed.set(true);
    await this.store.finishSession(id, 'user');
  }
}
