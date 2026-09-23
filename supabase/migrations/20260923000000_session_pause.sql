-- Pausing a live session stops its clock. `paused_at` is set while paused;
-- `paused_seconds` accumulates finished pause spans so elapsed time excludes
-- them. Replaces, it never rewrites, a session snapshot.
alter table public.sessions
  add column paused_at timestamptz null,
  add column paused_seconds double precision not null default 0;
