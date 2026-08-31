'use server';

import { revalidatePath } from 'next/cache';

import { assertCan } from '@/lib/permissions';
import { createClient, getCurrentProfile } from '@/lib/supabase/server';

import { uploadTenantDocuments } from './upload';

export interface UploadDocumentsState {
  error: string | null;
}

export async function uploadTenantDocumentsAction(
  _previous: UploadDocumentsState,
  formData: FormData,
): Promise<UploadDocumentsState> {
  const profile = await getCurrentProfile();
  // Throws PermissionError, which the error boundary renders.
  assertCan(profile?.role, 'tenants:write');

  const tenantId = String(formData.get('tenant_id') ?? '');
  const roomId = String(formData.get('room_id') ?? '');
  const files = formData
    .getAll('documents')
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (files.length === 0) return { error: null };

  const supabase = await createClient();
  const uploaded = await uploadTenantDocuments(supabase, tenantId, files, profile!.id);

  if (uploaded === 0) return { error: 'validation.document.invalid' };

  revalidatePath(`/rooms/${roomId}`);
  return { error: null };
}
