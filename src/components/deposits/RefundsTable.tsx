'use client';

import { CheckCircle2, Clock, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { SegmentBadge } from '@/components/dashboard/SegmentBadge';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormField, Input, Select } from '@/components/ui/Input';
import { TD, TH, Table } from '@/components/ui/Table';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { formatTHB } from '@/lib/billing/money';
import type { DepositRefundRecord } from '@/lib/contracts/queries';
import { propertySegment } from '@/lib/reporting/segments';
import { formatDate } from '@/lib/utils/date';
import type { PropertySegment } from '@/types/database';

import { DepositSettlementCells } from './DepositSettlementForm';

type StatusFilter = 'all' | DepositRefundRecord['status'];
const STATUS_FILTERS: StatusFilter[] = ['all', 'pending', 'refunded'];
const SEGMENTS: PropertySegment[] = ['dorm', 'house'];

/**
 * Every deposit refund, waiting and done, filtered in the browser like the
 * rooms list -- the whole set is a few dozen rows at most. Waiting rows carry
 * the settlement inputs; refunded rows show what was recorded.
 */
export function RefundsTable({
  records,
  canWrite,
  locale,
}: {
  records: DepositRefundRecord[];
  canWrite: boolean;
  locale: Locale;
}) {
  const t = useTranslations();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [segment, setSegment] = useState<PropertySegment | 'all'>('all');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const digits = needle.replace(/\D/g, '');

    return records.filter((record) => {
      if (status !== 'all' && record.status !== status) return false;
      if (segment !== 'all' && propertySegment(record.roomType) !== segment) return false;
      if (!needle) return true;
      return (
        record.tenantName.toLowerCase().includes(needle) ||
        record.roomNumber.toLowerCase().includes(needle) ||
        // Phones are stored as digits only; ignore dashes/spaces people type.
        (digits !== '' && record.tenantPhone.replace(/\D/g, '').includes(digits))
      );
    });
  }, [records, query, status, segment]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4 px-4 pt-4">
        <FormField label={t('common.search')} htmlFor="refund-search" className="min-w-56 flex-1">
          <div className="relative">
            <Search
              size={14}
              className="text-ink-subtle pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
              aria-hidden="true"
            />
            <Input
              id="refund-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('deposits.searchPlaceholder')}
              className="pl-9"
            />
          </div>
        </FormField>

        <FormField label={t('rooms.filterByStatus')} htmlFor="refund-status">
          <Select
            id="refund-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as StatusFilter)}
            className="w-auto"
          >
            {STATUS_FILTERS.map((candidate) => (
              <option key={candidate} value={candidate}>
                {t(`deposits.status.${candidate}`)}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label={t('segment.column')} htmlFor="refund-segment">
          <Select
            id="refund-segment"
            value={segment}
            onChange={(event) => setSegment(event.target.value as PropertySegment | 'all')}
            className="w-auto"
          >
            <option value="all">{t('segment.wholeProperty')}</option>
            {SEGMENTS.map((candidate) => (
              <option key={candidate} value={candidate}>
                {t(`segment.${candidate}`)}
              </option>
            ))}
          </Select>
        </FormField>

        <p className="text-ink-subtle text-caption ml-auto" aria-live="polite">
          {t('deposits.resultCount', { count: filtered.length })}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="p-3">
          <EmptyState message={t('deposits.empty')} />
        </div>
      ) : (
        <Table
          head={
            <tr>
              <TH>{t('room.roomNumber')}</TH>
              <TH>{t('deposits.previousTenant')}</TH>
              <TH>{t('deposits.movedOutOn')}</TH>
              <TH numeric>{t('room.deposit')}</TH>
              <TH>{t('common.status')}</TH>
              <TH>{t('contract.actualRefund')}</TH>
              <TH>{t('contract.deductionReason')}</TH>
              <TH>
                <span className="sr-only">{t('deposits.recordRefund')}</span>
              </TH>
            </tr>
          }
        >
          {filtered.map((record) => {
            const { contract } = record;
            return (
              // Top-aligned so the text lines up with the inputs, not with their hints.
              <tr
                key={contract.id}
                className="[&>td]:align-top [&>td:not(:has(input,button))]:pt-4"
              >
                <TD>
                  <Link
                    href={`/rooms/${contract.room_id}?tab=contract`}
                    className="text-brand-blue-deep font-medium underline"
                  >
                    {record.roomNumber}
                  </Link>
                  <div className="mt-1">
                    <SegmentBadge segment={propertySegment(record.roomType)} />
                  </div>
                </TD>
                <TD>
                  {record.tenantName}
                  {record.tenantPhone ? (
                    <p className="text-ink-subtle text-caption">{record.tenantPhone}</p>
                  ) : null}
                </TD>
                <TD>{formatDate(contract.terminated_at ?? contract.end_date, locale)}</TD>
                <TD numeric>{formatTHB(contract.deposit, locale)}</TD>
                <TD>
                  {record.status === 'pending' ? (
                    <Badge tone="yellow" icon={<Clock size={12} aria-hidden="true" />}>
                      {t('deposits.status.pending')}
                    </Badge>
                  ) : (
                    <Badge tone="green" icon={<CheckCircle2 size={12} aria-hidden="true" />}>
                      {t('deposits.status.refunded')}
                    </Badge>
                  )}
                </TD>
                {record.status === 'pending' && canWrite ? (
                  <DepositSettlementCells
                    contractId={contract.id}
                    roomId={contract.room_id}
                    deposit={contract.deposit}
                    locale={locale}
                  />
                ) : record.status === 'pending' ? (
                  <>
                    <TD>-</TD>
                    <TD>-</TD>
                    <TD />
                  </>
                ) : (
                  <>
                    <TD>
                      {formatTHB(contract.deposit_refund ?? 0, locale)}
                      {contract.deposit_deduction > 0 ? (
                        <p className="text-ink-subtle text-caption">
                          {t('deposits.deductedShort', {
                            amount: formatTHB(contract.deposit_deduction, locale),
                          })}
                        </p>
                      ) : null}
                    </TD>
                    <TD className="whitespace-pre-line">
                      {contract.deposit_settlement_note || '-'}
                    </TD>
                    <TD className="text-ink-subtle text-caption whitespace-nowrap">
                      {contract.deposit_settled_at
                        ? t('contract.depositSettledOn', {
                            date: formatDate(contract.deposit_settled_at, locale),
                          })
                        : null}
                    </TD>
                  </>
                )}
              </tr>
            );
          })}
        </Table>
      )}
    </div>
  );
}
