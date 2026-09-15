import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { type CanActivateFn, Router, type Routes } from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';
import { AUTH } from './core/auth';
import { AppStore } from './core/store';

const signedIn: CanActivateFn = async () => {
  const auth = inject(AUTH);
  const router = inject(Router);
  const user = await firstValueFrom(toObservable(auth.user).pipe(filter((u) => u !== undefined)));
  return user ? true : router.createUrlTree(['/sign-in']);
};

/** Screens outside the tab shell need the data too. Errors fall back to the shell's retry UI. */
const dataLoaded: CanActivateFn = async () => {
  const store = inject(AppStore);
  const router = inject(Router);
  await store.load();
  return store.loaded() ? true : router.createUrlTree(['/today']);
};

const signedOut: CanActivateFn = async () => {
  const auth = inject(AUTH);
  const router = inject(Router);
  const user = await firstValueFrom(toObservable(auth.user).pipe(filter((u) => u !== undefined)));
  return user ? router.createUrlTree(['/today']) : true;
};

export const app_routes: Routes = [
  { path: 'sign-in', canActivate: [signedOut], loadComponent: () => import('./screens/sign-in').then((m) => m.SignInScreen) },
  {
    path: '',
    canActivate: [signedIn],
    loadComponent: () => import('./screens/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'today' },
      { path: 'today', loadComponent: () => import('./screens/today').then((m) => m.TodayScreen) },
      { path: 'goals', loadComponent: () => import('./screens/goals').then((m) => m.GoalsScreen) },
      { path: 'workouts', loadComponent: () => import('./screens/workouts').then((m) => m.WorkoutsScreen) },
      { path: 'you', loadComponent: () => import('./screens/you').then((m) => m.YouScreen) },
    ],
  },
  { path: 'goals/new', canActivate: [signedIn, dataLoaded], loadComponent: () => import('./screens/goal-editor').then((m) => m.GoalEditorScreen) },
  { path: 'goals/:id', canActivate: [signedIn, dataLoaded], loadComponent: () => import('./screens/goal-detail').then((m) => m.GoalDetailScreen) },
  { path: 'goals/:id/edit', canActivate: [signedIn, dataLoaded], loadComponent: () => import('./screens/goal-editor').then((m) => m.GoalEditorScreen) },
  { path: 'workouts/new', canActivate: [signedIn, dataLoaded], loadComponent: () => import('./screens/workout-editor').then((m) => m.WorkoutEditorScreen) },
  { path: 'workouts/:id/edit', canActivate: [signedIn, dataLoaded], loadComponent: () => import('./screens/workout-editor').then((m) => m.WorkoutEditorScreen) },
  { path: 'exercises', canActivate: [signedIn, dataLoaded], loadComponent: () => import('./screens/exercises').then((m) => m.ExercisesScreen) },
  { path: 'exercises/:id', canActivate: [signedIn, dataLoaded], loadComponent: () => import('./screens/exercise-detail').then((m) => m.ExerciseDetailScreen) },
  { path: 'session/:id', canActivate: [signedIn, dataLoaded], loadComponent: () => import('./screens/session').then((m) => m.SessionScreen) },
  { path: 'archive', canActivate: [signedIn, dataLoaded], loadComponent: () => import('./screens/archive').then((m) => m.ArchiveScreen) },
  { path: '**', redirectTo: 'today' },
];
