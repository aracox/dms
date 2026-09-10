'use client';

import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { FormField, Input, Select, Textarea } from '@/components/ui/Input';
import {
  createMaintenanceTicketAction,
  type CreateMaintenanceTicketState,
} from '@/lib/maintenance/actions';
import type { MaintenancePriority } from '@/types/database';

const INITIAL_STATE: CreateMaintenanceTicketState = { error: null };
const PRIORITIES: MaintenancePriority[] = ['low', 'medium', 'high', 'urgent'];

/**
 * Collapsed by default: a "+ New ticket" button reveals the form. Any room --
 * vacant, occupied, or under maintenance -- can be picked, or no room at all
 * for a common-area ticket (lobby, car park, etc).
 */
export function NewMaintenanceTicketForm({
  rooms,
}: {
  rooms: { room_id: string; room_number: string }[];
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    createMaintenanceTicketAction,
    INITIAL_STATE,
  );

  if (!open) {
    return (
      <Button type="button" variant="secondary" size="md" onClick={() => setOpen(true)}>
        + {t('maintenance.newTicket')}
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader
        title={t('maintenance.newTicket')}
        action={
          <Button type="button" variant="link" size="sm" onClick={() => setOpen(false)}>
            {t('common.close')}
          </Button>
        }
      />
      <CardBody>
        <form action={formAction} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label={t('room.roomNumber')} htmlFor="room_id">
              <Select id="room_id" name="room_id" defaultValue="">
                <option value="">{t('maintenance.commonArea')}</option>
                {rooms.map((room) => (
                  <option key={room.room_id} value={room.room_id}>
                    {room.room_number}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label={t('maintenance.priority')} htmlFor="priority">
              <Select id="priority" name="priority" defaultValue="medium">
                {PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {t(`maintenancePriority.${priority}`)}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <FormField label={t('maintenance.category')} htmlFor="category">
            <Input id="category" name="category" type="text" maxLength={60} required />
          </FormField>

          <FormField label={t('maintenance.description')} htmlFor="description">
            <Textarea id="description" name="description" maxLength={2000} required />
          </FormField>

          <div className="flex items-center gap-2">
            <Button variant="primary" size="md" type="submit" disabled={isPending}>
              {isPending ? t('common.loading') : t('common.save')}
            </Button>
          </div>

          {state.error ? (
            <p role="alert" className="text-brand-red-deep text-caption">
              {t(state.error)}
            </p>
          ) : null}
        </form>
      </CardBody>
    </Card>
  );
}
