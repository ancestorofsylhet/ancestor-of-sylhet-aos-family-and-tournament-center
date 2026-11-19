-- AOS Tournament Center: Main Admin-only Management Control Panel
-- Run this script once in Supabase SQL Editor.

create table if not exists public.management_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  position text not null,
  department text not null default '',
  photo_url text,
  responsibilities text not null default '',
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.management_members enable row level security;

drop policy if exists "Public can view active management members" on public.management_members;
create policy "Public can view active management members"
on public.management_members
for select
to anon, authenticated
using (is_active = true or exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and lower(coalesce(p.role,'')) = 'admin'
));

drop policy if exists "Main admins can insert management members" on public.management_members;
create policy "Main admins can insert management members"
on public.management_members
for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and lower(coalesce(p.role,'')) = 'admin'
  )
);

drop policy if exists "Main admins can update management members" on public.management_members;
create policy "Main admins can update management members"
on public.management_members
for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and lower(coalesce(p.role,'')) = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and lower(coalesce(p.role,'')) = 'admin'
  )
);

drop policy if exists "Main admins can delete management members" on public.management_members;
create policy "Main admins can delete management members"
on public.management_members
for delete
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and lower(coalesce(p.role,'')) = 'admin'
  )
);

grant select on public.management_members to anon, authenticated;
grant insert, update, delete on public.management_members to authenticated;

create index if not exists management_members_display_order_idx
on public.management_members(display_order, created_at);
