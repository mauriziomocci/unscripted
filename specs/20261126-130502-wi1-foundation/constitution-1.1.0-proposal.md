# Proposal: constitution 1.1.0 (task T001 of WI-1)

Status: proposal, waiting for the owner's go (open issue OI-1 of `plan.md`). Nothing in `.specify/memory/constitution.md` is changed until then.

Why: FR-102 and section 4.9 ("Constitution I") of the umbrella spec require the amendment as the first commit of the WI-1 branch, because Principle I names only `LlmClient` and `Store` as ports, while section 2.2 of the spec defines eight ports and one UI-level capability, and section 2.1 adds the workspaces `packages/ui` and `tools/golden`. No code may land under the old text.

Why it waits: the constitution is an instruction layer of the project (it prevails over parts of the global rules), and the owner's rules reserve changes to instruction files to the owner, with a backup, a diff and an explicit go. The Trinity therefore prepares the exact text and does not apply it.

## The change, as a diff

```diff
 ### I. One Game, Two Forms (NON-NEGOTIABLE)
 
 The web app and the Claude artifact are two builds of the same game and never drift apart.
 
 - All game rules, prompts, data models and report logic live in `packages/core`.
-- Platform differences are allowed only behind the `LlmClient` and `Store` interfaces and in rendering.
+- Every screen of both forms lives in `packages/ui`; `apps/web` and `apps/artifact` only compose the adapters and mount the UI.
+- Platform differences are allowed only behind the ports of `packages/core` (`LlmClient`, `CharacterStore`, `ArchiveClient`, `GameStore`, `Clock`, `Scheduler`, `Rng`, and the optional `Speech` and `Downloads`), behind the optional UI-level `Sound` capability of `packages/ui`, and in rendering.
+- `LlmClient` requests name a call kind and a tier (`main` or `light`), never a model; the server or the artifact client maps tiers to models.
 - A change to core is followed, in the same work item, by rebuilding the artifact and checking it with the mock LLM.
 - A feature added to one form is added to the other in the same work item, or recorded in `docs/alignment.md` as an explicit, temporary gap with a reason.
```

```diff
 ### VI. Test-Driven Core
 
-Core logic is written test-first with Vitest and a deterministic mock LLM. Time and randomness are injectable, so a game with a fixed seed and fixed LLM answers replays identically.
+Core logic is written test-first with Vitest and a deterministic mock LLM. Time and randomness are injectable, so a game with a fixed seed and fixed LLM answers replays identically. Before legacy code moves into core, `tools/golden` records its behaviour as golden characterization tests, and the moved code must reproduce them.
```

```diff
 ## Amendment log
 
 - 1.0.0 (2026-11-13): initial version, adapted from the Epocha constitution without its scientific-rigor principles.
+- 1.1.0 (<date of the owner's go>): Principle I names the shared UI and the full list of ports of the umbrella spec (section 2.2) and states that requests name tiers, not models; Principle VI names the golden characterization tests of `tools/golden`. Source: FR-102 of `specs/20261113-111328-v1-port/spec.md`.
 
-**Version**: 1.0.0 | **Ratified**: 2026-11-13 | **Last Amended**: 2026-11-13
+**Version**: 1.1.0 | **Ratified**: 2026-11-13 | **Last Amended**: <date of the owner's go>
```

## What it does not change

The other principles, the documentation discipline, the workflow and the governance stay as they are. The `CLAUDE.md` part of FR-102 (the new `LlmClient` signature, the workspaces list) is a separate change to an owner-reserved file and is proposed separately, when the owner asks for it.
