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
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.training_sessions
add column if not exists completed_at timestamptz,
add column if not exists updated_at timestamptz not null default now();

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
  updated_at timestamptz not null default now(),
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
  updated_at timestamptz not null default now(),
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
  updated_at timestamptz not null default now(),
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
add column if not exists imported_hrv integer,
add column if not exists assignment_session jsonb,
add column if not exists updated_at timestamptz not null default now();

alter table public.workout_completions
add column if not exists completion_type text default 'assigned',
add column if not exists session_kind text default 'Workout',
add column if not exists duration_minutes integer default 0,
add column if not exists exercises jsonb,
add column if not exists updated_at timestamptz not null default now();

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
add column if not exists hrv integer,
add column if not exists updated_at timestamptz not null default now();

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

-- Production squad foundation -------------------------------------------------
-- These tables sit beside the current local-first owner tables. They support
-- secure invites, coach/member roles, assignments, completions, team activity,
-- and member privacy without removing the prototype sync path above.

create extension if not exists pgcrypto;

create table if not exists public.squads (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  focus text,
  target_readiness integer not null default 75,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.squad_memberships (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid not null references public.squads(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  display_name text not null,
  gym_name text,
  email text,
  role text not null check (role in ('owner', 'coach', 'member')),
  status text not null default 'active' check (status in ('invited', 'active', 'removed')),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (squad_id, user_id)
);

create table if not exists public.member_invites (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid not null references public.squads(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  email text,
  display_name text,
  gym_name text,
  role text not null default 'member' check (role in ('coach', 'member')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid not null references public.squads(id) on delete cascade,
  assigned_by uuid not null references auth.users(id) on delete cascade,
  assignee_membership_id uuid references public.squad_memberships(id) on delete cascade,
  group_id text,
  title text not null,
  session_kind text not null,
  coach_note text,
  status text not null default 'assigned' check (status in ('draft', 'assigned', 'completed', 'archived')),
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assignment_exercises (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  exercise_id text,
  name text not null,
  dose text not null,
  coach_pinned boolean not null default false,
  prescribed jsonb,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.workout_completions
add column if not exists squad_id uuid references public.squads(id) on delete cascade,
add column if not exists assignment_id uuid references public.assignments(id) on delete set null,
add column if not exists membership_id uuid references public.squad_memberships(id) on delete set null;

create table if not exists public.team_activity (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid not null references public.squads(id) on delete cascade,
  actor_membership_id uuid references public.squad_memberships(id) on delete set null,
  activity_type text not null check (activity_type in ('assignment_created', 'workout_completed', 'readiness_logged', 'note_added', 'privacy_changed')),
  title text not null,
  body text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.member_privacy_settings (
  membership_id uuid primary key references public.squad_memberships(id) on delete cascade,
  ghost_mode boolean not null default false,
  show_readiness_to_team boolean not null default false,
  show_activity_to_team boolean not null default true,
  share_location_during_ruck boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.squads enable row level security;
alter table public.squad_memberships enable row level security;
alter table public.member_invites enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_exercises enable row level security;
alter table public.team_activity enable row level security;
alter table public.member_privacy_settings enable row level security;

create or replace function public.is_squad_member(target_squad_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.squad_memberships sm
    where sm.squad_id = target_squad_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
  );
$$;

create or replace function public.is_squad_coach(target_squad_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.squad_memberships sm
    where sm.squad_id = target_squad_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role in ('owner', 'coach')
  );
$$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'squads' and policyname = 'squad members can read squads') then
    create policy "squad members can read squads"
    on public.squads for select
    using (owner_user_id = auth.uid() or public.is_squad_member(id));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'squads' and policyname = 'owners can manage squads') then
    create policy "owners can manage squads"
    on public.squads for all
    using (owner_user_id = auth.uid())
    with check (owner_user_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'squad_memberships' and policyname = 'squad members can read memberships') then
    create policy "squad members can read memberships"
    on public.squad_memberships for select
    using (public.is_squad_member(squad_id));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'squad_memberships' and policyname = 'coaches can manage memberships') then
    create policy "coaches can manage memberships"
    on public.squad_memberships for all
    using (public.is_squad_coach(squad_id))
    with check (public.is_squad_coach(squad_id));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'member_invites' and policyname = 'coaches can manage invites') then
    create policy "coaches can manage invites"
    on public.member_invites for all
    using (public.is_squad_coach(squad_id))
    with check (public.is_squad_coach(squad_id));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'assignments' and policyname = 'members read assigned work') then
    create policy "members read assigned work"
    on public.assignments for select
    using (
      public.is_squad_coach(squad_id)
      or assignee_membership_id in (
        select id from public.squad_memberships where user_id = auth.uid() and status = 'active'
      )
    );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'assignments' and policyname = 'coaches manage assignments') then
    create policy "coaches manage assignments"
    on public.assignments for all
    using (public.is_squad_coach(squad_id))
    with check (public.is_squad_coach(squad_id));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'assignment_exercises' and policyname = 'members read assignment exercises') then
    create policy "members read assignment exercises"
    on public.assignment_exercises for select
    using (exists (
      select 1 from public.assignments a
      where a.id = assignment_id
        and (
          public.is_squad_coach(a.squad_id)
          or a.assignee_membership_id in (
            select id from public.squad_memberships where user_id = auth.uid() and status = 'active'
          )
        )
    ));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'assignment_exercises' and policyname = 'coaches manage assignment exercises') then
    create policy "coaches manage assignment exercises"
    on public.assignment_exercises for all
    using (exists (select 1 from public.assignments a where a.id = assignment_id and public.is_squad_coach(a.squad_id)))
    with check (exists (select 1 from public.assignments a where a.id = assignment_id and public.is_squad_coach(a.squad_id)));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'team_activity' and policyname = 'members read team activity') then
    create policy "members read team activity"
    on public.team_activity for select
    using (public.is_squad_member(squad_id));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'team_activity' and policyname = 'members create own activity') then
    create policy "members create own activity"
    on public.team_activity for insert
    with check (public.is_squad_member(squad_id));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'member_privacy_settings' and policyname = 'members read privacy settings') then
    create policy "members read privacy settings"
    on public.member_privacy_settings for select
    using (exists (
      select 1 from public.squad_memberships sm
      where sm.id = membership_id and public.is_squad_member(sm.squad_id)
    ));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'member_privacy_settings' and policyname = 'members update own privacy') then
    create policy "members update own privacy"
    on public.member_privacy_settings for all
    using (exists (
      select 1 from public.squad_memberships sm
      where sm.id = membership_id and sm.user_id = auth.uid() and sm.status = 'active'
    ))
    with check (exists (
      select 1 from public.squad_memberships sm
      where sm.id = membership_id and sm.user_id = auth.uid() and sm.status = 'active'
    ));
  end if;
end $$;
