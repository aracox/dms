import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

/** Mirrors the tenant-documents bucket's own limits (0008_storage.sql). */
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export function isValidDocumentFile(file: File): boolean {
  return file.size > 0 && file.size <= MAX_FILE_BYTES && ALLOWED_TYPES.includes(file.type);
}

/**
 * Uploads each valid file to tenant-documents/{tenantId}/... and records it in
 * tenant_documents. Invalid files are skipped rather than failing the whole
 * batch -- the caller decides what to do if the returned count is 0.
 */
export async function uploadTenantDocuments(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  files: File[],
  uploadedBy: string,
): Promise<number> {
  let uploaded = 0;

  for (const file of files) {
    if (!isValidDocumentFile(file)) continue;

    const path = `${tenantId}/${crypto.randomUUID()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('tenant-documents')
      .upload(path, file);
    if (uploadError) continue;

    const { error: insertError } = await supabase.from('tenant_documents').insert({
      tenant_id: tenantId,
      storage_path: path,
      file_name: file.name,
      uploaded_by: uploadedBy,
    });
    if (!insertError) uploaded += 1;
  }

  return uploaded;
}
