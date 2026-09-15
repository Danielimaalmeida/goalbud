-- Goalbud schema. Every table is per-user; RLS keyed on auth.uid().
-- Dates are plain local dates (YYYY-MM-DD), never UTC timestamps.
-- Nothing is ever deleted: goals, exercises and workouts are archived.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  email text not null default '',
  reminder_time time null,            -- null = reminder off (the default)
  created_at timestamptz not null default now()
);

create table public.goals (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  shape text not null check (shape in ('scheduled', 'weekly', 'log', 'long')),
  colour text null check (colour in ('sage', 'teal', 'blue', 'purple', 'rose', 'rust', 'gold', 'stone')),
  icon text null,
  is_exercise boolean not null default false,
  state text not null default 'active' check (state in ('active', 'paused', 'archived')),
  parent_id uuid null references public.goals (id),
  schedule jsonb not null default '[]'::jsonb,   -- [{from: 'YYYY-MM-DD' (a Monday), recurrence?, timesPerWeek?}]
  pauses jsonb not null default '[]'::jsonb,     -- [{from, to|null}]
  target_date date null,
  completed_on date null,
  created_on date not null,
  archived_on date null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index goals_user_idx on public.goals (user_id);

create table public.goal_entries (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_id uuid not null references public.goals (id),
  date date not null,
  kind text not null check (kind in ('done', 'skip')),
  logged_at timestamptz not null default now(),
  unique (goal_id, date)                         -- a day contributes at most one tick
);
create index goal_entries_user_idx on public.goal_entries (user_id, goal_id);

create table public.exercises (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('reps', 'time')),
  rest_seconds integer null,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index exercises_user_idx on public.exercises (user_id);

create table public.workouts (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  rest_seconds integer null,
  exercises jsonb not null default '[]'::jsonb,  -- [{exerciseId, sets: [{reps, weight, seconds}]}]
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workouts_user_idx on public.workouts (user_id);

create table public.sessions (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  workout_id uuid null references public.workouts (id),
  workout_name text not null,
  date date not null,
  started_at timestamptz not null,
  ended_at timestamptz null,
  closed_by text null check (closed_by in ('user', 'midnight')),
  exercises jsonb not null default '[]'::jsonb   -- snapshot of actuals, never linked to the template
);
create index sessions_user_idx on public.sessions (user_id, date desc);

-- Reminders (build step 3): one push subscription per device.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  keys jsonb not null,
  created_at timestamptz not null default now()
);

-- updated_at maintenance
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger goals_touch before update on public.goals for each row execute function public.touch_updated_at();
create trigger workouts_touch before update on public.workouts for each row execute function public.touch_updated_at();

-- Create a profile row for each new auth user.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce(new.email, '')
  )
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Row-level security: each user sees only their own rows.
alter table public.profiles enable row level security;
alter table public.goals enable row level security;
alter table public.goal_entries enable row level security;
alter table public.exercises enable row level security;
alter table public.workouts enable row level security;
alter table public.sessions enable row level security;
alter table public.push_subscriptions enable row level security;

create policy "own profile" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "own goals" on public.goals for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own entries" on public.goal_entries for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own exercises" on public.exercises for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own workouts" on public.workouts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own sessions" on public.sessions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own push subscriptions" on public.push_subscriptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
