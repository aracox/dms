import type { TestScenarioId } from '@/config/test-scenarios';
import { daysBetween, type IsoDate } from '@/lib/utils/date';
import type { RoomBoardRow } from '@/types/database';

/**
 * Works out which scenario T01 is currently in.
 *
 * The scenario is not stored -- it is a view of the room's actual state, so the
 * switcher stays honest even if the data is edited through the normal screens.
 * Order matters: the checks run from most specific to least.
 */
export function inferTestScenario(
  board: RoomBoardRow | null,
  today: IsoDate,
): TestScenarioId | null {
  if (!board) return null;

  if (board.room_status === 'maintenance') return 'maintenance';
  if (board.room_status === 'vacant' || board.room_status === 'reserved') return 'vacant';

  if (board.lost_card_count > 0) return 'lost_card';

  if (board.invoice_status === 'partially_paid') return 'partial_payment';
  if (board.financial_status === 'overdue') return 'overdue';

  if (board.financial_status === 'payment_due') return 'payment_due';

  if (board.financial_status === 'paid') {
    // A paid room with a contract about to lapse is the expiring scenario.
    if (board.end_date && daysBetween(today, board.end_date) <= 20) return 'contract_expiring';
    return 'normal';
  }

  return null;
}
