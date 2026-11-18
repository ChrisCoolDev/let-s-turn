-- Schéma complet Supabase (PostgreSQL + Auth Anonyme + Realtime + RLS)
-- À exécuter dans le SQL Editor de ton projet Supabase.

create extension if not exists "pgcrypto";

-- 1. Profils joueurs (liés à Supabase Anonymous Auth : auth.uid())
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  avatar_id smallint not null default 1,
  color text not null default '#58cc02',
  xp integer not null default 0,
  stars integer not null default 10,
  streak integer not null default 0,
  last_played_date date,
  unlocked_badges jsonb not null default '[]'::jsonb,
  unlocked_themes jsonb not null default '["classic"]'::jsonb,
  active_theme text not null default 'classic',
  push_subscription jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Salons / Parties (temps réel & asynchrone)
create table if not exists public.rooms (
  code text primary key,
  language text not null check (language in ('EN', 'FR')),
  word_length smallint not null check (word_length in (4, 5)),
  mode text not null check (mode in ('coop', 'duel', 'daily')),
  start_word text not null,
  target_word text not null,
  current_word text not null,
  optimal_par integer not null,
  optimal_path jsonb not null default '[]'::jsonb,
  host_player_id uuid not null references public.profiles(id),
  partner_player_id uuid references public.profiles(id),
  current_turn_player_id uuid not null,
  undo_penalty_count integer not null default 0,
  hints_used integer not null default 0,
  status text not null default 'active' check (status in ('active', 'completed')),
  winner_player_id uuid,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

-- 3. Coups joués dans chaque salon (chaîne verticale)
create table if not exists public.moves (
  id uuid primary key default gen_random_uuid(),
  room_code text not null references public.rooms(code) on delete cascade,
  step_number integer not null,
  word text not null,
  previous_word text not null,
  changed_index smallint not null,
  from_char char(1) not null,
  to_char char(1) not null,
  player_id uuid not null references public.profiles(id),
  is_undo_penalty boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_moves_room_code_step on public.moves(room_code, step_number);
create index if not exists idx_rooms_players on public.rooms(host_player_id, partner_player_id);

-- 4. Row Level Security (Auth Anonyme sans friction)
alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.moves enable row level security;

create policy "Profiles readable by authenticated users"
  on public.profiles for select to authenticated using (true);

create policy "Users manage own profile"
  on public.profiles for all to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

create policy "Rooms readable by authenticated users"
  on public.rooms for select to authenticated using (true);

create policy "Authenticated users can create or update rooms they participate in"
  on public.rooms for insert to authenticated
  with check (auth.uid() = host_player_id);

create policy "Participants can update active room"
  on public.rooms for update to authenticated
  using (auth.uid() = host_player_id or auth.uid() = partner_player_id or partner_player_id is null);

create policy "Moves readable by authenticated users"
  on public.moves for select to authenticated using (true);

create policy "Participants can append moves"
  on public.moves for insert to authenticated
  with check (auth.uid() = player_id);

-- 5. Activer Supabase Realtime pour les coups & salons en direct
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.moves;
