import type { LlmTier } from './request';

/**
 * Decides whether one more call may start. A governor that limits calls per
 * game-minute and tier counts what it admits itself; the port has no separate
 * "record" step (S-09).
 */
export interface BudgetGovernor {
  admit(tier: LlmTier, gameMinute: number): boolean;
}

/**
 * The default governor: admits everything, because the legacy game has none
 * and the goldens must equal it (S-09).
 */
export const passThroughGovernor: BudgetGovernor = {
  admit: () => true,
};
