'use client';

import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';

import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { FormField, Input, Select } from '@/components/ui/Input';
import { TD, TH, Table } from '@/components/ui/Table';
import type { Locale } from '@/i18n/routing';
import {
  createStaffUserAction,
  updateStaffUserAction,
  type CreateStaffUserState,
  type UpdateStaffUserState,
} from '@/lib/users/actions';
import type { AppRole, ProfileRow } from '@/types/database';

const ROLE_TONE: Record<AppRole, BadgeTone> = {
  owner: 'yellow',
  admin: 'blue',
  staff: 'neutral',
};
const ROLES: readonly AppRole[] = ['staff', 'admin', 'owner'];

const CREATE_INITIAL: CreateStaffUserState = { error: null, created: null };
const UPDATE_INITIAL: UpdateStaffUserState = { error: null };

function CreateStaffForm() {
  const t = useTranslations();
  const [state, formAction, isPending] = useActionState(createStaffUserAction, CREATE_INITIAL);

  return (
    <Card>
      <CardHeader title={t('staff.addTitle')} description={t('staff.addHint')} />
      <CardBody>
        <form
          action={formAction}
          className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_9rem_auto]"
        >
          <FormField label={t('tenant.fullName')} htmlFor="full_name">
            <Input id="full_name" name="full_name" required maxLength={200} />
          </FormField>
          <FormField label={t('staff.email')} htmlFor="email">
            <Input id="email" name="email" type="email" required />
          </FormField>
          <FormField label={t('staff.role')} htmlFor="role">
            <Select id="role" name="role" defaultValue="staff" required>
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {t(`roles.${role}`)}
                </option>
              ))}
            </Select>
          </FormField>
          <Button type="submit" variant="primary" size="md" disabled={isPending}>
            {isPending ? t('common.loading') : t('staff.create')}
          </Button>
        </form>

        {state.error ? (
          <p
            role="alert"
            className="border-brand-red bg-brand-red-soft text-brand-red-deep text-caption mt-3 rounded-md border px-3 py-2"
          >
            {t(state.error)}
          </p>
        ) : null}

        {state.created ? (
          <div
            role="status"
            className="border-brand-green bg-brand-green-soft text-brand-green-deep text-caption mt-3 space-y-1 rounded-md border px-3 py-2"
          >
            <p>{t('staff.createdNotice', { email: state.created.email })}</p>
            <p className="font-mono text-sm font-semibold tracking-wide">
              {state.created.tempPassword}
            </p>
            <p>{t('staff.tempPasswordHint')}</p>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

function StaffRow({
  user,
  isSelf,
  dateFormatter,
}: {
  user: ProfileRow;
  isSelf: boolean;
  dateFormatter: Intl.DateTimeFormat;
}) {
  const t = useTranslations();
  const [role, setRole] = useState<AppRole>(user.role);
  const [isActive, setIsActive] = useState(user.is_active);
  const [state, formAction, isPending] = useActionState(updateStaffUserAction, UPDATE_INITIAL);

  return (
    <>
      <tr>
        <TD className="font-medium">
          {user.full_name}
          {isSelf ? (
            <span className="text-ink-subtle ml-1 font-normal">{t('staff.you')}</span>
          ) : null}
        </TD>
        <TD>{dateFormatter.format(new Date(user.created_at))}</TD>
        {isSelf ? (
          <>
            <TD>
              <Badge tone={ROLE_TONE[user.role]}>{t(`roles.${user.role}`)}</Badge>
            </TD>
            <TD>
              <Badge tone={user.is_active ? 'green' : 'neutral'}>
                {t(user.is_active ? 'staff.active' : 'staff.inactive')}
              </Badge>
            </TD>
            <TD />
          </>
        ) : (
          <>
            <TD>
              <Select
                value={role}
                onChange={(event) => setRole(event.target.value as AppRole)}
                aria-label={t('staff.role')}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {t(`roles.${r}`)}
                  </option>
                ))}
              </Select>
            </TD>
            <TD>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(event) => setIsActive(event.target.checked)}
                />
                {t(isActive ? 'staff.active' : 'staff.inactive')}
              </label>
            </TD>
            <TD>
              <form action={formAction} className="flex items-center gap-2">
                <input type="hidden" name="profile_id" value={user.id} />
                <input type="hidden" name="role" value={role} />
                <input type="hidden" name="is_active" value={String(isActive)} />
                <Button type="submit" variant="secondary" size="sm" disabled={isPending}>
                  {isPending ? t('common.loading') : t('common.save')}
                </Button>
              </form>
            </TD>
          </>
        )}
      </tr>
      {state.error ? (
        <tr>
          <td colSpan={5} className="text-brand-red-deep text-caption px-4 pb-2">
            {t(state.error)}
          </td>
        </tr>
      ) : null}
    </>
  );
}

export function StaffManagement({
  users,
  currentUserId,
  locale,
}: {
  users: ProfileRow[];
  currentUserId: string;
  locale: Locale;
}) {
  const t = useTranslations();
  const dateFormatter = new Intl.DateTimeFormat(locale === 'th' ? 'th-TH-u-ca-buddhist' : 'en-GB', {
    dateStyle: 'medium',
  });

  return (
    <div className="space-y-6">
      <CreateStaffForm />

      <Card>
        <CardHeader title={t('staff.listTitle')} />
        <Table
          head={
            <tr>
              <TH>{t('tenant.fullName')}</TH>
              <TH>{t('staff.createdAt')}</TH>
              <TH>{t('staff.role')}</TH>
              <TH>{t('common.status')}</TH>
              <TH />
            </tr>
          }
        >
          {users.map((user) => (
            <StaffRow
              key={user.id}
              user={user}
              isSelf={user.id === currentUserId}
              dateFormatter={dateFormatter}
            />
          ))}
        </Table>
      </Card>
    </div>
  );
}
