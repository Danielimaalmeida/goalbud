import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { environment } from '../environments/environment';
import { app_routes } from './app.routes';
import { AUTH } from './core/auth';
import { LocalAuth, LocalRepo } from './core/local-repo';
import { REPO } from './core/repo';
import { SupabaseAuth, SupabaseRepo } from './core/supabase-repo';

const dataProviders = environment.dataMode === 'local'
  ? [LocalAuth, LocalRepo, { provide: AUTH, useExisting: LocalAuth }, { provide: REPO, useExisting: LocalRepo }]
  : [SupabaseAuth, SupabaseRepo, { provide: AUTH, useExisting: SupabaseAuth }, { provide: REPO, useExisting: SupabaseRepo }];

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(app_routes, withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    ...dataProviders,
  ],
};
