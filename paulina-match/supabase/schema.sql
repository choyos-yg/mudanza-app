-- Paulina Match - Esquema de base de datos
-- Pega este archivo completo en Supabase > SQL Editor y ejecuta.

-- =========================================================================
-- Tablas
-- =========================================================================

-- Perfil profundo (una fila por usuaria)
create table if not exists public.user_profile (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  age int,
  location text,
  onboarding_status text not null default 'not_started',
  -- Estructurado por Claude al terminar el onboarding
  values_core jsonb,
  relationship_goals jsonb,
  dealbreakers jsonb,
  green_flags jsonb,
  past_patterns jsonb,
  communication_style jsonb,
  life_stage jsonb,
  share_card_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Historial del chat de onboarding
create table if not exists public.onboarding_messages (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_onboarding_messages_user_created
  on public.onboarding_messages (user_id, created_at);

-- Fichas de candidatos (fase 2)
create table if not exists public.candidates (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  how_met text,
  age int,
  notes text,
  photos text[],
  compatibility_score int,
  green_flags jsonb,
  red_flags jsonb,
  status text not null default 'active' check (status in ('active', 'dating', 'paused', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Citas y reflexiones (fase 2)
create table if not exists public.dates (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  candidate_id bigint references public.candidates(id) on delete cascade,
  date_on date,
  place text,
  notes text,
  reflection jsonb,
  mood_before text,
  mood_after text,
  created_at timestamptz not null default now()
);

-- Patrones detectados por Claude (fase 3)
create table if not exists public.patterns (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  pattern_text text not null,
  evidence jsonb,
  created_at timestamptz not null default now()
);

-- =========================================================================
-- Row Level Security: cada usuaria solo ve lo suyo
-- =========================================================================

alter table public.user_profile enable row level security;
alter table public.onboarding_messages enable row level security;
alter table public.candidates enable row level security;
alter table public.dates enable row level security;
alter table public.patterns enable row level security;

drop policy if exists users_own_profile on public.user_profile;
create policy users_own_profile on public.user_profile
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists users_own_messages on public.onboarding_messages;
create policy users_own_messages on public.onboarding_messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists users_own_candidates on public.candidates;
create policy users_own_candidates on public.candidates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists users_own_dates on public.dates;
create policy users_own_dates on public.dates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists users_own_patterns on public.patterns;
create policy users_own_patterns on public.patterns
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =========================================================================
-- Trigger para crear user_profile vacío al registrarse
-- =========================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profile (user_id, onboarding_status)
  values (new.id, 'not_started')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
