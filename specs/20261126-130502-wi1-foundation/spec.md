# Feature Specification: WI-1 Foundation

**Feature Branch**: `20261126-130502-wi1-foundation`, created from the umbrella branch `20261113-111328-v1-port` at `6f0be1d`.
**Created**: 2026-11-26
**Status**: approved (the umbrella spec's heavy gate, with Amendments 1 and 2, D-14-x, D-17-2, D-26-2).

**API contract**: as stated in the umbrella spec's header. WI-1 delivers the first contract, which freezes at the WI-1 merge into `develop`. This work item adds nothing beyond the umbrella spec.

## Where the specification is

WI-1 is fully specified in the umbrella spec, `specs/20261113-111328-v1-port/spec.md`. Following decision D6, this file points to it and does not copy it, so that there is one source of truth:

- section 2, the cross-cutting architecture, which binds every work item;
- section 4, "WI-1 Foundation": user stories US1 to US6, edge cases, functional requirements FR-001 to FR-103, key entities, success criteria SC-001 to SC-009, assumptions, known limitations, council and owner decisions;
- section 5, the FAQ.

The amendments are applied in that file: `amendment-2026-11-17.md` (Amendment 1) and `amendment-2026-11-26.md` (Amendment 2). Where they differ, Amendment 2 prevails, then Amendment 1, then the spec text. The binding reference is the state pinned by `specs/20261113-111328-v1-port/reference-2026-11-23.md5`.

## Open items that touch WI-1

- **Q-26-1** (reserved to the owner): the vendoring of `qualita.js` waits for it. Commits from that vendoring on stay on the local branch `wi1-local-q26-1`, with no upstream, as section 4.9 of the umbrella spec says.
- **Q-17-2** (reserved to the owner): the publication of the 45 new character sheets, which FR-015's fixtures need.
- WI-1 closure, the final review and the merge follow the umbrella spec's sections 4.9 and the constitution's workflow.
