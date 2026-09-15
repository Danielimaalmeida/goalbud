import { Component, effect, inject, untracked } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AUTH } from './core/auth';
import { AppStore } from './core/store';
import { SaveToast } from './ui/save-toast';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SaveToast],
  template: `<div class="app"><router-outlet /><app-save-toast /></div>`,
})
export class App {
  private auth = inject(AUTH);
  private store = inject(AppStore);

  constructor() {
    effect(() => {
      const user = this.auth.user();
      untracked(() => {
        if (user) void this.store.load();
        else if (user === null) this.store.reset();
      });
    });
  }
}
