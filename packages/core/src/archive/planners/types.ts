import type { ArchiveWarning, CharacterBatch } from '../../store/characterStore';

/** A batch plus the warnings the planner found while building it; only create and edit produce warnings. */
export interface PlannedBatch {
  readonly batch: CharacterBatch;
  readonly warnings: readonly ArchiveWarning[];
}
