-- Optional muscle groups on exercises: one primary, any number of secondary.
-- Both default to "not set" so existing rows and the plan loader scripts need no change.
alter table public.exercises
  add column primary_muscle text null check (primary_muscle in (
    'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms',
    'core', 'hips', 'glutes', 'quads', 'hamstrings', 'calves'
  )),
  add column secondary_muscles jsonb not null default '[]'::jsonb;  -- ['triceps', 'shoulders']
