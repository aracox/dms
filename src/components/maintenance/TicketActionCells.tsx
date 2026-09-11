'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { TD } from '@/components/ui/Table';
import { updateMaintenanceTicketAction } from '@/lib/maintenance/actions';
import type { MaintenanceStatus } from '@/types/database';

const STATUSES: MaintenanceStatus[] = ['open', 'in_progress', 'waiting', 'completed', 'cancelled'];

/**
 * Status/technician/cost as one editable row, saved together with a single
 * button. Renders the <td> cells directly (a <form> cannot cleanly span
 * multiple table cells), so state and the save call live here instead.
 */
export function TicketActionCells({
  ticketId,
  roomId,
  status,
  technician,
  cost,
}: {
  ticketId: string;
  roomId: string | null;
  status: MaintenanceStatus;
  technician: string | null;
  cost: number | null;
}) {
  const t = useTranslations();
  const [draftStatus, setDraftStatus] = useState<MaintenanceStatus>(status);
  const [draftTechnician, setDraftTechnician] = useState(technician ?? '');
  const [draftCost, setDraftCost] = useState(cost !== null ? String(cost) : '');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set('ticket_id', ticketId);
      formData.set('room_id', roomId ?? '');
      formData.set('status', draftStatus);
      formData.set('technician', draftTechnician);
      formData.set('cost', draftCost);

      const result = await updateMaintenanceTicketAction({ error: null }, formData);
      setError(result.error);
    });
  }

  return (
    <>
      <TD>
        <Select
          value={draftStatus}
          onChange={(event) => setDraftStatus(event.target.value as MaintenanceStatus)}
          disabled={isPending}
          className="h-8 py-1 text-caption"
        >
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {t(`maintenanceStatus.${value}`)}
            </option>
          ))}
        </Select>
      </TD>
      <TD>
        <Input
          type="text"
          value={draftTechnician}
          onChange={(event) => setDraftTechnician(event.target.value)}
          disabled={isPending}
          maxLength={200}
          className="h-8 py-1 text-caption"
        />
      </TD>
      <TD numeric>
        <Input
          type="number"
          min={0}
          step="0.01"
          value={draftCost}
          onChange={(event) => setDraftCost(event.target.value)}
          disabled={isPending}
          className="h-8 py-1 text-caption"
        />
      </TD>
      <TD>
        <Button type="button" variant="link" size="sm" onClick={save} disabled={isPending}>
          {isPending ? t('common.loading') : t('common.save')}
        </Button>
        {error ? <p className="text-brand-red-deep text-caption mt-0.5">{t(error)}</p> : null}
      </TD>
    </>
  );
}
