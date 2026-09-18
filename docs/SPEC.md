# Goalbud — Product Spec

Outcome of a design interview on 2026-09-15. This is the shared understanding
to build from. Change this file when the product changes.

## 1. What it is

Goalbud is a mobile PWA for tracking personal goals and workouts. It started as
a workout tracker and grew into a goal tracker; workouts are the heart of the
app, goals are the broader frame.

- **Users:** Daniel and his wife for now. Signup is open so others can join.
- **Isolation:** each user sees only their own data. No sharing, no social
  features, no shared goals. "Bud" is a name, not a feature.
- **Values:** simple, flexible, light. Helps you keep track, never shames.
- **Device:** Android phones, installed as a PWA.

## 2. No-shame rules

These are hard rules, not tone guidance. Every screen must pass them.

- No streak counters. Nothing ever "resets".
- No red marks, no "missed", "overdue", "incomplete", or "failed" anywhere.
- No completion percentages. Show counts of what was done, never what wasn't.
  A weekly goal with 2 of 3 done shows "2 this week".
- Undone days render as empty, not coloured.
- **Skip today:** the user can dismiss a goal for today. Show a kind message
  ("Life happens. You can pick it up later."). A skip does not count toward
  any target. On history it renders as a neutral dash, not a colour.
- **Pause:** a paused goal disappears from Today. Paused dates render blank,
  exactly like days before the goal existed.
- **Edits** to a target or schedule apply from the current week forward. Past
  weeks keep the target they had.
- **Archive is the default exit.** Goals, exercises, and workouts are archived,
  not deleted: history and session links survive, and they can come back.
- **Delete is permanent and explicit.** It sits behind a confirmation that
  names what goes and what stays. Deleting a goal takes its logged days with
  it; goals inside a deleted long goal survive on their own. Deleting an
  exercise or a workout never rewrites a past session, which keeps its own
  snapshot of names and sets.
- **Notifications** list what is open today, never what was missed.
- A workout session that was left open still counts. It is never labelled
  incomplete.

## 3. Goal shapes

Four shapes. All are tap-done in v1; no quantities are typed.

### 3.1 Scheduled goal
A recurrence rule decides which days it is due.
- Rules supported in v1: **every day**, **every N days** (anchored to the
  start date), **chosen weekdays**.
- Not in v1: every N weeks on given days, monthly on a date.
- Appears on Today only on due days.
- Logging on an off day is allowed and shows as done that day. No "bonus"
  label, no different colour.

### 3.2 Weekly count goal
"N times per week", no fixed days.
- Appears on Today every day with a "+1" action and the count so far.
- Week starts Monday.
- A day can contribute at most one tick.

### 3.3 Untargeted log
Tap whenever. No target, no schedule. History is just the days it was tapped.

### 3.4 Long goal
A container with a target date ("finish the painting by October").
- Lives on the Goals tab, not on Today.
- Children are goals of any of the three shapes above ("paint 30 min", daily).
  Children appear on Today like any goal.
