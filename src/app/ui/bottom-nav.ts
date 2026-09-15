import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-bottom-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav>
      <a routerLink="/today" routerLinkActive="is-on"><span class="ic"><i class="g-today"></i></span><span class="lbl">Today</span></a>
      <a routerLink="/goals" routerLinkActive="is-on"><span class="ic"><i class="g-goals"></i></span><span class="lbl">Goals</span></a>
      <a routerLink="/workouts" routerLinkActive="is-on"><span class="ic"><i class="g-workouts"></i></span><span class="lbl">Workouts</span></a>
      <a routerLink="/you" routerLinkActive="is-on"><span class="ic"><i class="g-you"></i></span><span class="lbl">You</span></a>
    </nav>
  `,
  styles: `
    :host { position: fixed; left: 0; right: 0; bottom: 0; z-index: 10; }
    nav {
      max-width: 480px; margin: 0 auto;
      display: grid; grid-template-columns: repeat(4, 1fr);
      background: var(--surface); border-top: 1px solid var(--line-muted);
      padding: 10px 8px calc(6px + env(safe-area-inset-bottom, 0px));
    }
    a { display: flex; flex-direction: column; align-items: center; gap: 5px; color: var(--ink-3); }
    .ic { width: 58px; height: 32px; border-radius: 999px; display: flex; align-items: center; justify-content: center; color: var(--ink-4); }
    .lbl { font: 600 11px/1 var(--font); }
    a.is-on .ic { background: var(--sage-tint-2); color: var(--sage); }
    a.is-on .lbl { font-weight: 800; color: var(--ink); }
    i { display: block; }
    .g-today { width: 16px; height: 16px; border-radius: 5px; background: currentColor; }
    .g-goals { width: 16px; height: 16px; border-radius: 50%; border: 3px solid currentColor; }
    a.is-on .g-goals { border-width: 4px; }
    .g-workouts { width: 18px; height: 6px; border-radius: 3px; background: currentColor; box-shadow: 0 8px 0 currentColor; margin-top: -8px; }
    .g-you { width: 16px; height: 16px; border-radius: 50% 50% 45% 45%; background: currentColor; }
  `,
})
export class BottomNav {}
