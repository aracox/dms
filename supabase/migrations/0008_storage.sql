-- 0008_storage.sql
-- Private Storage buckets. Nothing here is publicly readable; the app serves
-- files through signed URLs generated server-side.
--
-- Path conventions (enforced by application code, not by the bucket):
--   payment-slips/{roomId}/{invoiceId}/{filename}
--   maintenance/{ticketId}/{filename}
--   tenant-documents/{tenantId}/{filename}

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'payment-slips',
    'payment-slips',
    false,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  ),
  (
    'maintenance',
    'maintenance',
    false,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'tenant-documents',
    'tenant-documents',
    false,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  )
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- payment-slips: staff may upload a slip when recording a payment.
-- Overwriting or deleting a slip is an admin+ action -- it is financial evidence.
-- ---------------------------------------------------------------------------
create policy payment_slips_read on storage.objects for select to authenticated
  using (bucket_id = 'payment-slips' and is_staff_or_above());

create policy payment_slips_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-slips' and is_staff_or_above());

create policy payment_slips_update on storage.objects for update to authenticated
  using (bucket_id = 'payment-slips' and is_admin_or_owner());

create policy payment_slips_delete on storage.objects for delete to authenticated
  using (bucket_id = 'payment-slips' and is_owner());

-- ---------------------------------------------------------------------------
-- maintenance: staff open tickets, so staff upload photos.
-- ---------------------------------------------------------------------------
create policy maintenance_read on storage.objects for select to authenticated
  using (bucket_id = 'maintenance' and is_staff_or_above());

create policy maintenance_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'maintenance' and is_staff_or_above());

create policy maintenance_update on storage.objects for update to authenticated
  using (bucket_id = 'maintenance' and is_staff_or_above());

create policy maintenance_delete on storage.objects for delete to authenticated
  using (bucket_id = 'maintenance' and is_admin_or_owner());

-- ---------------------------------------------------------------------------
-- tenant-documents: identity documents. Admin+ only, never staff.
-- ---------------------------------------------------------------------------
create policy tenant_documents_read on storage.objects for select to authenticated
  using (bucket_id = 'tenant-documents' and is_admin_or_owner());

create policy tenant_documents_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'tenant-documents' and is_admin_or_owner());

create policy tenant_documents_update on storage.objects for update to authenticated
  using (bucket_id = 'tenant-documents' and is_admin_or_owner());

create policy tenant_documents_delete on storage.objects for delete to authenticated
  using (bucket_id = 'tenant-documents' and is_owner());
