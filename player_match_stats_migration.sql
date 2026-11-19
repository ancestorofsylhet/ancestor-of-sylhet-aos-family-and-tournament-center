-- AOS Tournament Center: Player Match Statistics
-- Run this script once in Supabase SQL Editor.
create table if not exists public.player_match_stats (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  goals integer not null default 0 check (goals >= 0),
  assists integer not null default 0 check (assists >= 0),
  is_motm boolean not null default false,
  played_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (match_id, player_id)
);

alter table public.player_match_stats enable row level security;

drop policy if exists "Public can view player match stats" on public.player_match_stats;
create policy "Public can view player match stats"
on public.player_match_stats for select
to anon, authenticated
using (true);

drop policy if exists "Admins can insert player match stats" on public.player_match_stats;
create policy "Admins can insert player match stats"
on public.player_match_stats for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and lower(coalesce(p.role,'')) in ('admin','moderator')
  )
);

drop policy if exists "Admins can update player match stats" on public.player_match_stats;
create policy "Admins can update player match stats"
on public.player_match_stats for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and lower(coalesce(p.role,'')) in ('admin','moderator')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and lower(coalesce(p.role,'')) in ('admin','moderator')
  )
);

drop policy if exists "Admins can delete player match stats" on public.player_match_stats;
create policy "Admins can delete player match stats"
on public.player_match_stats for delete
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and lower(coalesce(p.role,'')) in ('admin','moderator')
  )
);

create index if not exists player_match_stats_player_idx on public.player_match_stats(player_id);
create index if not exists player_match_stats_tournament_idx on public.player_match_stats(tournament_id);
create index if not exists player_match_stats_match_idx on public.player_match_stats(match_id);
