import { useTranslations } from 'next-intl';

import { STATUS_ICONS } from '@/components/status/RoomStatusBadge';
import { LEGEND_ORDER, STATUS_STYLES } from '@/components/status/status-styles';
import { cn } from '@/lib/utils/cn';

/** Colour swatch + icon + label for every room state. */
export function StatusLegend({ className }: { className?: string }) {
  const t = useTranslations();

  return (
    <div className={className}>
      <h3 className="text-ink-muted text-xs font-semibold">{t('floorPlan.legend')}</h3>
      <ul className="mt-2 space-y-1.5">
        {LEGEND_ORDER.map((status) => {
          const style = STATUS_STYLES[status];
          const Icon = STATUS_ICONS[style.icon];

          return (
            <li key={status} className="text-ink flex items-center gap-2 text-xs">
              <span
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded border',
                  style.swatch,
                )}
              >
                <Icon size={11} aria-hidden="true" />
              </span>
              {t(`combinedStatus.${style.labelKey}`)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
