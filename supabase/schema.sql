create table if not exists public.training_sessions (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  type text not null,
  title text not null,
  score integer not null,
  duration_minutes integer not null,
  rpe integer not null,
  load_kg integer,
  route_points jsonb,
  completed_at timestamptz,
  inserted_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.training_sessions
add column if not exists completed_at timestamptz;

create table if not exists public.squad_members (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null,
  email text,
  group_id text not null,
  readiness integer not null,
  compliance integer not null,
  risk text not null,
  load integer not null,
  invite_status text,
  assignment text,
  inserted_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.training_sessions enable row level security;
alter table public.squad_members enable row level security;

alter table public.squad_members
add column if not exists gym_name text,
add column if not exists ghost_mode boolean default false,
add column if not exists streak_days integer default 0,
add column if not exists weekly_volume integer default 0,
add column if not exists last_workout_title text,
add column if not exists last_workout_at timestamptz,
add column if not exists last_workout_note text,
add column if not exists hype_count integer default 0;

create policy "training sessions are private to owner"
on public.training_sessions
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "squad members are private to owner"
on public.squad_members
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
