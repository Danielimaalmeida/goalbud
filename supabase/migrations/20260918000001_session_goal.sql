-- A session counts for one exercise goal, not every one. Null = counts for none.
-- Deleting the goal keeps the session and just drops the link.
alter table public.sessions
  add column goal_id uuid null references public.goals (id) on delete set null;
