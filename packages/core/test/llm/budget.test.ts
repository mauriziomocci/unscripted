import { describe, expect, it } from 'vitest';
import { passThroughGovernor, type BudgetGovernor } from '../../src/llm/budget';

describe('passThroughGovernor', () => {
  const governor: BudgetGovernor = passThroughGovernor;

  it.each([
    ['main', 0],
    ['main', 59],
    ['light', 600],
    ['light', 1_000_000],
  ] as const)('admits a %s call at game minute %d', (tier, gameMinute) => {
    expect(governor.admit(tier, gameMinute)).toBe(true);
  });
});
