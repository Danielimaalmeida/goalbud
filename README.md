# Goalbud

A mobile PWA for tracking personal goals and workouts. Simple, flexible, light.
It helps you keep track and never shames: no streaks, no red, no percentages.

- Product spec: `docs/SPEC.md` (the brief everything is built from)
- Design: `design/mockups/Goalbud Mockups.dc.html` (imported from Claude Design), earlier proposals in `design/proposals/`

## Stack

Angular 22 (standalone, signals, zoneless), plain CSS design system with custom
properties (`src/styles.css`), Supabase (Postgres + RLS + auth) in `supabase/`.
Online-only: failed writes show a "try again" toast.

## Run it locally

Requires Node 22.22.3+ or 24+ (see `.nvmrc`).

```sh
npm install
npm start          # http://localhost:4200
npm test           # vitest via the Angular builder
npm run build      # production bundle in dist/goalbud
```

`npm start` uses **local data mode** (`src/environments/environment.development.ts`):
an in-browser store seeded with demo data, any email and password signs in.
Nothing leaves the browser. This is for working on screens.

## Supabase

```sh
npx supabase start                   # local Postgres + auth at http://127.0.0.1:54321
npx supabase db reset                # applies supabase/migrations
```

Point the app at it by setting `dataMode: 'supabase'` and the anon key in
`environment.development.ts`. For production fill in `src/environments/environment.ts`
with the hosted project's URL and anon key (both public), then link and push:

```sh
npx supabase link --project-ref <ref>
npx supabase db push
```

Google sign-in needs the provider enabled in the Supabase dashboard and
`supabase/config.toml` for local.

## Hosting

Cloudflare Pages, deploying from `main`. Build command `npm run build`, output
directory `dist/goalbud/browser`. Add a `_redirects` rule `/* /index.html 200`
(or a Pages Function) so deep links resolve to the SPA.

## Layout

```
src/app/core      model, dates, goal rules, sessions, store, repo (local + supabase)
src/app/ui        shared pieces: bottom nav, sheet, glyph, save toast
src/app/screens   one file per screen
supabase/         config + migrations
```

Build order (spec §9): 1 goals ✔ · 2 workouts ✔ · 3 reminders (push subscription and
the scheduled function are still to do; the You tab already stores the reminder time).
