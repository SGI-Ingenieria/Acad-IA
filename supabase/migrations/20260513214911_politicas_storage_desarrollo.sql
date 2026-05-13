
  create policy "acceso a todos en desarrollo dx3g7q_0"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'ai-storage'::text));



  create policy "acceso a todos en desarrollo dx3g7q_1"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check ((bucket_id = 'ai-storage'::text));



  create policy "acceso a todos en desarrollo dx3g7q_2"
  on "storage"."objects"
  as permissive
  for update
  to public
using ((bucket_id = 'ai-storage'::text));



  create policy "acceso a todos en desarrollo dx3g7q_3"
  on "storage"."objects"
  as permissive
  for delete
  to public
using ((bucket_id = 'ai-storage'::text));



