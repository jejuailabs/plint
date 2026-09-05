-- RunPod Blender worker output. The bucket is private; users can only access paths
-- beginning with their own auth UID. Signed URLs are created by authenticated routes.
insert into storage.buckets (id, name, public)
values ('analysis-artifacts', 'analysis-artifacts', false)
on conflict (id) do nothing;

create policy "users read own analysis artifacts"
on storage.objects for select to authenticated
using (
  bucket_id = 'analysis-artifacts'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "users write own analysis artifacts"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'analysis-artifacts'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "users update own analysis artifacts"
on storage.objects for update to authenticated
using (
  bucket_id = 'analysis-artifacts'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'analysis-artifacts'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
