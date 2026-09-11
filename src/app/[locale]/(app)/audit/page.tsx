import { getTranslations, setRequestLocale } from 'next-intl/server';

import { PageHeader } from '@/components/layout/AppShell';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { TD, TH, Table } from '@/components/ui/Table';
import type { Locale } from '@/i18n/routing';
import { getAuditLogs } from '@/lib/audit/queries';
import type { AuditAction } from '@/types/database';

const ACTION_TONE: Record<AuditAction, BadgeTone> = {
  insert: 'green',
  update: 'blue',
  delete: 'red',
};

const LOG_LIMIT = 200;

/** One value's changed fields, compared to the other side of the same row. */
function changedFields(a: unknown, b: unknown): string[] {
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return [];
  const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)]);
  return [...keys].filter(
    (key) =>
      JSON.stringify((a as Record<string, unknown>)[key]) !==
      JSON.stringify((b as Record<string, unknown>)[key]),
  );
}

export default async function AuditLogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const typedLocale = locale as Locale;

  const t = await getTranslations();
  const logs = await getAuditLogs(LOG_LIMIT);

  const formatter = new Intl.DateTimeFormat(
    typedLocale === 'th' ? 'th-TH-u-ca-buddhist' : 'en-GB',
    {
      dateStyle: 'medium',
      timeStyle: 'short',
    },
  );

  return (
    <>
      <PageHeader
        title={t('audit.title')}
        description={t('audit.subtitle', { count: logs.length })}
      />

      <Card>
        {logs.length === 0 ? (
          <div className="p-3">
            <EmptyState message={t('common.noData')} />
          </div>
        ) : (
          <Table
            head={
              <tr>
                <TH>{t('audit.time')}</TH>
                <TH>{t('audit.actor')}</TH>
                <TH>{t('audit.entity')}</TH>
                <TH>{t('audit.action')}</TH>
                <TH>{t('audit.changes')}</TH>
              </tr>
            }
          >
            {logs.map((log) => {
              const fields =
                log.action === 'update' ? changedFields(log.old_value, log.new_value) : [];

              return (
                <tr key={log.id}>
                  <TD className="whitespace-nowrap">
                    {formatter.format(new Date(log.created_at))}
                  </TD>
                  <TD>{log.actorName ?? t('audit.system')}</TD>
                  <TD>
                    <span className="font-medium">{log.entity_type}</span>
                    {log.entity_id ? (
                      <span className="text-ink-subtle ml-1 font-mono text-xs">
                        {log.entity_id.slice(0, 8)}
                      </span>
                    ) : null}
                  </TD>
                  <TD>
                    <Badge tone={ACTION_TONE[log.action]}>{t(`auditAction.${log.action}`)}</Badge>
                  </TD>
                  <TD className="text-ink-muted max-w-xs">
                    <span className="block truncate" title={fields.join(', ')}>
                      {fields.length > 0 ? fields.join(', ') : '-'}
                    </span>
                  </TD>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
    </>
  );
}
