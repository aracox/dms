'use client';

import { FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Locale } from '@/i18n/routing';
import {
  uploadTenantDocumentsAction,
  type UploadDocumentsState,
} from '@/lib/tenant-documents/actions';
import { formatDate } from '@/lib/utils/date';

const INITIAL_STATE: UploadDocumentsState = { error: null };

export interface TenantDocumentView {
  id: string;
  file_name: string;
  created_at: string;
  url: string | null;
}

export function TenantDocumentsCard({
  tenantId,
  roomId,
  documents,
  locale,
}: {
  tenantId: string;
  roomId: string;
  documents: TenantDocumentView[];
  locale: Locale;
}) {
  const t = useTranslations();
  const [state, formAction, isPending] = useActionState(uploadTenantDocumentsAction, INITIAL_STATE);

  return (
    <Card>
      <CardHeader title={t('tenant.documents')} />
      <CardBody>
        {documents.length > 0 ? (
          <ul className="space-y-2">
            {documents.map((doc) => (
              <li key={doc.id} className="flex items-center gap-2 text-sm">
                <FileText size={14} className="text-ink-subtle shrink-0" aria-hidden="true" />
                {doc.url ? (
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-blue-deep truncate hover:underline"
                  >
                    {doc.file_name}
                  </a>
                ) : (
                  <span className="truncate">{doc.file_name}</span>
                )}
                <span className="text-ink-subtle text-caption shrink-0">
                  {t('tenant.uploadedOn', {
                    date: formatDate(doc.created_at.slice(0, 10), locale),
                  })}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState message={t('tenant.noDocuments')} />
        )}

        <form action={formAction} className="mt-4 flex flex-wrap items-end gap-2">
          <input type="hidden" name="tenant_id" value={tenantId} />
          <input type="hidden" name="room_id" value={roomId} />
          <input
            name="documents"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="text-ink-muted min-w-0 flex-1 text-sm"
          />
          <Button type="submit" variant="secondary" size="sm" disabled={isPending}>
            {t('tenant.addDocuments')}
          </Button>
        </form>

        {state.error ? (
          <p
            role="alert"
            className="border-brand-red bg-brand-red-soft text-brand-red-deep text-caption mt-2 rounded-md border px-3 py-2"
          >
            {t(state.error)}
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}
