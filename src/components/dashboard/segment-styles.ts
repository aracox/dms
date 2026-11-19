import type { BadgeTone } from '@/components/ui/Badge';
import type { PropertySegment } from '@/types/database';

/**
 * The single mapping from property segment to its visual treatment.
 *
 * A segment is a category, not a status, so it never borrows a status hue.
 * หอพัก takes the primary navy and บ้านพัก the light sage -- far apart in
 * lightness, so the two series stay distinct side by side -- which keeps
 * `green` free to mean "collected" and `red` free to mean "overdue" in the same
 * eyeful. The label is always rendered next to the
 * colour, per the design system's never-colour-alone rule.
 */
export const SEGMENT_STYLES: Record<PropertySegment, { tone: BadgeTone; fill: string }> = {
  dorm: { tone: 'blue', fill: 'bg-brand-blue' },
  house: { tone: 'neutral', fill: 'bg-brand-teal' },
};
