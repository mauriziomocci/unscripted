# Unscripted Constitution

Unscripted is a game: free-willed AI characters on a stage the player directs. This constitution canonicalizes the non-negotiable principles that govern every spec, plan, task and code change. Where it is silent, `CLAUDE.md` applies.

## Core Principles

### I. One Game, Two Forms (NON-NEGOTIABLE)

The web app and the Claude artifact are two builds of the same game and never drift apart.

- All game rules, prompts, data models and report logic live in `packages/core`.
- Platform differences are allowed only behind the `LlmClient` and `Store` interfaces and in rendering.
- A change to core is followed, in the same work item, by rebuilding the artifact and checking it with the mock LLM.
- A feature added to one form is added to the other in the same work item, or recorded in `docs/alignment.md` as an explicit, temporary gap with a reason.

### II. Characters Are Not Scripted

Characters decide through the LLM, never through hard-coded dialogue. Code decides only the physical world, the turn order, the budgets and the rules of each environment. LLM output is untrusted data: parsed, validated against a schema, clamped, never executed or injected as HTML.

### III. Three-Step Design Process (NON-NEGOTIABLE)

Before any design document: (1) initial proposal, (2) first critical self-review with categorized findings, (3) second self-review and consolidation. Only then the spec. Every spec ends with a FAQ written in the voice of a critical reviewer.

### IV. Adversarial Review, Twice per Work Item (NON-NEGOTIABLE)

A separate reviewer with a hostile mandate reviews the spec before code is written and the code before merge. The loop (review, fix, re-review) repeats until no critical or important finding is left; the verdict is stated explicitly as CONVERGED or NOT CONVERGED.

### V. Evidence-Based Verification

Nothing is called working without evidence from the running environment. Status is reported as "verified in the running app", "tests passing, manual check pending", or "unit tests only". Every bug found in a session is fixed in that session, with a regression test.

### VI. Test-Driven Core

Core logic is written test-first with Vitest and a deterministic mock LLM. Time and randomness are injectable, so a game with a fixed seed and fixed LLM answers replays identically.

### VII. Secure by Default

Secrets live only on the server, read from environment variables. The browser and the artifact never see an API key. Every server route validates its input with a schema. Containers run as non-root, with pinned base images and health checks.

## Documentation Discipline

English everywhere except README.it.md and the Italian in-game locale. TSDoc on every exported symbol; comments explain why. README.md and README.it.md change together when setup, architecture, environments or public behavior change. No reference to AI tools in commits, comments, docs or logs.

## Development Workflow

Ideation, requirements (spec, heavy gate), architectural plan (light gate), task breakdown (light gate), implementation task by task with the 8-point review, general test of web app and artifact (heavy gate), closure with a `--no-ff` merge into `develop`. Branches are timestamped by Spec Kit. Commits follow Conventional Commits. Nothing is pushed automatically.

## Governance

This constitution supersedes conflicting directives elsewhere in the repository. Amendments are made by pull request with a version bump and an entry in the amendment log.

## Amendment log

- 1.0.0 (2026-11-13): initial version, adapted from the Epocha constitution without its scientific-rigor principles.

**Version**: 1.0.0 | **Ratified**: 2026-11-13 | **Last Amended**: 2026-11-13
