import { useTranslations } from 'next-intl';

import { SEGMENT_STYLES } from '@/components/dashboard/segment-styles';
import { Badge } from '@/components/ui/Badge';
import type { PropertySegment } from '@/types/database';

/**
 * หอพัก / บ้านพัก chip for the dashboard's operations tables.
 *
 * `null` is a common-area row -- a maintenance ticket with no room belongs to
 * neither segment.
 */
export function SegmentBadge({ segment }: { segment: PropertySegment | null }) {
  const t = useTranslations();

  if (!segment) {
    return <Badge>{t('maintenance.commonArea')}</Badge>;
  }

  return <Badge tone={SEGMENT_STYLES[segment].tone}>{t(`segment.${segment}`)}</Badge>;
}
