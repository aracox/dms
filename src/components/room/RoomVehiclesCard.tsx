'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { InlineEditableField } from '@/components/ui/InlineEditableField';
import { updateRoomVehiclesAction } from '@/lib/rooms/actions';

/** At most 1 car + 1 motorcycle per room. Plates edit in place, like tenant contact fields. */
export function RoomVehiclesCard({
  roomId,
  carPlate,
  motorcyclePlate,
  canEdit,
}: {
  roomId: string;
  carPlate: string | null;
  motorcyclePlate: string | null;
  canEdit: boolean;
}) {
  const t = useTranslations();
  const [vehicles, setVehicles] = useState({
    car_plate: carPlate ?? '',
    motorcycle_plate: motorcyclePlate ?? '',
  });

  async function commitField(field: keyof typeof vehicles, value: string): Promise<string | null> {
    const next = { ...vehicles, [field]: value };

    const formData = new FormData();
    formData.set('room_id', roomId);
    formData.set('car_plate', next.car_plate);
    formData.set('motorcycle_plate', next.motorcycle_plate);

    const result = await updateRoomVehiclesAction({ error: null }, formData);
    if (result.error) return result.error;

    setVehicles(next);
    return null;
  }

  return (
    <Card>
      <CardHeader title={t('room.vehicles')} />
      <CardBody>
        <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
          {canEdit ? (
            <InlineEditableField
              label={t('room.carPlate')}
              value={vehicles.car_plate}
              emptyLabel={t('common.notAvailable')}
              onCommit={(value) => commitField('car_plate', value)}
            />
          ) : (
            <div className="py-2">
              <dt className="text-ink-muted text-xs">{t('room.carPlate')}</dt>
              <dd className="text-ink mt-0.5 text-sm font-medium">
                {vehicles.car_plate || t('common.notAvailable')}
              </dd>
            </div>
          )}

          {canEdit ? (
            <InlineEditableField
              label={t('room.motorcyclePlate')}
              value={vehicles.motorcycle_plate}
              emptyLabel={t('common.notAvailable')}
              onCommit={(value) => commitField('motorcycle_plate', value)}
            />
          ) : (
            <div className="py-2">
              <dt className="text-ink-muted text-xs">{t('room.motorcyclePlate')}</dt>
              <dd className="text-ink mt-0.5 text-sm font-medium">
                {vehicles.motorcycle_plate || t('common.notAvailable')}
              </dd>
            </div>
          )}
        </dl>
      </CardBody>
    </Card>
  );
}
