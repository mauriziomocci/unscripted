STATUS: DONE (approved provisionally, D-26-5)

# Implementation Plan: WI-1 Foundation

**Branch**: `20261126-130502-wi1-foundation` (from the umbrella `20261113-111328-v1-port` at `6f0be1d`) | **Date**: 2026-11-26 | **Spec**: [`specs/20261113-111328-v1-port/spec.md`](../20261113-111328-v1-port/spec.md), sections 2, 4 and 5, with Amendments 1 and 2 applied; pointer: [`spec.md`](spec.md)

**Input**: the umbrella spec (binding; Amendment 2 prevails, then Amendment 1, then the spec text); the reference pinned by `reference-2026-11-23.md5`.

**API contract**: contract unchanged with respect to the spec in routes, statuses and error codes. WI-1 delivers the first contract (the 15 routes of FR-020, the envelope of FR-021, the request of FR-028), frozen at the WI-1 merge into `develop`. Where the spec describes a body without spelling its fields, `contracts/openapi.yaml` proposes the names (reviewed in Riccardo mode, round 1). **Two fields go beyond the spec's lists, decided provisionally by the Trinity (D-26-4) and awaiting the owner's confirmation: `symmetricRelations` on `POST` and `PUT /api/characters` (the HTTP form of FR-016's «vale per entrambi»), and `warnings` on their answers (the channel for FR-016's and FR-072's inconsistency warning).** Both are open issue OI-4.

## Summary

WI-1 turns the repository into the pnpm monorepo of A-01 and delivers the foundation every later work item stands on: the pure `packages/core` with the ports of section 2.2, the character model, the markdown parser and the archive planners; the Fastify server with the character archive, the settings and the LLM proxy over Anthropic and LM Studio, behind the security baseline of 2.6; the web app with the archive, settings and home pages, mounted from `packages/ui`; the artifact adapters proven by the same contract suites; the legacy artifact vendored and rebuilt byte for byte by a TypeScript builder; the golden harness that records the legacy island headless; the parity inventory; Docker for local and production; CI. Nothing of the game itself moves into core yet; the game stays playable in the published legacy artifact (US4, 4.7).

The technical approach (research.md, design review) has five load-bearing choices: one applier of the archive planners in core, `StoreArchive`, used by the server routes and by the artifact's `LocalArchive`, with optimistic revisions on every record a batch touches (R-18); the current character in `characters` and immutable superseded snapshots in `character_versions`, with database constraints for every invariant they can express (data-model.md); `text` with `CHECK` for every closed set, `games.environment` included (R-08); every structural rule as an ESLint guard proven red once (R-04, R-05); and the vendoring split in two, so that the files held by Q-26-1 and Q-17-2 never reach a pushed branch (R-21).

## Technical Context

**Language/Version**: TypeScript 6.0.3 (strict; pinned below 6.1 by typescript-eslint, R-03) on Node 22.23.5 (`>=22 <23`, `engine-strict`, FR-002); Python 3 only to run the reference `build.py` (FR-082): in the dev stage of the server image (pinned Alpine package, R-01) and as Python 3.12 in CI; never in the production image.

**Primary Dependencies**: Fastify 5.12.8 with `@fastify/type-provider-typebox` 6.3.0 and `typebox` 1.4.7, `@fastify/swagger` 9.9.3; Drizzle ORM 0.45.4, drizzle-kit 0.31.11, `pg` 8.23.1; zod 4.6.7; `@anthropic-ai/sdk` 1.8.0 (LM Studio through `fetch`); `uuid` 14.0.3 (v5 only); React 19.3.1, Vite 8.3.8, `@vitejs/plugin-react` 6.3.0; `acorn` 8.19.0 (golden). Full pin table and the rejected dependencies: research.md.

**Storage**: PostgreSQL 17 (`postgres:17-alpine` by digest) for the web form, every table of section 2.5 created by the WI-1 migrations; IndexedDB database `unscripted` for the artifact form (FR-051). Layout: data-model.md.

**Testing**: Vitest 5.1.0 with v8 coverage and floors per workspace (core 90%, server 80%, ui and web 70%, FR-004); Fastify `inject` and a real PostgreSQL for server integration; fake-indexeddb for `IndexedDbStore`; jsdom and Testing Library for components; Playwright 1.65.0 with axe for the pages in both themes and for the artifact smoke; `node:vm` goldens for the legacy island. Every task is test-first: the failing test is written and seen red before the code.

**Target Platform**: Docker Compose on the owner's Mac (arm64 M3) for local and production profiles, bound to `127.0.0.1`; the browser for the web app; the claude.ai artifact runtime (legacy build) for the artifact; GitHub Actions x64 for CI.

**Project Type**: web application in a pnpm monorepo: one pure library (`packages/core`), one UI library (`packages/ui`), three apps (`apps/web`, `apps/server`, `apps/artifact`), one tool (`tools/golden`).

**Performance Goals**: SC-001, every service healthy in under 3 minutes after the images are pulled; LLM concurrency at most 3 per game and 6 in total for Anthropic, 1 for LM Studio (L-01, L-02); per-tier timeouts 90 s and 30 s (LM Studio 180 s and 60 s, L-03); the status bar polls every 10 s (FR-073).

**Constraints**: byte identity of the legacy build with md5 `2374c745827c2b2e57fd6dd493d32e03` and `90f56d4a5c50ac646fba52cb2748157e` (SC-003); `dist/index.html` at most 1,700,000 bytes (FR-084); body limits 256 KB, 16 MB on archive writes (FR-044); `maxTokens` at most 8,192 main and 2,048 light, `schema` at most 32 KB; rate ceiling 120 calls per minute and spend ceiling 10 USD per day, interim and unmeasured (FR-031); goldens byte-identical across ten runs and across arm64 and x64 on Node 22 (SC-004); no secret in any browser bundle or response (FR-041).

**Scale/Scope**: one player on one machine; 58 seeded characters (16 present, 42 future); 15 routes; 59 call kinds; 3 pages (home, archive with three tabs, settings) in two locales and two themes; at least 200 parity rows (SC-005).

No `NEEDS CLARIFICATION` remains: research.md closes each question with a decision and lists the twelve UNVERIFIED API facts with the task step that verifies each.

## Constitution Check

*Gate before Phase 0 and again after Phase 1. Constitution 1.0.0 (`.specify/memory/constitution.md`).*

| Principle | Before Phase 0 | After Phase 1 design | Evidence |
|---|---|---|---|
| I. One Game, Two Forms | **CONDITIONAL**: its text names only `LlmClient` and `Store` as ports, while section 2.2 adds `ArchiveClient`, `Clock`, `Scheduler`, `Rng`, `Speech`, `Downloads` and the UI-level `Sound` | **CONDITIONAL**, unchanged: T001 (constitution 1.1.0, FR-102, 4.9) is the first commit of the branch so that no code lands under the old text; until it lands no implementation task starts. Its go is closed (OI-1, D-26-8 (provisional, Trinity, by the owner's delegation D-26-7)) | spec 4.9 "Constitution I"; every platform difference sits behind the ports (R-24); `docs/alignment.md` gains the entries FR-100 lists |
| II. Characters Are Not Scripted | PASS | PASS: WI-1 decides nothing for a character; LLM output is parsed by the server's extractor and validated by core with zod (S-05, FR-046); lint bans `dangerouslySetInnerHTML` (R-04) | FR-012, FR-046, R-04 |
| III. Three-Step Design | PASS: design-notes.md and both amendments carry the three steps and the FAQ | PASS: research.md "Design review", rewritten in round 2, separates the initial choices that contradicted the spec from the real design calls, and lists the ten defects step 2 missed and round 1 found | research.md |
| IV. Adversarial Review, Twice | PASS for the spec (amendment cycles closed CONVERGED, D-17-2, D-26-2) | PASS (planned): the code review before the merge, by a hostile reviewer, looping to CONVERGED (SC-009); the plan itself gets an adversarial review before the tasks | SC-009 |
| V. Evidence-Based Verification | PASS | PASS: every SC has a test or a measurement (traceability below); mocked boundaries proven live once (U-4, U-5); status words fixed in the closing report | traceability table |
| VI. Test-Driven Core | PASS | PASS: test-first in every task; deterministic mock LLM in goldens and contract suites; `Clock`, `Scheduler`, `Rng` and `newId` injected (A-03, R-11) | R-11, R-13, R-15 |
| VII. Secure by Default | PASS | PASS: keys only in server env (FR-032); schema on every route (FR-020); non-root, digests, health checks (FR-047); token never in a bundle (FR-041) | R-06, R-16, R-17, R-19 |
| Documentation discipline | PASS | PASS: TSDoc on exports, README.md and README.it.md together (FR-102), no AI references | plan blocks B8 |
| Development workflow | PASS | PASS: this plan is the light gate; tasks next with their own gate; merge `--no-ff` into the umbrella, then `develop`, after phase 6 (4.9) | branch strategy below |

**Gate result**: PASS for Phase 0 and Phase 1, conditional on T001 for Principle I. Implementation does not start before T001.

## Project Structure

### Documentation (this feature)

```text
specs/20261126-130502-wi1-foundation/
├── spec.md              # pointer to the umbrella spec (D6)
├── plan.md              # this file
├── research.md          # Phase 0: decisions R-01..R-24, design review, UNVERIFIED list
├── data-model.md        # Phase 1: tables, record, transitions, IndexedDB layout
├── quickstart.md        # Phase 1: run, test, build with Docker
├── contracts/
│   ├── openapi.yaml     # the 15 WI-1 routes, envelope, codes (sketch; the generated snapshot binds, FR-063)
│   └── core-ports.d.ts  # public surface of packages/core (section 2.2)
└── tasks.md             # Phase 2 (/speckit-tasks), not created by this plan
```

### Source Code (repository root)

```text
package.json                      # packageManager pnpm@12.20.0, engines node >=22 <23, root scripts (golden:record, golden:check, lint, ...)
pnpm-workspace.yaml               # packages/*, apps/*, tools/golden; catalog of shared versions; engineStrict: true (pnpm 12 ignores .npmrc engine-strict)
.nvmrc                            # 22
tsconfig.base.json                # strict base (R-03)
tsconfig.tooling.json             # puts scripts/, eslint-rules/ and the root configs under tsc -b and the lint project service
eslint.config.ts                  # boundaries, no-cycle, taste gate, guards (R-04, R-05)
.prettierrc  .prettierignore      # legacy/ excluded (FR-003)
vitest.config.ts                  # workspace projects, coverage floors, closed exclusion list (FR-004)
.gitignore                        # FR-005: keep .envs/**/*.example; add backups/
scripts/check-taste-exemptions.ts # every eslint-disable and every jscpd:ignore-start carries taste-exempt: (R-05)
eslint-rules/no-swallowed-error.ts # local rule for the catch/rethrow guard, with its RuleTester tests (R-05, V2)
scripts/generate-pack-content.ts  # vendored archpack*.js -> packages/core/src/content/*.json (pinned by a test)
.github/workflows/ci.yml  nightly.yml          # FR-103
docker-compose.local.yml  docker-compose.production.yml                  # FR-060, FR-061
compose/db/init.sql                            # creates unscripted and unscripted_test
compose/server/Dockerfile                      # dev stage (python3 and git minor-pinned, ESLINT_FLAGS set; python3 for FR-082) and prod stage, node:22.23.5-alpine by digest, non-root
compose/web/Dockerfile                         # Vite dev stage; build stage; nginx-unprivileged runtime
compose/web/nginx/default.conf.template        # default_server 444, Host $http_host, 16m on archive writes, token header
compose/web/nginx/15-session-token.envsh       # exports the token before templates render (FR-042)
.envs/.local/{server,web}.env.example  .envs/.production/{server,web}.env.example   # FR-062

packages/core/                    # @unscripted/core: lib ES2022, types [] (A-03)
├── src/index.ts
├── src/llm/                      # kinds.ts (LLM_CALL_KINDS), request.ts, errors.ts (LlmError), backoff.ts (BACKOFF_SCHEDULES),
│                                 # budget.ts (BudgetGovernor), sharedQueue.ts (P-01a shared-queue variant, race fixed)
├── src/json/extract.ts           # tolerant extractor (FR-012)
├── src/random/rng.ts             # mulberry32 (sim.js:5-11)
├── src/time/ports.ts             # Clock, Scheduler (P-05)
├── src/schema/toJsonSchema.ts    # FR-018
├── src/migrate/                  # migrate chain (S-04)
├── src/events/gameEvent.ts       # GameEvent base schema (FR-012)
├── src/store/                    # CharacterStore, GameStore types, StaleWriteError, StoreUnavailableError
├── src/archive/                  # character.ts (zod), ids.ts (FR-017), parse.ts + markdown.ts (FR-014), filters.ts, normalise.ts (editor rules, shared by UI and planners),
│                                 # planners/{create,edit,restore,delete,pack,import,pending}.ts, storeArchive.ts (R-18), generate.ts (FR-072 «✨ Genera», archfuturo.js:69-155)
├── prompts/it/archive-generate.md     # template of archGenPrompt with named placeholders (archfuturo.js:70-108), section 2.7's core/prompts/it; the single source. scripts/generate-prompt-modules.ts (root script content:generate) writes src/prompts/it/archive-generate.ts exporting it as a string literal, committed, with a drift test (R-26). Core never reads files. The oracle test runs the vendored archGenPrompt (R-25)
├── src/content/                  # archpack.json (16 present); archpack-futuro.json (42 future)
├── src/capabilities.ts           # Speech, Downloads (P-06)
├── testing/                      # @unscripted/core/testing: shared contract suites (R-15)
└── test/                         # unit tests; fixtures/characters/{presente,futuro}/*.md (FR-015)

packages/ui/                      # @unscripted/ui: React screens of both forms (A-04, FR-070)
├── src/app/                      # Shell (view state + hash), providers for ArchiveClient, LlmClient, capabilities
├── src/i18n/                     # t.ts, it.ts (source of the key type), en.ts (FR-074)
├── src/theme/tokens.css          # light and dark tokens (FR-075)
├── src/pages/home/  src/pages/archive/  src/pages/settings/
├── src/components/               # StatusBar, CharacterCard, Editor, VersionHistory, ImportDrop, ConfirmDialog, ...
└── test/

apps/web/                         # composes HttpLlmClient + HttpStore and mounts packages/ui (FR-070)
├── index.html  vite.config.ts    # allowedHosts explicit, cors false, proxy /api with the token, no changeOrigin (FR-042)
├── src/main.tsx
├── src/adapters/{httpLlmClient,httpStore}.ts
└── test/  e2e/                   # adapter suites; Playwright pages, axe both themes, widths 320-1440, 200% zoom

apps/server/                      # @unscripted/server
├── src/main.ts  src/app.ts  src/config.ts      # env-only config (FR-032)
├── src/http/{errors,security,token}.ts         # envelope (FR-021), Host/Origin/Sec-Fetch-Site (FR-043), token (FR-041)
├── src/db/{schema,pool,startup,pgCharacterStore}.ts   # Drizzle schema, advisory-lock start-up (FR-024), CharacterStore
├── src/llm/{gateway,anthropic,lmstudio,providerErrors,prices,semaphore}.ts   # FR-027, FR-028, FR-030, FR-045
├── src/settings/service.ts                     # FR-029
├── src/routes/{health,models,llm,settings,characters}.ts   # thin: schema + one service call; no ORM import (guard)
├── drizzle/                                    # generated SQL migrations (coverage-excluded)
├── config/prices.json                          # FR-030
└── test/                                       # unit, integration (real PostgreSQL), openapi.snapshot.json (FR-063)

apps/artifact/
├── legacy/                       # vendored, unchanged (FR-080): island/sim.js, three.min.js, OrbitControls.js, jspdf.umd.min.js,
│   │                             # island/live/{build.py, shell.html, mock.js, style.js, qualita.js, engine.js, ... , tests/...}
│   ├── MANIFEST.sha256           # exactly the vendored files
│   └── LICENSES                  # three.js and jsPDF MIT texts
├── src/build/buildLegacy.ts      # FR-081 (split/join, build.py order)
├── src/adapters/{artifactLlmClient,indexedDbStore,localArchive}.ts   # FR-051, FR-053, P-03b
├── dist/                         # git-ignored build output: index.html, test.html
└── test/                         # manifest, byte identity, build.py comparison, size check, kinds guard, adapter suites, smoke

tools/golden/                     # @unscripted/golden (FR-090..FR-097)
├── src/{cli,context,fakeClock,terrain,transform,mockLlm,driver,digest}.ts
├── fixtures/{setup,mock,director}/            # setup fixture, mock answers per kind, long-run director script
├── goldens/                                   # committed goldens (not data/ or build/, both git-ignored)
└── test/

docs/{parity,alignment,architecture,security}.md  docs/diary/   # FR-100, FR-101, FR-104
```

**Structure decision.** The six workspaces of A-01, exactly; no seventh. CI helpers are root scripts, not a workspace. Every adapter lives in the app that composes it (A-04, R-24); the shared contract suites live in core under a test-only subpath (R-15).

## Structural guards (each proven red once, then kept in CI)

| Guard | Mechanism | Requirement |
|---|---|---|
| Dependency direction `core <- ui <- apps`, `golden -> core` | `boundaries/dependencies`, default disallow | A-02, FR-003 |
| No import cycles | `import-x/no-cycle`; TypeScript project references between workspaces | A-02 |
| Pure core | `lib: ["ES2022"]`, `types: []` in core's tsconfig; `no-restricted-globals` (`performance`, `setTimeout`, `setInterval`, `crypto`) and `no-restricted-syntax` (`Math.random()`, `Date.now()`, argument-less `new Date()`) in core; `new Date(clock.now())` stays allowed | A-03 |
| No ORM or driver import in route handlers | `no-restricted-imports` on `apps/server/src/routes/**` | owner's architecture rule; thin edges (FR-020) |
| No legacy import outside `apps/artifact` builder and `tools/golden` | `no-restricted-imports` | A-04, A-05 |
| No `dangerouslySetInnerHTML` | `no-restricted-syntax` on the JSX attribute | S-05, FR-003 |
| Taste gate: function length 40, depth 3, complexity 10, no empty catch | ESLint core rules + exemption script | owner's taste rule (R-05) |
| Taste gate: no duplicated code | `jscpd` 5.4.3 in the lint job, non-legacy TypeScript, proven red with an injected copy | owner's taste rule (R-05, review I10) |
| Taste gate: no catch-all handler | local ESLint rule `local/no-swallowed-error` (`eslint-rules/no-swallowed-error.ts`): catch without a rethrow outside nested functions, `.catch` with a non-rethrowing or non-inline handler, `.then(_, onRejected)`; `RuleTester` valid and invalid cases; exemption only with `taste-exempt:`, `jscpd:ignore-start` included | owner's taste rule (R-05, reviews I10, N5, V2) |
| Unknown request keys refused | Ajv `removeAdditional: false`, `coerceTypes: false`; closed option objects; one misspelt-option test per write route and for `POST /api/llm` | FR-021, owner's contract rule (R-06, review N1) |
| No hidden provider retries | unit test asserting `maxRetries: 0` on the constructed Anthropic client; stub test counting one request per call | S-08, FR-028 (R-10, review I1) |
| API shape frozen | OpenAPI snapshot test | FR-063 |
| Vendored files unchanged | SHA-256 manifest test | FR-080 |
| Every call site's kind is in `LLM_CALL_KINDS` | kinds guard test over the vendored sources | FR-011 |
| Locales complete | `en satisfies typeof it` + key-set test | FR-074 |
| Invariants in the data | the CHECK, UNIQUE and FK constraints of data-model.md, each with a test that inserts a violating row | owner's architecture rule |

## Branch strategy and implementation order

No file is held back: Q-26-1 (`qualita.js`, vendored with line 26 redacted) and Q-17-2 (the 45 new sheets, published as they are) are closed by D-26-8 (provisional, Trinity, by the owner's delegation D-26-7), so the whole work item goes on one pushable branch.

**On `20261126-130502-wi1-foundation` (pushable, CI green at every commit):**

- **B0 Governance.** T001: constitution 1.1.0 (FR-102: `packages/ui`, `tools/golden`, the full port list, `Sound`, the `LlmClient` signature and tiers), version bump and amendment-log entry; done (OI-1, D-26-8 (provisional, Trinity, by the owner's delegation D-26-7)). The `CLAUDE.md` amendment of FR-102 is T002, done (OI-6, D-26-8 (provisional, Trinity, by the owner's delegation D-26-7)).
- **B1 Tooling.** Workspace, tsconfigs, ESLint with every guard (each proven red), Prettier, Vitest projects and floors, `.gitignore` (FR-005), the dev image and the `db` and `server` compose services needed to run anything (R-01).
- **B2 Core.** Kinds, errors, `Rng`, extractor, time ports, backoff schedules, budget governor, JSON Schema, migrate chain, `GameEvent`, character schema, ids, parser and serializer (present fixtures), planners, `StoreArchive`, shared-queue fallback with the race test, contract suites.
- **B3 Vendoring V1.** Every FR-080 file except `qualita.js` and `archpack-futuro.js`, with their part of the manifest and `LICENSES`; the local md5 check first (quickstart); present-pack content generation; the kinds guard test.
- **B4 Server.** Config, envelope (framework errors mapped, Ajv `removeAdditional` and coercion off, unknown keys 400), security hooks, token, schema and migrations, advisory-lock start-up, `PgCharacterStore` with the `CharacterStore` suite, character routes over `StoreArchive` with the round-2 write contract (path id, one `expectedRevision`, `symmetricRelations`, `warnings`), settings, models, `LlmGateway` with both providers (Anthropic `maxRetries: 0`, the local HTTP stub test, the transactional admission), the present seed, the OpenAPI snapshot. The `ArchiveClient` suite on `HttpStore` runs in `apps/web`'s integration tests over HTTP (R-15).
- **B5 UI and web.** UX study of the three pages signed in Riccardo mode before code (owner's interface rule). Its inputs include the Italian player texts by error code that Riccardo drafted in round 1 (`plan-review-riccardo.md`, "Player texts by code": one text per code and action, for `unauthorized`, `forbidden_origin`, `not_found` on card and on restore, `conflict` after «Salva» and after a batch action, `payload_too_large`, `invalid_request` on import, settings and «Salva», `rate_limited`, `budget`, `unavailable`, `timeout`, `unparseable`, `denied`, `model_refused`, `internal`) and the `relation_mismatch` warning text composed from the legacy toast (`archui.js:306`); the study fixes the final wording for `it` and writes `en`. The UI never shows the server's `message` (R-12). The study also words the provider indicator, which means "reachable" for both providers after the round-2 change to `available` (R-10, review N8). Then home, archive (three tabs, the «✨ Genera» buttons over core's `generateCharacter`), settings, status bar, i18n, themes, adapters; the interface gate with axe and scripted screenshots.
- **B6 Artifact adapters.** `IndexedDbStore`, `LocalArchive`, `ArtifactLlmClient`, each through its shared suite.
- **B7 Docker production and CI.** Production compose, nginx, digests; CI jobs.
- **B8 Docs.** `docs/parity.md` (at least 200 rows), `docs/alignment.md`, `docs/architecture.md`, `docs/security.md`, README.md and README.it.md together; written in the same commits as the code they describe, completed here.
- **B8b Tooling (reviews M1, N4).** The parts of B9 to B11 that need no real page, committed here so that they get CI early: `buildLegacy.ts` with synthetic fixtures (the `$'` and `$&` case, the UI cut, the substitution order) and the size check with its negative fixture; the golden harness modules (context, fake clock with the zero-argument `Date`, the 2-site transform, the mock, the driver, the Node-major refusal), with the terrain and archive-slice extractions run and hash-pinned on the real V1 `scene.js` and `archui.js`, and synthetic sources only for their failure paths; the generator oracle test of R-25 (its files are all in V1); the Playwright smoke spec, skipped with a traceable reason until `dist/test.html` exists on this branch.

**Still on the same pushable branch, after B8b:**

- **B9 Vendoring V2.** `qualita.js` with the redaction of line 26 (test over a deny-list of hashes) and `archpack-futuro.js`, the full manifest; the one-time local diff check against page `299a`; future-pack content and its seed marker; the 42 future and 3 file-only present FR-015 fixtures; the builder's real-page tests (byte identity, the `build.py` comparison in the dev image, the size check on the real page); the CI jobs that need them.
- **B10 Goldens.** The harness of B8b on the real page read from `dist/index.html` (its md5 in the header, R-13): the short run, the long run to day 8 with the director script, the kind-coverage check, the ten-run determinism test.
- **B11 Smoke.** The B8b smoke spec un-skipped and run on `dist/test.html` (island, talk show, Venture, novel), the terrain sample, and SC-007.
- **B12 Final validation (phase 6).** Full suite, end-to-end on the web app and the artifact, playtest with the mock and with the real model, the **gated manual live check of the Anthropic error mapping** (401, 404, and 429 if the account can be driven to it; only with the owner's key and go, result recorded, U-4), adversarial review to CONVERGED, 8/10 on every lens, the closing report. SC-004 on the x64 runner and the FR-103 CI evidence need no answer any more (Q-26-1 and Q-17-2 are closed by D-26-8 (provisional, Trinity, by the owner's delegation D-26-7)).

There is no held or local branch: Q-26-1 and Q-17-2 are closed by D-26-8 (provisional, Trinity, by the owner's delegation D-26-7) and everything is pushed with the rest of the work item.

## Traceability: every FR of section 4.3 and every SC

Block = where it is built (B0 to B12 above). Proof = the test or measurement that closes it.

| Req | Component | Block | Proof |
|---|---|---|---|
| FR-001 | pnpm workspace, six workspaces, strict tsconfigs | B1 | `pnpm -r typecheck`; workspace list test |
| FR-002 | `engines`, `engineStrict` in `pnpm-workspace.yaml`, `.nvmrc`, `packageManager`, dev image | B1 | install on Node 26 refused; container install passes |
| FR-003 | `eslint.config.ts`, `.prettierignore` | B1 | each guard red on an injected violation |
| FR-004 | `vitest.config.ts` projects, floors, closed exclusions | B1 | CI coverage job; SC-002 |
| FR-005 | `.gitignore` | B1 | `git check-ignore` test on an example file and a real env file |
| FR-010 | `packages/core/src/index.ts` exports | B2 | export-surface test |
| FR-011 | `src/llm/kinds.ts`; kinds guard test; server enum from the constant | B2, B3, B4 | guard over `ask('`, `tsAsk(` (8 sites, 9 kinds), `venture.js` 17 sites, `romanzo.js` 22 sites, generator site; enum equality test |
| FR-012 | `json/extract.ts`, `random/rng.ts`, `migrate/`, `events/gameEvent.ts` | B2 | unit tests; mulberry32 vectors equal `sim.js:5-11` |
| FR-013 | `archive/character.ts` | B2 | schema tests: passthrough root, prototype keys refused, new keys round-trip |
| FR-014 | `archive/parse.ts`, `archive/markdown.ts` | B2, B9 | legacy messages verbatim; age clamp fixture (parity row, WI-6) |
| FR-015 | parser fixtures | B2 (16 present), B9 (42 future, 3 file-only) | parse every sheet; round trip with secrets |
| FR-016 | `archive/planners/*`, `archive/normalise.ts` | B2 | one test per normalisation and per reason; atomic symmetric batch; normalisations and symmetric relations only with `versioned`; `relation_mismatch` warning on the legacy condition (`archui.js:306`) |
| FR-017 | `archive/ids.ts`, import and export planners | B2 | uuid v5 vector; `c_`, `f_`, empty, null, missing ids; snapshot relation rewrite; round trip |
| FR-018 | `schema/toJsonSchema.ts` | B2 | snapshot of the `probe` schema; zod pin `~4.6.7` |
| FR-020 | `routes/*`, TypeBox schemas, `StoreArchive` | B4 | route tests; guard "no ORM in routes"; body id different from path 400; store-owned keys stripped; nested legacy fields survive (four-record round trip) |
| FR-021 | `http/errors.ts` | B4 | one test per code and status; envelope on proto-poisoning and 404 |
| FR-022 | PUT and restore routes, `expectedRevision`, `mode` | B4 | 409 after an in-place update; atomic batch rollback; `symmetricRelations: true` with `inPlace` 400 |
| FR-023 | `planDelete`, soft delete | B4 | archived row hidden from list, export, pack skip rule |
| FR-024 | `db/startup.ts`, `planPack`, seed markers | B4 (present), B9 (future) | two concurrent start-ups; deleted seeded character not re-seeded; deceased, missing-`storia`, soft-deleted cases |
| FR-025 | import route, `planImport` | B4 | skip rule `updated >=`; inline versions both cases; duplicate and out-of-range `v` normalised (parity row) |
| FR-026 | export route | B4 | `archivio/1` without versions; legacy import in SC-007 |
| FR-027 | `routes/models.ts`, providers | B4 | LM Studio down gives `available: false`; context length read |
| FR-028 | `llm/gateway.ts`, `providerErrors.ts`, `anthropic.ts` | B4, B12 | one negative test per table row; `attempt` out of range 400; `in_flight` row then completed; `aborted` at start-up; `maxRetries: 0` asserted; real SDK behind a stub, one request per call; gated live check |
| FR-029 | `settings/service.ts` | B4 | caps above ceiling refused; unknown provider or model refused |
| FR-030 | `config/prices.json`, `llm/prices.ts` | B4 | model without price refused and not listed |
| FR-031 | env defaults 120 per minute, 10 USD per day | B4, B8 | config test; `docs/security.md` marks them unmeasured |
| FR-032 | `config.ts` | B4 | invalid variable stops start-up naming it |
| FR-040 | compose port bindings | B1, B7 | SC-006 compose-file test |
| FR-041 | `http/token.ts`, volume, Vite hook, nginx hook | B4, B7 | 401 without token; token absent from bundles and responses (grep the built assets) |
| FR-042 | `vite.config.ts`, nginx template | B5, B7 | unknown Host refused at the web tier; `Host` unchanged at the server; 16 MB passes nginx |
| FR-043 | `http/security.ts` | B4 | foreign Origin 403; `Sec-Fetch-Site: same-site` 403; no CORS header ever |
| FR-044 | per-route `bodyLimit`, clamps | B4 | at the limit and just above, worst-case escaping; `maxTokens` clamped; `schema` over 32 KB 400 |
| FR-045 | `llm/gateway.ts` transactional admission | B4 | rate 429 with `Retry-After`; budget 429 without; midnight in `TZ`; parallel calls at cap minus one, exactly one passes |
| FR-046 | zod before any write; core validation of answers | B2, B4 | malformed import writes nothing |
| FR-047 | Dockerfiles | B1, B7 | `USER` non-root; digests; health checks present (compose lint test) |
| FR-050 | `@unscripted/core/testing` suites | B2, B4, B5, B6 | suites green on PostgreSQL, IndexedDB, `HttpStore` (in `apps/web`, over HTTP), `LocalArchive`; P-03b's «disable» exercised through `edit` (parity note); `list()` in insertion order on both stores, with a parity row for the legacy reload order (review V1) |
| FR-051 | `indexedDbStore.ts` | B6 | database name `unscripted`; revision checked inside the transaction |
| FR-052 | `GameStore` types; `docs/alignment.md` row | B2, B8 | types compile; alignment row present |
| FR-053 | LLM client suite, `httpLlmClient.ts`, `artifactLlmClient.ts`, `sharedQueue.ts` | B2, B5, B6 | one row per classification position; the six client scenarios; the two-refusal race test |
| FR-060 | `docker-compose.local.yml` | B1, B7 | SC-001 measurement; health checks |
| FR-061 | `docker-compose.production.yml`, multi-stage images | B7 | production stack healthy; nginx serves and proxies |
| FR-062 | `.envs/**/*.example`, `backup` profile | B7 | every variable of `config.ts` present in the examples (test); dump file produced |
| FR-063 | OpenAPI snapshot test | B4 | changing a route schema fails the test |
| FR-070 | `packages/ui` pages; `apps/web` composes only | B5 | boundaries guard; `apps/web/src` holds only adapters and `main.tsx` |
| FR-071 | home page | B5 | four entries with their notes; counts per era; with and without `ARTIFACT_URL` |
| FR-072 | archive pages; `archive/generate.ts` and its template (R-25) | B2, B5, B8b | component tests per legacy feature; Italian texts equal the legacy strings; oracle test running the vendored `archGenPrompt` and `archGenParse` over the matrix of R-25 (roles, tones, sexes, trait, style, crew); labels from the locales, not from core |
| FR-073 | settings page, status bar | B5 | 10 s polling with a fake scheduler; 401 plain message |
| FR-074 | i18n | B5 | same key sets; reload in the chosen language |
| FR-075 | interface gate | B5, B12 | axe zero violations both themes; widths 320 to 1440 and 200% zoom screenshots; keyboard walk; parity rows for any departure |
| FR-080 | `apps/artifact/legacy/`, manifest, `LICENSES` | B3, B9 | manifest test names the changed file (US5 scenario 2) |
| FR-081 | `buildLegacy.ts` | B8b, B9 | synthetic fixtures including `$'` and `$&` (B8b); md5 equality on the real page, SC-003 (B9) |
| FR-082 | `build.py` comparison test in the dev image | B9 | byte equality in a temporary copy, `PYTHONUTF8=1` with `PATH` kept |
| FR-083 | Playwright smoke | B8b, B11 | island one game hour, talk show three lines, Venture two turns, novel first chapter and picky reader, no console error; `SC.groundH` grid sample |
| FR-084 | size check | B8b, B9 | negative fixture over 1,700,000 bytes fails (B8b); real page under the ceiling (B9) |
| FR-090 | `tools/golden/src/context.ts` | B8b, B10 | `QUALITY` defined and `module` undefined in the context; code read from `dist/index.html`, md5 in the header |
| FR-091 | seed, storage shim, fake clock | B8b, B10 | header seed equals `--seed` (US6 scenario 2); `TZ=UTC`; no real-clock string in the digest |
| FR-092 | `terrain.ts` (acorn) | B8b, B10 | hash pin of `scene.js`; grid equality with the smoke sample |
| FR-093 | `transform.ts` | B8b | fails unless exactly 2 sites match |
| FR-094 | `mockLlm.ts`, fixtures | B8b | ordinals consumed by retries; scripted `rate_limited` |
| FR-095 | `driver.ts` | B8b, B10 | transcribed slices of `ui.js` and `archui.js` hash-pinned; 3 s sync phase; tick order recorded; no bets asserted |
| FR-096 | setup fixture, header | B10 | header fields test |
| FR-097 | CLI, goldens | B8b, B10 | Node major refusal (B8b); short run, long run to day 8, kind coverage (B10) |
| FR-100 | `docs/parity.md`, `docs/alignment.md` | B8 | row count at least 200 (SC-005); each listed decided difference present |
| FR-101 | `docs/architecture.md`, `docs/security.md` | B8 | review against the code |
| FR-102 | constitution 1.1.0 (T001), `CLAUDE.md` (owner's go), README pair | B0, B8 | owner's go recorded; README.md and README.it.md in the same commit |
| FR-103 | `.github/workflows/ci.yml`, `nightly.yml` | B7, B9 | first green run, on all of WI-1 |
| FR-104 | `docs/diary/AAAA-MM-GG.md` | every block | diary entry per session |
| SC-001 | compose stack | B7, B12 | timed `up --build` on the owner's M3, recorded |
| SC-002 | coverage floors, negative test per route | B1, B4, B12 | CI coverage report; route-to-negative-test map |
| SC-003 | builder | B9 | md5 test |
| SC-004 | goldens | B10, B12 | ten-run test locally; arm64 goldens on the x64 runner run in CI |
| SC-004a | long golden | B10 | `G.day >= 8`; kind coverage with exemptions |
| SC-005 | `docs/parity.md` | B8 | row count test |
| SC-006 | security tests | B4, B7 | the seven checks listed in SC-006 |
| SC-007 | export into legacy `test.html` | B11 | Playwright imports the web export into `test.html` and compares characters and relations |
| SC-008 | axe | B5 | zero violations, both themes |
| SC-009 | adversarial review, quality scores | B12 | CONVERGED verdict; 8/10 per lens with `quality-scoring` |

Every FR of section 4.3 and every SC has a row; none is unplaced.

## Open issues (for the coordinator, several reserved to the owner)

- **OI-1 Go for T001 (constitution 1.1.0).** Resolved by D-26-8 (provisional, Trinity, by the owner's delegation D-26-7): 1.1.0 applied as proposed (T001 done).
- **OI-2 Q-17-2 and the hold.** Resolved by D-26-8 (provisional, Trinity, by the owner's delegation D-26-7): the 45 sheets are published as they are and nothing is held; no local branch.
- **OI-3 Q-26-1.** Resolved by D-26-8 (provisional, Trinity, by the owner's delegation D-26-7): option 2, `qualita.js` vendored with line 26 redacted, SC-003 on the vendored build, one-time local check against page `299a` recorded in the WI-1 notes; B9 to B12 run on the pushable branch with CI.
- **OI-4 (resolved, D-26-8 (provisional, Trinity, by the owner's delegation D-26-7): `symmetricRelations` and `warnings` confirmed, D-26-4).** The write contract is fixed: `CharacterInput` without store-owned keys, the path id, one `expectedRevision`, a body id different from the path answered with the existing `invalid_request`. **Two fields beyond the spec's lists:** `symmetricRelations` (boolean, default true with `mode: versioned`, false with `inPlace`, true with `inPlace` refused) on `POST` and `PUT /api/characters`, because FR-016's option cannot cross the wire otherwise and the client cannot write both relations atomically (C16 removed the batch route); and `warnings: [{ code: 'relation_mismatch', characterId, otherId, ownType, otherType }]` on their answers, because FR-016 and FR-072 require the legacy inconsistency warning and only the planner sees the stored relation. Names the plan chose, revised in round 1: `allowedModels`, `loadedModels: [{ id, contextLength }]`, `Health: { status }`, `ceilings` (kept, US2 scenario 4: the page bounds its inputs), `X-Unscripted-Token`, `characters`, `versions[].{version, at, reason, data}`, `added`, `imported`, `skipped`, `DELETE` 204. **Owner questions on names fixed by the spec, kept as they are:** the camelCase value `inPlace` of `mode` (FR-022) beside snake_case codes, and `schema` on `POST /api/llm` (P-01) beside the record's format tag `schema` (FR-013). `ARTIFACT_URL` stays out of the API (R-24).
- **OI-5 Taste-gate tool.** The gate now measures all five things (R-05, round 2: `jscpd` for duplicates, the catch-all selector). Open for the owner only: the rule names `quality_gate.py` (shared version, "never a twin"), and whether that tool should get a TypeScript mode that replaces these ESLint rules.
- **OI-6 `CLAUDE.md` update (FR-102).** Resolved by D-26-8 (provisional, Trinity, by the owner's delegation D-26-7): done as T002, with a dated backup.
- **OI-7 Scope of P-01a in WI-1.** The plan builds the shared-queue variant in core now, because the FR-053 suite asserts core's behaviour in its third column and the race test of P-01a; the island variant (`G.lightModel`, game state) arrives with WI-2, when the engine moves. To be confirmed.
- **OI-8 LM Studio context length (U-5).** If LM Studio reports only the model's maximum context, US2 scenario 3 can miss a short loaded context; verified against the owner's LM Studio in B4.
- **OI-9 Interface approval.** FR-075 departures need the owner's approval, and the owner's interface rule needs a UX study signed before code (Riccardo mode in a personal project); B5 starts with it.
- **OI-10 Unknown fields in nested objects (FR-013).** Resolved by D-26-8 (provisional, Trinity, by the owner's delegation D-26-7): unknown fields are kept at every level, not only at the root; FR-013 is reworded to match (umbrella spec); `CharacterSchema` (T047) and the round trip (T135) keep nested legacy fields. T299 records the decision.

## Complexity Tracking

| Violation | Why needed | Simpler alternative rejected because |
|---|---|---|
| Constitution I names two ports; section 2.2 has eight plus `Sound` | The spec's ports (P-03 to P-06) are binding, and they are how both forms stay equal | Keeping two ports would force archive, time and capability differences into the apps, which Principle I itself forbids; T001 amends the text instead (4.9) |
| Game tables created with no WI-1 consumer (burden of proof, not a constitution rule) | FR-024 ("all tables of 2.5") and AM2-09 (the WI-1 migrations create `games.environment`) | Creating them in WI-2 contradicts two explicit requirements; the columns are cut to what the spec names, so WI-2 decides the rest |
| In-house fake clock and i18n instead of libraries (burden of proof) | FR-095's recorded tick order; three views and two locales | The libraries add surface without a requirement, and the clock's order could not be proven equal to FR-095's (R-12, R-13) |
