/**
 * Test Mode scenarios for the mock room T01.
 *
 * These are DECLARATIVE: each scenario states the T01 state it wants, and a
 * server action reconciles the database to it. Nothing here creates a parallel
 * implementation of a room -- Test Mode renders the real components against
 * real rows that happen to carry is_test = true.
 *
 * Offsets are relative to today in Bangkok, so a scenario stays meaningful
 * however long after seeding it is applied.
 */

import type { CardStatus, MaintenancePriority, MeterType, RoomStatus } from '@/types/database';

export const T01_ROOM_NUMBER = 'T01';

/** The Test Mode defaults from the specification. */
export const T01_DEFAULTS = {
  roomNumber: T01_ROOM_NUMBER,
  /** Floor 0 keeps T01 off every production floor plan. */
  floor: 0,
  tenantName: 'Test Tenant',
  tenantPhone: '0800000000',
  occupantCount: 2,
  monthlyRent: 6500,
  deposit: 13000,
  cards: [
    { cardNumber: 'T01-A', cardUid: 'TEST-CARD-001' },
    { cardNumber: 'T01-B', cardUid: 'TEST-CARD-002' },
  ],
  meters: {
    electricity: { previousReading: 1250, currentReading: 1380, rate: 8 },
    water: { previousReading: 220, currentReading: 226, rate: 20 },
  },
} as const satisfies {
  roomNumber: string;
  floor: number;
  tenantName: string;
  tenantPhone: string;
  occupantCount: number;
  monthlyRent: number;
  deposit: number;
  cards: readonly { cardNumber: string; cardUid: string }[];
  meters: Record<MeterType, { previousReading: number; currentReading: number; rate: number }>;
};

export const TEST_SCENARIO_IDS = [
  'normal',
  'payment_due',
  'overdue',
  'vacant',
  'maintenance',
  'lost_card',
  'partial_payment',
  'contract_expiring',
] as const;

export type TestScenarioId = (typeof TEST_SCENARIO_IDS)[number];

export interface TestScenarioState {
  roomStatus: RoomStatus;
  /** Null means no contract and no tenant on the room. */
  contract: {
    occupantCount: number;
    /** Days from today until the contract ends. */
    endsInDays: number;
  } | null;
  /** Null means no invoice at all for the current month. */
  invoice: {
    /** Days from today until the invoice falls due. Negative means already past due. */
    dueInDays: number;
    /** 0 = unpaid, 0.5 = half paid, 1 = paid in full. */
    paidFraction: number;
  } | null;
  cards: {
    slotA: CardStatus;
    slotB: CardStatus;
    /** Charged when a card is replaced after being lost. */
    replacementFee: number;
  };
  maintenance: {
    priority: MaintenancePriority;
    category: string;
  } | null;
}

export interface TestScenario {
  id: TestScenarioId;
  state: TestScenarioState;
}

const ACTIVE_CARDS = { slotA: 'active', slotB: 'active', replacementFee: 0 } as const;
const AVAILABLE_CARDS = { slotA: 'available', slotB: 'available', replacementFee: 0 } as const;

export const TEST_SCENARIOS: Record<TestScenarioId, TestScenario> = {
  /** The seeded default: occupied, paid in full, everything healthy. */
  normal: {
    id: 'normal',
    state: {
      roomStatus: 'occupied',
      contract: { occupantCount: 2, endsInDays: 120 },
      invoice: { dueInDays: 2, paidFraction: 1 },
      cards: ACTIVE_CARDS,
      maintenance: null,
    },
  },

  payment_due: {
    id: 'payment_due',
    state: {
      roomStatus: 'occupied',
      contract: { occupantCount: 2, endsInDays: 120 },
      invoice: { dueInDays: 5, paidFraction: 0 },
      cards: ACTIVE_CARDS,
      maintenance: null,
    },
  },

  overdue: {
    id: 'overdue',
    state: {
      roomStatus: 'occupied',
      contract: { occupantCount: 2, endsInDays: 120 },
      invoice: { dueInDays: -12, paidFraction: 0 },
      cards: ACTIVE_CARDS,
      maintenance: null,
    },
  },

  vacant: {
    id: 'vacant',
    state: {
      roomStatus: 'vacant',
      contract: null,
      invoice: null,
      cards: AVAILABLE_CARDS,
      maintenance: null,
    },
  },

  maintenance: {
    id: 'maintenance',
    state: {
      roomStatus: 'maintenance',
      contract: null,
      invoice: null,
      cards: AVAILABLE_CARDS,
      maintenance: { priority: 'urgent', category: 'plumbing' },
    },
  },

  lost_card: {
    id: 'lost_card',
    state: {
      roomStatus: 'occupied',
      contract: { occupantCount: 2, endsInDays: 120 },
      invoice: { dueInDays: 2, paidFraction: 1 },
      cards: { slotA: 'active', slotB: 'lost', replacementFee: 200 },
      maintenance: null,
    },
  },

  partial_payment: {
    id: 'partial_payment',
    state: {
      roomStatus: 'occupied',
      contract: { occupantCount: 2, endsInDays: 120 },
      invoice: { dueInDays: -3, paidFraction: 0.5 },
      cards: ACTIVE_CARDS,
      maintenance: null,
    },
  },

  contract_expiring: {
    id: 'contract_expiring',
    state: {
      roomStatus: 'occupied',
      contract: { occupantCount: 2, endsInDays: 15 },
      invoice: { dueInDays: 2, paidFraction: 1 },
      cards: ACTIVE_CARDS,
      maintenance: null,
    },
  },
};

/** The scenario that `Reset Test Data` restores. */
export const DEFAULT_TEST_SCENARIO: TestScenarioId = 'normal';

export function isTestScenarioId(value: unknown): value is TestScenarioId {
  return typeof value === 'string' && TEST_SCENARIO_IDS.includes(value as TestScenarioId);
}

export function getTestScenario(id: TestScenarioId): TestScenario {
  return TEST_SCENARIOS[id];
}
