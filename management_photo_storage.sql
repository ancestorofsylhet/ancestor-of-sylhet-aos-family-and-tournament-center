-- AOS Management Member Photos: public display, Main Admin-only uploads
-- Run once in the Supabase SQL Editor.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('management-photos', 'management-photos', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif'];

drop policy if exists "Public can view management photos" on storage.objects;
create policy "Public can view management photos"
on storage.objects for select to public
using (bucket_id = 'management-photos');

drop policy if exists "Main admins can upload management photos" on storage.objects;
create policy "Main admins can upload management photos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'management-photos'
  and exists (select 1 from public.profiles p where p.id = auth.uid() and lower(coalesce(p.role,'')) = 'admin')
);

drop policy if exists "Main admins can update management photos" on storage.objects;
create policy "Main admins can update management photos"
on storage.objects for update to authenticated
using (
  bucket_id = 'management-photos'
  and exists (select 1 from public.profiles p where p.id = auth.uid() and lower(coalesce(p.role,'')) = 'admin')
)
with check (
  bucket_id = 'management-photos'
  and exists (select 1 from public.profiles p where p.id = auth.uid() and lower(coalesce(p.role,'')) = 'admin')
);

drop policy if exists "Main admins can delete management photos" on storage.objects;
create policy "Main admins can delete management photos"
on storage.objects for delete to authenticated
using (
  bucket_id = 'management-photos'
  and exists (select 1 from public.profiles p where p.id = auth.uid() and lower(coalesce(p.role,'')) = 'admin')
);