- Done only when the user manually taps it.
- Shows the target date and a count of child completions ("12 sessions so
  far"). Nothing about time remaining, nothing after the date passes.

### 3.5 Common goal fields
- Name.
- Optional colour from a fixed palette of 8. Default colour when unset.
- Optional icon from a curated set of ~30 drawn as part of the design system.
  No icon when unset. No emoji.
- Flag: **exercise goal**. When set, completing a workout session ticks it.
- State: active, paused, archived.

## 4. Workouts

### 4.1 Exercise library
- Per user. Created inline the first time a name is typed in a workout, then
  reused. No preset library shipped with the app.
- Exercise kind: **reps + weight** or **time-based** (duration).
- Optional default rest time (app default 90 s).
- Optional muscle groups: one primary, any number of secondary. Shown in
  lists and searchable when picking from the library; never required.
- Archived by default. Deleting one removes it from every workout template and
  leaves past sessions untouched.

### 4.2 Workout (template)
- A named list of exercises, each with N sets. For reps exercises a set has
  target reps and weight; for time exercises a set has a target duration.
- Exercises are added from the library (a picker over existing exercises) or
  by typing a new name, which creates the exercise inline.
- Rest time: app default, overridable per workout.
- Editing a workout never touches past sessions.
- Model is exercise-centric (sets per exercise). Round/circuit mode is out of
  v1; circuits can be faked as one set per exercise.

### 4.3 Session (live mode)
- Started from an exercise-flagged goal on Today (pick a workout) or from the
  Workouts tab (pick a workout). Both routes produce the same session.
- Screen shows the planned list. Per set: tick done, edit actual reps/weight
  or duration. Rest timer auto-starts on tick, tap to skip, no sound. Running
  session clock.
- The list is a plan, not an order: any exercise can be tapped and done next
  (a machine may be busy). Finished exercises stay ticked wherever they sit.
- **Every set saves immediately** to the server.
- A session is a **snapshot** of actuals; the workout template is not linked
  by reference for its content.
- Returning to an open session (phone locked, app closed) asks: still going,
  or finished?
- An open session is closed as-is at midnight with whatever was done.
- A session counts for **one** exercise-flagged goal, not all of them. Started
  from a goal on Today, it counts for that goal. Started from the Workouts
  tab, Finish asks which goal it counts for (or none). Closing it ticks that
  goal for the day, once: two sessions in one day still yield one tick.
- A session auto-closed at midnight with no goal counts for the only exercise
  goal there is; with several it counts for none, since there is no way to know.

## 5. History

- **Per goal:** month calendar with filled dots for done days, neutral dash for
  skipped, blank otherwise. Total count of completions.
- **Per exercise:** list of sessions with actuals. A progress chart (top
  weight or total reps over time) is deferred until there is about a month of
  data, because charts on empty data are demoralising.
- No global stats page.

## 6. Reminders

- One daily push notification per user at a time they choose.
- **Off by default.** Enabled only when the user sets a time on the You tab.
- Fires only if something is due today and still open. Silent if nothing is
  due or everything is done.
- Message lists what is open ("You have 3 goals today: Read, Walk, Push day").
  Never mentions what was missed.
- Delivered by a Supabase scheduled function (pg_cron) calling Web Push with
  VAPID keys. The browser cannot schedule notifications on its own.

## 7. Screens

Four bottom tabs.

- **Today:** every due or active goal as a card. Scheduled goals show a done
  toggle. Weekly goals show "N this week" and "+1". Untargeted goals show a
  tap-to-log. Exercise goals open a workout picker on tap. Long-goal children
  appear like any goal. Skip is available per card.
- **Goals:** all goals grouped by state (active, paused), long goals with their
  children, archive access. Create and edit goals here. Tap a goal for its
  calendar history.
- **Workouts:** workout templates, exercise library, start a session. Tap an
  exercise for its session history.
- **You:** account, reminder time, archive, sign out.

No typing after setup on the Today screen. Setup and editing happen in Goals
and Workouts.

## 8. Stack

- **Frontend:** Angular, latest version, standalone components, signals,
  zoneless if the version supports it cleanly. No NgModules.
- **Design system:** built in-house, plain CSS with custom properties. No
  Tailwind, no Material. Designed after this spec, using it as the brief.
- **Backend:** Supabase. Postgres with row-level security keyed on
  `auth.uid()`, auth with email/password and Google, scheduled edge function
  for push.
- **Connectivity:** online-only. No offline layer, no local-first sync. Show a
  visible "offline, try again" state on failed writes. Offline is a possible
  later addition once the pain points are known.
- **Hosting:** Cloudflare Pages, deploying from `main`.
- **Environments:** Supabase CLI locally for development, migrations checked
  into the repo, one hosted Supabase project for production.
- **Repo:** single repo, Angular app at root, `supabase/` folder alongside.
- **Dates:** week starts Monday. "Today" is device local time. Dates are
  stored as plain local date strings (`YYYY-MM-DD`), never as UTC timestamps.

## 9. Build order

1. **Goals.** Auth, the four goal shapes, Today, Goals tab, per-goal history,
   skip, pause, archive. Usable daily by both users at the end of this step.
2. **Workouts.** Exercise library, workout templates, live session mode,
   session history, goal linking.
3. **Reminders.** Push subscription, reminder time on the You tab, scheduled
   function.
4. Later, only if needed: exercise progress charts, offline support, more
   recurrence rules, circuits.

## 10. Explicitly out of v1

- Any shared or social feature between users.
- Quantities typed per log ("ran 5 km"). Targets live in the goal name.
- Deadlines with countdowns or overdue states.
- Streaks, percentages, red marks.
- Offline / local-first sync.
- Preset exercise library.
- Circuit or round-based workouts.
- Rest timer sounds.
- Per-goal reminder times.
- Global stats page.
- Every-N-weeks and monthly recurrence.
