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

create table if not exists public.workout_completions (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  member_id text not null,
  member_name text not null,
  group_id text not null,
  completion_type text not null default 'assigned',
  session_kind text not null default 'Workout',
  assignment text not null,
  effort text not null,
  duration_minutes integer not null default 0,
  note text,
  volume integer not null,
  exercises jsonb,
  completed_at timestamptz not null,
  inserted_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.readiness_logs (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  member_id text,
  member_name text,
  group_id text,
  logged_at timestamptz not null,
  sleep_hours integer,
  sleep_quality integer not null,
  soreness integer not null,
  stress integer,
  pain integer,
  hydration text not null,
  mood integer,
  illness integer,
  pain_area text,
  limits_training boolean,
  resting_hr integer,
  hrv integer,
  inserted_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.training_sessions enable row level security;
alter table public.squad_members enable row level security;
alter table public.workout_completions enable row level security;
alter table public.readiness_logs enable row level security;

alter table public.squad_members
add column if not exists gym_name text,
add column if not exists pinned_exercise_ids jsonb,
add column if not exists ghost_mode boolean default false,
add column if not exists streak_days integer default 0,
add column if not exists weekly_volume integer default 0,
add column if not exists last_workout_title text,
add column if not exists last_workout_at timestamptz,
add column if not exists last_workout_note text,
add column if not exists hype_count integer default 0,
add column if not exists device_sync_provider text,
add column if not exists device_sync_status text,
add column if not exists device_connected_at timestamptz,
add column if not exists device_last_sync_at timestamptz,
add column if not exists imported_sleep_hours integer,
add column if not exists imported_resting_hr integer,
add column if not exists imported_hrv integer;

alter table public.workout_completions
add column if not exists completion_type text default 'assigned',
add column if not exists session_kind text default 'Workout',
add column if not exists duration_minutes integer default 0,
add column if not exists exercises jsonb;

alter table public.readiness_logs
add column if not exists member_id text,
add column if not exists member_name text,
add column if not exists group_id text,
add column if not exists sleep_hours integer,
add column if not exists stress integer,
add column if not exists pain integer,
add column if not exists mood integer,
add column if not exists illness integer,
add column if not exists pain_area text,
add column if not exists limits_training boolean,
add column if not exists resting_hr integer,
add column if not exists hrv integer;

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

create policy "workout completions are private to owner"
on public.workout_completions
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "readiness logs are private to owner"
on public.readiness_logs
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
