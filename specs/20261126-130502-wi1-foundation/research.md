STATUS: DONE (approved provisionally, D-26-5)

# Research: WI-1 Foundation (Phase 0)

**Spec**: `specs/20261113-111328-v1-port/spec.md` (umbrella, sections 2 and 4, with Amendments 1 and 2 applied; Amendment 2 prevails, then Amendment 1, then the spec text). **Reference**: the state pinned by `specs/20261113-111328-v1-port/reference-2026-11-23.md5`, in `../unscripted-reference/2026-11-17/`. Every `file:line` below refers to that state.

**Method.** Versions come from the registry read of 2026-11-26 (npm registry JSON, Docker registry manifest HEAD, nodejs.org index; aged cutoff: published on or before 2026-11-12), kept in the coordinator's scratch note `wi1-versions.md`. APIs were checked with the context7 documentation index on 2026-11-26 for: the Fastify TypeBox provider, Vite 8.3.5 server options, Drizzle 0.45.4 migrations, zod 4.6.7 JSON Schema, eslint-plugin-boundaries 7.4.4, eslint-plugin-import-x `no-cycle`, and the LM Studio REST API. Peer dependencies of `eslint-plugin-import-x`, `eslint-import-resolver-typescript`, `eslint-plugin-boundaries` and `uuid` were read from the registry the same day. Anything not checked one of these ways is marked **UNVERIFIED** and is collected in the last section, each item with the task step that must verify it.

The Technical Context of `plan.md` had no `NEEDS CLARIFICATION` left after this research; each decision below closes one question the template asks or one conflict the version read found.

## Pinned versions

| Package or image | Pin | Why this one |
|---|---|---|
| Node | 22.23.5 (`.nvmrc` 22, `engines.node >=22 <23`, `engine-strict`) | FR-002; latest 22 LTS patch older than 14 days |
| pnpm | 12.20.0 (`packageManager`) | FR-002; latest aged 12.x. Installed in the images with `npm i -g pnpm@12.20.0`, because the host has no corepack |
| typescript | 6.0.3 | typescript-eslint 8.72.2 peers `typescript <6.1.0`; 7.x would lose type-aware lint (R-03) |
| eslint / typescript-eslint | 10.14.0 / 8.72.2 | FR-003; flat config only |
| eslint-plugin-boundaries | 7.4.3 | A-02 boundaries (R-04) |
| eslint-plugin-import-x + eslint-import-resolver-typescript | 4.18.1 + 4.4.5 | A-02 cycles (R-04); peer `eslint ^8.57 \|\| ^9 \|\| ^10` read from the registry |
| eslint-plugin-react-hooks | 7.1.1 | hooks rules for `packages/ui` |
| prettier | 3.10.1 | FR-003 |
| vitest + @vitest/coverage-v8 | 5.1.0 + 5.1.0 | FR-004; the two must be equal |
| zod | 4.6.7 | FR-013, FR-018 (major pinned: `~4.6.7`, R-09) |
| fastify | 5.12.8 | FR-020 |
| @fastify/type-provider-typebox + typebox | 6.3.0 + 1.4.7 | FR-020; the provider peers the new `typebox` 1.x package, not `@sinclair/typebox` (R-06) |
| @fastify/swagger | 9.9.3 | FR-063 OpenAPI generation |
| drizzle-orm + drizzle-kit + pg (+ @types/pg) | 0.45.4 + 0.31.11 + 8.23.1 | 2.5, FR-024 (R-07); no 1.0 beta |
| @anthropic-ai/sdk | 1.8.0 | L-01 "official SDK"; 1.14.0 is too new |
| uuid | 14.0.3 | FR-017 uuid v5 (R-11); zero dependencies |
| react + react-dom | 19.3.1 | stack |
| vite + @vitejs/plugin-react | 8.3.8 + 6.3.0 | stack; plugin-react 6 peers Vite 8 only |
| tsx | 4.23.15 | FR-060 `tsx watch` |
| jsdom + @testing-library/react | 31.0.0 + 16.3.3 | UI component tests (FR-004 floors for `packages/ui`, `apps/web`) |
| fake-indexeddb | 6.2.8 | FR-050, FR-051 |
| @playwright/test | 1.65.0 | FR-075, FR-083 |
| axe-core + @axe-core/playwright | 4.14.0 + 4.14.0 | FR-075, SC-008 (MPL-2.0, dev only) |
| acorn | 8.19.0 | FR-092 AST extraction |
| @types/node | latest 22.x patch | server, tools and test files only; never in `packages/core` (A-03) |
| postgres image | `postgres:17-alpine@sha256:<digest>` | FR-060; digest re-read on the day the Docker task runs (R-19) |
| node image | `node:22.23.5-alpine@sha256:<digest>` | FR-061; the tag names the patch, the digest pins it |
| nginx image | `nginxinc/nginx-unprivileged:stable-alpine@sha256:<digest>` | FR-061 |
| Playwright image | `mcr.microsoft.com/playwright:v1.65.0-noble@sha256:<digest>` | dev-loop browsers in a container (R-19); digest UNVERIFIED |

Rejected on the burden of proof (no requirement needs them): `@fastify/rate-limit` (FR-045 computes the limit from `llm_calls`; a second limiter would be a parallel twin), `@fastify/helmet` and `@fastify/cors` (no CORS headers are ever sent, FR-043; no requirement asks for other headers), `@fastify/static` (Vite serves in local, nginx in production), `openai` (L-02 needs two endpoints, plain `fetch` is enough), `idb` (two object stores, raw IndexedDB with a few promise helpers), `i18next` (R-12), a router library (R-12), `testcontainers` (the compose PostgreSQL serves the tests, R-19), `@sinonjs/fake-timers` (R-13), `dependency-cruiser` (R-04). Added in round 2 as a guard: `jscpd` 5.4.3 (R-05).

## Decisions

### R-01 Dev loop in containers, Node 22

- **Decision.** Every `pnpm` command runs in the `server` container of `docker-compose.local.yml` (`docker compose -f docker-compose.local.yml run --rm server pnpm ...`), whose image is `node:22.23.5-alpine` with pnpm 12.20.0 installed globally. Browser tests run in a separate `e2e` service on the Playwright image. A host Node 22 stays optional (FR-002).
- **Rationale.** The host has Node 26 and no corepack (FR-002, 4.6); `engine-strict` refuses Node 26 by design, so the containers are the only path that satisfies FR-002 without touching the host.
- **Alternatives.** nvm on the host (needs the owner's go, FR-002); running Vitest on Node 26 (vitest 5.1.0 accepts it, but the golden refuses another major, FR-097, and `engine-strict` blocks install).
- **Round 2 (review I8).** The dev stage of `compose/server/Dockerfile` installs `python3` from Alpine with a pinned package version (read on the day of the Docker task), so FR-082 runs where every other command runs; the production stage does not have it. The comparison test spawns Python with `{ ...process.env, PYTHONUTF8: '1' }`, never a bare `env`, which would drop `PATH`.

### R-02 pnpm 12 workspace

- **Decision.** `pnpm-workspace.yaml` lists `packages/*`, `apps/*` and `tools/golden` (A-01 names exactly six workspaces, so CI scripts live in a plain root `scripts/` folder, not a workspace); versions shared by several workspaces live in the workspace `catalog:`; `packageManager: "pnpm@12.20.0"`.
- **Rationale.** One version per dependency across workspaces (DRY of versions). pnpm 12 is a new major: its default for dependency build scripts and the exact catalog syntax are **UNVERIFIED**; the first tooling task runs `pnpm install` in the container and fails on any ignored-build-script warning, which it resolves by an explicit allow-list in `pnpm-workspace.yaml`.
- **Alternatives.** npm or yarn workspaces (FR-001 names pnpm).
- **Round 2 (review M6).** `server` and `web` run on Alpine (musl) and `e2e` on the Playwright image (glibc) over one `node_modules`; `pnpm-workspace.yaml` sets `supportedArchitectures: { os: [linux], cpu: [arm64, x64], libc: [musl, glibc] }` so that Vite's and Rolldown's native bindings exist for both. The Node major of the Playwright image must be 22 for `engine-strict`; it is added to U-10.

### R-03 TypeScript 6.0.3, strict, project references

- **Decision.** One `tsconfig.base.json` (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `moduleResolution: "bundler"`), one `tsconfig.json` per workspace with `references`. `packages/core` sets `lib: ["ES2022"]` and `types: []` (A-03), so a DOM or Node global in core is a compile error. `legacy/` is excluded everywhere (FR-003).
- **Rationale.** typescript-eslint 8.72.2 caps TypeScript below 6.1 (registry peer). `types: []` turns A-03 from a review rule into a compiler guard. Project references also make a cycle between workspaces a build error, a second guard for A-02.
- **Alternatives.** TypeScript 7.0.2 without type-aware lint (loses `no-floating-promises`, which S-01 needs); per-package configs without a base (duplication).

### R-04 Lint, boundaries and cycles (A-02, FR-003)

- **Decision.** One root `eslint.config.ts` (flat config):
  - `eslint-plugin-boundaries` with element types `core`, `ui`, `app-web`, `app-server`, `app-artifact`, `golden`, and the rule `boundaries/dependencies` (`default: "disallow"`): `ui` may import `core`; `app-*` may import `ui` and `core`; `golden` may import `core`; `core` may import nothing of the repository. The rule name and its `policies` shape are verified on the 7.4.4 documentation; the pin is 7.4.3.
  - `import-x/no-cycle` from `eslint-plugin-import-x`, with `eslint-import-resolver-typescript` as `import-x/resolver-next`. `no-cycle` ignores type-only imports (verified in its source), which is what A-02 means: a cycle is a runtime problem.
  - `no-restricted-syntax` banning the JSX attribute `dangerouslySetInnerHTML` (S-05, FR-003). No React lint plugin is added for this, a selector is enough.
  - **Guard "no ORM query in a route handler".** `no-restricted-imports` on `apps/server/src/routes/**` forbids `drizzle-orm`, `drizzle-orm/*`, `pg` and `**/db/**`. Route handlers receive services through an injected, typed `deps` object, so they cannot reach the database except through a service.
  - **Guard "no game rule outside core".** `no-restricted-imports` on `apps/*/src/**` and `packages/ui/src/**` forbids importing `apps/artifact/legacy/**`.
  - `apps/artifact/legacy/**` is ignored by ESLint, Prettier and `tsc` (FR-003).
  - Each guard is proven red once by an injected violation in its task (a test fixture file the guard test lints with the ESLint Node API), then reverted.
- **Rationale.** FR-003 and A-02 name ESLint, so the guard must be an ESLint rule. `eslint-plugin-import` 2.32.0 peers ESLint up to 9 only; `eslint-plugin-import-x` 4.18.1 peers ESLint 10 (registry).
- **Alternatives.** `dependency-cruiser`, one tool for boundaries and cycles: rejected because FR-003 names ESLint and it would be a second configuration of the same rule set. TypeScript project references alone: they catch cycles between workspaces only, not inside one.
- **UNVERIFIED.** Whether `eslint-plugin-boundaries` 7.x resolves TypeScript paths through the `import-x/resolver-next` setting or needs its own `import/resolver` setting (it depends on `eslint-module-utils` and `eslint-import-resolver-node`, registry). The tooling task proves the guard red with a real `core -> ui` import before relying on it.
- **Round 2 (review M5, U-3 answered).** The boundaries 7.4.4 documentation resolves through `settings['import/resolver'].typescript`, while `import-x` uses `import-x/resolver-next`; the config sets both, to the same `eslint-import-resolver-typescript`. The injected-violation proof stays.

### R-05 Mechanical taste gate (owner's rule; FR-103 CI)

- **Decision.** The lint job measures, on every non-legacy TypeScript file (everything in WI-1 is new code, so "changed files" is every file):
  - **length, depth, complexity:** ESLint core `max-lines-per-function` (40, blank lines and comments skipped), `max-depth` (3), `complexity` (10), `max-nested-callbacks` (3);
  - **swallowed errors:** `no-empty` (empty catch included), `@typescript-eslint/no-floating-promises`, and one local rule, `local/no-swallowed-error`, in `eslint-rules/no-swallowed-error.ts` (about 30 lines, loaded as a local plugin by `eslint.config.ts`; an esquery selector cannot exclude nested functions, review V2). It walks a `catch` body and stops at function boundaries, reporting the catch when no `throw` is reached. It also reports a `.catch(handler)` whose inline handler does not rethrow, a `.catch(fnRef)` whose argument is not an inline function (the body cannot be checked), and a `.then(onFulfilled, onRejected)` with a second argument. It is proven with ESLint's `RuleTester`:
    - *valid:* a catch that rethrows; a catch that rethrows after logging; a `.catch((e) => { throw map(e); })`;
    - *invalid:* a catch that returns `null`; a catch whose only `throw` sits inside a nested function; `.catch(() => null)`; `.catch(swallow)`; `.then(ok, onRejected)`.
  - **duplicates:** `jscpd` 5.4.3 (2026-11-08, MIT) on non-legacy TypeScript, ignoring `legacy/`, generated migrations and fixtures, threshold 0 clones over 10 lines and 70 tokens (starting values; the task records the first measurement and justifies the threshold in writing), proven red with an injected copy.
  - **exemptions:** only `// eslint-disable-next-line <rule> -- taste-exempt: <reason>` and `// jscpd:ignore-start taste-exempt: <reason>`; `scripts/check-taste-exemptions.ts` fails CI on every `eslint-disable*` directive, whatever the rule (a bare disable of `boundaries/dependencies` would otherwise switch off an architecture guard), and on any `jscpd:ignore-start`, that lacks `taste-exempt:`. A catch that maps an error to a typed result uses this exemption, so every such site is visible in review.
- **Rationale.** These are the language's equivalents of the five measurements the owner names (function length, nesting, complexity, catch-all handlers, duplicates). They are guards, so the burden-of-proof rule does not apply to `jscpd`.
- **Open (OI-5).** The owner's rule names `quality_gate.py` (shared version, "never a twin"), which measures Python with ruff; whether it should get a TypeScript mode that replaces these rules is the owner's call.

### R-06 Server framework and schemas (FR-020, FR-021, FR-063)

- **Decision.**
  - Fastify 5 created with `.withTypeProvider<TypeBoxTypeProvider>()` at construction (verified: the provider must be applied at creation); schemas built with `import { Type } from 'typebox'` (verified); Fastify's default Ajv validator, with `ajv.customOptions = { removeAdditional: false, coerceTypes: false }`. Fastify's baseline is `removeAdditional: true` and `coerceTypes: 'array'` (verified in its documentation): the first would silently drop a misspelt option (an old `symmetric: false` would vanish and `symmetricRelations` would default to true), the second would turn `tags: "x"` into `["x"]` before zod. With both off, an unknown key in a closed object and a wrong type are 400 `invalid_request`. This must hold before the freeze: the owner's contract rule makes a server that tolerated a field once tolerate it for good.
  - **Closed and open objects.** Every request option object is closed (`additionalProperties: false`): the bodies of `POST` and `PUT /api/characters`, restore, `PUT /api/settings` and `POST /api/llm`, and their nested option objects. Character records are open at every level (`CharacterFields`), because FR-013 requires unknown fields to pass through; archive files are open at the root and in `chars[]`. One negative test per write route and one for `POST /api/llm` send a misspelt option and expect 400.
  - **One definition of the record.** The character schema of the routes is derived from core's zod `CharacterSchema` with `z.toJSONSchema(..., { target: 'draft-07' })` and wrapped with `Type.Unsafe` (present in `typebox` 1.4.7, verified in round 1); nested values are declared loosely, because Fastify's response serializer drops undeclared properties at every level, not only at the root. The round-trip test runs four real records (data-model.md "Nested objects are open") through `POST`, `GET`, `GET .../versions` and the export with deep equality.
  - **Write contract** (D-26-4): `CharacterInput` has no store-owned keys; the path gives the id; `expectedRevision` is the only revision; a body id that differs from the path is 400; `symmetricRelations` and the editor's normalisations apply only to `mode: versioned` (default true there, false with `inPlace`, true with `inPlace` is 400); the write answers carry `warnings` (code `relation_mismatch`, the two ids, the two types) for the legacy toast of `archui.js:306`.
  - **One error envelope.** One `setErrorHandler` and one `setNotFoundHandler` map every framework error to the closed list of FR-021: malformed JSON, empty JSON body, unsupported media type (Fastify's 415) and `__proto__` or `constructor` keys become 400 `invalid_request`; `prototype` is refused by zod; each case has a test. Per-route `bodyLimit` serves FR-044.
  - `LLM_CALL_KINDS` gives the `kind` enum as a union of literals; `@fastify/swagger` generates the OpenAPI document, compared with `apps/server/test/openapi.snapshot.json` (FR-063).
- **Rationale.** One owner for the record (zod in core), one for the envelope, refusal instead of silent repair at the edge.
- **Alternatives.** A hand-written TypeBox character schema (a second definition of the record); `TypeBoxValidatorCompiler` (no requirement); keeping Fastify's Ajv defaults (silent stripping, rejected above).
- **UNVERIFIED.** `@fastify/swagger` 9 with `typebox` 1.x schemas (U-2); the route option `bodyLimit` and its error code in Fastify 5.12 (U-9). Both are checked by the first route task with a failing test.

### R-07 PostgreSQL access, migrations and the advisory lock (2.5, FR-024)

- **Decision.** `pg` 8 with a `Pool` for requests and one dedicated `Client` for start-up. Start-up sequence on that client: `SELECT pg_advisory_lock($1)` with a fixed 64-bit constant, Drizzle `migrate()` from the generated SQL folder `apps/server/drizzle/`, the two seeds (FR-024, R-18), mark `in_flight` rows `aborted` (FR-028), `pg_advisory_unlock`, close. Only after that does `/api/health` answer 200. Drizzle is used for the schema definition and the migrations; queries are written with the Drizzle query builder inside the store and service modules only.
- **Rationale.** An advisory lock is held by a session, so it must be taken and released on the same connection; a pool could run the unlock on another connection. The Drizzle documentation (0.45.4) runs migrations on a separate single-connection client for the same reason (verified for the postgres.js driver).
- **Alternatives.** `postgres` (postgres.js): works, but the plan needs one driver and `pg` is Drizzle's most common pairing; migrations through `drizzle-kit migrate` at deploy time: FR-024 wants them at start-up under the lock.
- **UNVERIFIED.** The import path `drizzle-orm/node-postgres/migrator` (the postgres.js one, `drizzle-orm/postgres-js/migrator`, is verified) and whether `migrate()` accepts a `drizzle({ client })` built on a single `Client`. The migration task proves it with two concurrent start-ups against one database (edge case "two server instances").
- **Round 2.** The import path `drizzle-orm/node-postgres/migrator` is verified in the Drizzle documentation (round-1 review); the single-`Client` use stays UNVERIFIED (U-1) and is proven by the two-start-ups test.

### R-08 Type of `games.environment` (2.5, AM2-09)

- **Decision.** `text NOT NULL` with `CHECK (environment IN ('island', 'talkshow', 'venture', 'novel'))`. The same pattern for every closed set in the schema (`records.environment`, `llm_calls.outcome`, `llm_calls.provider`, `llm_calls.tier`).
- **Rationale.** Removing a value must stay one migration (2.5). With a CHECK, it is one `ALTER TABLE ... DROP CONSTRAINT, ADD CONSTRAINT` plus the data step for rows that hold it; with a PostgreSQL enum, a value cannot be dropped, the type has to be recreated and every column cast. Adding a value is one migration either way.
- **Alternatives.** PostgreSQL enum (`design-notes.md:67`): rejected for the reason above. A lookup table with a foreign key: one more table and join for four constant values.

### R-09 zod 4 and JSON Schema (FR-013, FR-018, L-02)

- **Decision.** zod `~4.6.7` (major and minor pinned, FR-018). Core serializes schemas with the built-in `z.toJSONSchema` (verified in 4.6.7; default target draft 2020-12, `target: 'draft-07'` available). `LlmRequest.schema` carries draft 2020-12; the server's route schemas use draft-07 for Ajv. No `zod-to-json-schema` package.
- **Rationale.** The conversion is built in, so no dependency is added.
- **Alternatives.** `zod-to-json-schema` (zod 3 era).
- **UNVERIFIED.** Which JSON Schema subset LM Studio's `response_format: json_schema` accepts (L-02); WI-1 sends a schema only on the `probe` call, whose schema is a two-field object, so the risk is contained to WI-2.

### R-10 Providers (L-01, L-02, L-03, FR-027, FR-028)

- **Decision.**
  - **anthropic:** `@anthropic-ai/sdk` 1.8.0, constructed with `maxRetries: 0`, because the SDK retries 408, 409, 429 and 5xx by default and those hidden calls would bypass S-08 and `llm_calls`; a unit test asserts the option on the constructed client. `messages.create` with the model of the tier from the settings, `max_tokens` clamped (FR-044), an `AbortSignal` with the tier timeout (L-03). Failures are mapped to the closed table of FR-028 by one function, `mapProviderError`, reading `status`, `error.type` and, when present, `error.details.error_code`.
  - **lmstudio:** plain `fetch` to `${LMSTUDIO_BASE_URL}/chat/completions`, with `response_format: { type: 'json_schema', ... }` when a schema is given. The loaded models and their context length come from LM Studio's `GET /api/v0/models` (the base URL with `/v1` replaced by `/api/v0`), filtered on `state === 'loaded'`, reading `max_context_length` (a verified field). One call at a time (L-02).
  - **Both:** the core tolerant JSON extractor (FR-012) turns the text into `value`; no JSON gives `unparseable`.
  - **Availability** (`GET /api/models`): lmstudio is available when `GET /api/v0/models` answered within the poll timeout. Anthropic is available when a key is configured, at least one allowed model has a price, and the last `models.list` probe succeeded. The probe runs in the background, at most once a minute, with a 5 s timeout, and only while `anthropic` is the selected provider (also once when the settings page asks for the models). The route always answers from the cached value and never waits for it, so the 10 s status poll cannot hang (FR-073). The probe spends no tokens and writes no `llm_calls` row; with LM Studio selected nothing is sent to Anthropic, as the spec FAQ promises. `docs/security.md` records this outbound request (reviews N8, V3). The B5 UX study confirms how the status bar words it.
  - **Verification of the boundary.** The negative tests run the real SDK against a local HTTP stub that answers 429, 401 and 404 and counts requests, so exactly one request per call is proven, not assumed from faked objects. A live check with the owner's key (401 with a wrong key, 404 with an unknown model, 429 if the account can be driven to it) is a gated manual step of B12, run only with the owner's key and go, its result recorded.
- **Rationale.** L-01 names the official SDK; L-02 says OpenAI-compatible, which two endpoints cover without a client library.
- **UNVERIFIED.** The 1.x error fields beyond the stub (U-4, closed by the live check); `models.list` in SDK 1.8.0 (if missing, a `GET /v1/models` through the SDK's raw request); whether `max_context_length` is the loaded context or only the model's maximum (U-5): if only the maximum, US2 scenario 3 can miss a model loaded with a short context. The settings task checks it against the owner's LM Studio and records the answer in `docs/architecture.md`.

### R-11 Character ids (FR-017)

- **Decision.** uuid v5 through `uuid` 14.0.3 (`v5(legacyId, LEGACY_ID_NAMESPACE)`), with `LEGACY_ID_NAMESPACE` a tested constant in core. Fresh ids are not generated in core: the archive operations receive `newId: () => string` with the `Clock` (P-05), and each form passes `crypto.randomUUID` (browser and Node 22 both have it). The uuid test vector of the namespace is committed, so a change of the constant fails.
- **Rationale.** A-03 forbids randomness that is not injected; a fresh uuid is randomness. v5 is a pure function, so a zero-dependency library is cheaper than a hand-written SHA-1 (burden of proof: reuse before writing).
- **Alternatives.** A SHA-1 written in core (about 60 lines, new code to test); `crypto.randomUUID` called inside core (breaks A-03 and needs DOM or Node types).
- **UNVERIFIED.** That `uuid` 14's v5 is synchronous and needs no Web Crypto or Node `crypto` in the bundle the artifact will use (WI-6). If it does, the fallback is the hand-written SHA-1, behind the same function.

### R-12 UI stack, i18n, navigation, themes (FR-070 to FR-075)

- **Decision.** React 19 function components in `packages/ui`; plain CSS with custom properties for the theme tokens, light and dark through `prefers-color-scheme` plus a `data-theme` override; no CSS framework. Navigation is a view state in the app shell mirrored to `location.hash` (three views: home, archive, settings), no router. i18n is an in-house `t(key, params)` over two locale objects; `it` is the source of the key type and `en` must `satisfies` it, so a missing key is a compile error, and the FR-074 test also compares the key sets at run time. Plural and count texts are functions in the locale.
- **Rationale.** Three views and one locale pair do not need a router or an i18n library (burden of proof). The legacy Italian texts are copied verbatim into `it` (FR-072).
- **Alternatives.** react-router, i18next 27.1.1: rejected as above; they can be added later if a WI needs them.
- **Round 2 (Riccardo F2; D-26-4 point 2).** The server's `error.message` is English diagnostic text for developers and logs; the UI never shows it and picks its own `it` and `en` text by `code` and by the action the player took. The Italian player texts by code that Riccardo drafted are an input of the B5 UX study, listed there in plan.md, not contract. The editor runs the same core normalisation function the planner runs before «Salva» (imported, not copied), and the settings page bounds the caps with `ceilings`, so a 400 that reaches the player signals a defect, not a typing mistake.

### R-13 Golden harness (FR-090 to FR-097)

- **Decision.** `tools/golden` runs in Node 22 with `node:vm`, one fresh context per run; the code comes from the FR-081 builder's output (no second assembler). It installs, before SIM runs: `window.ISLAND_RANDOM = true`, a `Math.random` replacement from core's seeded `Rng`, a storage shim holding `isola-island-seed` and `isola-island-size` (`sim.js:28-31`), and an in-house fake clock (`Date.now`, `performance.now`, `setTimeout`, `setInterval`, `clearTimeout`, `clearInterval`) that fires due timers one at a time in due order with a full microtask drain after each (FR-095 tick order). The terrain functions come from `scene.js:50-75` through an `acorn` AST, pinned by the vendored file's hash (FR-092). The two `SAMPLE.json` sites (`engine.js:19, 21`) receive `kind` through an in-memory string transform that must match exactly 2 sites (FR-093). The golden refuses to run when `process.versions.node`'s major differs from the header's (FR-097).
- **Rationale.** The tick order is a requirement written step by step in FR-095, recorded in the header; an in-house clock of a few dozen lines makes that order exact and inspectable. The `Rng` algorithm is the legacy `rngFrom`, mulberry32 (`sim.js:5-11`), so FR-012's "same algorithm the golden harness uses" holds by construction: the harness imports it from core.
- **Alternatives.** `@sinonjs/fake-timers`: a proven library, but its `tickAsync` ordering of microtasks between timers is not the ordering FR-095 states, and proving it equal would cost more than writing the clock (UNVERIFIED claim about sinon, so the cheaper path is the one that can be proven by its own tests). A JSDOM page: FR-090 forbids a DOM.
- **Determinism risk.** SC-004 requires arm64 goldens to pass on x64. `Math.sin`, `Math.exp` and friends are not guaranteed bit-identical across V8 builds; this is exactly what SC-004 measures, and it runs in CI (R-21).
- **Round 2 (reviews M2, M3).** Three determinism inputs that FR-095 states and R-13 left out: the process runs with `TZ=UTC` (`archSyncGame` formats with `toLocaleDateString('it-IT')`, `archui.js:143`); the first `archSyncGame` fires 3 s of fake time after `newGame`; the DOM-free archive functions of `archui.js:142-159, 183-187` are extracted by `acorn` from the vendored file and pinned by the hash of their source slices, like the terrain. The fake clock also replaces the argument-less `Date` constructor in the context (a subclass whose zero-argument form reads the fake `now`), and a test asserts that the digested state holds no string produced by the real clock. On A-02: `tools/golden` imports only `core`; it reads `apps/artifact/dist/index.html` from disk, the `golden:*` scripts run the artifact build first, and the header records that file's md5. It never imports the builder.

### R-14 Legacy builder (FR-081, FR-082, FR-084)

- **Decision.** `apps/artifact/src/build/buildLegacy.ts` reproduces `build.py:1-12` step by step: read `shell.html`; replace `/*__SIM__*/`, `/*__SCENE__*/`, `/*__ENGINE__*/`, `/*__UI__*/` in that order, the UI value being `ui.js` cut at the last `})();` of its right-trimmed text followed by the 15 files of `build.py:4` joined by `\n` and the closing `\n})();\n`; then `/*__STYLE__*/` with `style.js + '\n' + qualita.js` (`build.py:5`); then `/*__ENV__*/` with `env.js`, `features.js`, `fun.js` (`build.py:6`); write `index.html` (the legacy `live.html`); then the three URL rewrites and the mock injection of `build.py:9-11` for `test.html`. Every replacement is `split(token).join(value)` (FR-081), never `String.prototype.replace`. Files are read and written as UTF-8.
- **Two traps found.**
  1. Python 3 reads text files with the locale's encoding; 25 of the vendored sources contain non-ASCII bytes (measured with `grep` on the pinned folder). On a runner whose locale is not UTF-8, `build.py` would fail or write different bytes. The FR-082 test runs `python3` with `PYTHONUTF8=1`.
  2. Python's text mode turns `\r\n` into `\n` on read. None of the pinned files contains `\r` (measured), so the builder does not normalise line ends; the manifest (FR-080) guarantees no CR can arrive later unnoticed.
- **Rationale.** SC-003 is a byte comparison against two published md5 values; the builder must be the same algorithm, and the FR-082 test runs `build.py` itself in a temporary copy as the second oracle.
- **Alternatives.** Keeping `build.py` in the pipeline: rejected by the spec's FAQ (one toolchain).

### R-15 Where the shared contract suites live (FR-050, FR-053)

- **Decision.** The suites are functions in `packages/core/testing/` (outside `src/`, exported as the subpath `@unscripted/core/testing`), each taking a factory: `describeCharacterStore(name, makeStore)`, `describeArchiveClient(name, makeClient)`, `describeLlmClient(name, makeClient)` (the names tasks.md T088, T090, T097 and T100 use). They import `vitest`, a dev dependency of every workspace. Where each runs:
  - `apps/server` tests: the `CharacterStore` suite on `PgCharacterStore`, and the `ArchiveClient` suite on `StoreArchive` over it;
  - `apps/web` integration tests: the `ArchiveClient` suite on `HttpStore` against a server reached over HTTP (the compose `server` in local and CI, started through its own CLI entry), with the token added by a test `fetch` wrapper that plays the web tier; the LLM suite on `HttpLlmClient`;
  - `apps/artifact` tests: both archive suites on `IndexedDbStore` (fake-indexeddb) and `LocalArchive`; the LLM suite on `ArtifactLlmClient`.
  No test imports one app from another, so the boundaries guard needs no test exemption.
- **Rationale.** One suite per port is the proof that the two forms are equal (P-03b); outside `src/` it does not count toward core's coverage or purity rules.
- **Alternatives.** A seventh workspace `packages/contracts`: one more moving part, and A-01 fixes the workspace list.

### R-16 Session token (FR-041, FR-042, C7)

- **Decision.** The server generates 32 random bytes (hex) at first start when `/run/unscripted/token` is missing, writes it with mode 0644 into the named volume `session-token`, mounted read-write in `server` and read-only in `web`. The header is `X-Unscripted-Token`, compared with `crypto.timingSafeEqual`. Every route except `GET /api/health` requires it (401 `unauthorized`). The Vite dev proxy adds it in its `proxyReq` hook, reading the file on each request (so a regenerated token is picked up); nginx gets it from an entrypoint hook in `/docker-entrypoint.d/` that exports it before the template step renders `proxy_set_header X-Unscripted-Token`.
- **Rationale.** FR-041 and C7. Mode 0644 inside a volume mounted only into the two containers is what "readable by both non-root users" needs when the two images run as different uids (node 1000, nginx-unprivileged 101).
- **UNVERIFIED.** That the `nginx-unprivileged` entrypoint sources `*.envsh` hooks so that an exported variable reaches the template step; the `proxyReq` event of Vite 8's `http-proxy-3` (the `configure` option is verified, the event name is not). The Docker task proves both with the 401 test of SC-006 run through each web tier.

### R-17 Host, Origin and fetch-metadata checks (FR-042, FR-043, SC-006)

- **Decision.** Server: one `onRequest` hook, run before routing, that (1) refuses a `Host` whose hostname is not in `ALLOWED_HOSTS` (default `localhost,127.0.0.1,server`, plus any `*.localhost`), (2) refuses an `Origin` not in `ALLOWED_ORIGINS`, (3) refuses a `Sec-Fetch-Site` other than `same-origin` or `none`; all three answer 403 `forbidden_origin`. A request without `Origin` and without `Sec-Fetch-Site` (the compose health check, curl, the tests) passes these checks and still needs the token. Vite: `server.allowedHosts` explicit (`['localhost', '.localhost']`), `server.cors: false`, no `changeOrigin`. The Vite 8.3.5 documentation confirms that the default `cors` allows localhost origins and that IP addresses are allowed by default whatever `allowedHosts` says (both verified), which is why the server-side Host check stays the authority. nginx: a `default_server` returning 444, `proxy_set_header Host $http_host`, `client_max_body_size 16m` on the archive write locations (FR-042, FR-044).
- **Rationale.** Each control has one job (spec FAQ); the server never trusts the web tier alone.

### R-18 One applier of the archive planners (P-03a, P-03b, C16)

- **Order (review V1).** `CharacterStore.list()` returns insertion order (`seq`, data-model.md) on both stores, asserted by the FR-050 suite, because the export and the generator's crew list iterate it; the legacy reload order (legacy id key order) is a parity row.
- **Decision.** Core holds the pure planners (`planCreate`, `planEdit`, `planRestore`, `planDelete`, `planPack`, `planImport`, plus pending-relation resolution) and one store-agnostic class `StoreArchive implements ArchiveClient`, which reads the current records from any `CharacterStore`, runs a planner, and calls `store.apply(batch)` once. Every write in a batch carries the revision the planner read, for the edited character and for every other character it touches, so a concurrent change anywhere in the batch makes the whole batch throw `StaleWriteError`, and nothing is written. The server's route handlers call `StoreArchive` over `PgCharacterStore`, whose `apply` is one transaction of conditional updates (`UPDATE ... WHERE id = $1 AND revision = $2`, a row count of 0 rolls back and throws). `LocalArchive` is `StoreArchive` over `IndexedDbStore`, composed in `apps/artifact`. The seed and «Personaggi pronti» are the same `planPack` (FR-024); the seed runs it at start-up under the advisory lock.
- **Rationale.** P-03a says "no archive rule is written anywhere else" and P-03b names one `Archive` run where the data lives. Optimistic revisions on every touched record replace a read transaction with locks, and they give FR-022's conflict on stale editors for free.
- **Alternatives.** A server-side archive service with its own read-modify-write in a `SELECT ... FOR UPDATE` transaction (the initial approach, killed in the design review: two appliers of one rule set).

### R-19 Docker and test databases (FR-060 to FR-062, isolation rule)

- **Decision.** `docker-compose.local.yml` services: `db` (postgres 17, volume, health check, an init script creating the databases `unscripted` and `unscripted_test`), `server` (node 22 image, source mounted, `tsx watch`, not published), `web` (Vite dev server, published as `127.0.0.1:${WEB_PORT:-5173}:5173`, `depends_on: server: condition: service_healthy`), `e2e` (Playwright image, profile `e2e`), `backup` (profile `backup`, `pg_dump` into `./backups/`, git-ignored). `extra_hosts: host.docker.internal:host-gateway` on `server`. Integration tests use `unscripted_test` and truncate between files; a session or subagent that runs them in parallel uses its own database name through `DATABASE_URL_TEST` (owner's isolation rule). `docker-compose.production.yml`: `db`, `server` multi-stage, `web` on nginx-unprivileged, the same checks and bindings.
- **Rationale.** FR-060 to FR-062 and FR-047. A second database in the same container is cheaper than testcontainers and keeps CI identical (CI uses a PostgreSQL service).
- **Note.** `.gitignore` already ignores `data/` and `build/`: no workspace folder may use those names for committed files (goldens live in `tools/golden/goldens/`).

### R-20 Rate limit, spend cap and concurrency (FR-028, FR-031, FR-045, L-01, L-02)

- **Decision.** One `LlmGateway` service in `apps/server/src/llm/`:
  1. **Admission**, one transaction at `READ COMMITTED` (stated on the transaction, not left to the pool default): `pg_advisory_xact_lock(<rate key>)`, then count the rows started in the last 60 s (in flight included) and sum `cost_usd` since local midnight in `TZ` (`date_trunc('day', now() AT TIME ZONE $tz) AT TIME ZONE $tz`); insert the `in_flight` row only when both are under their caps, then commit. A refused call is never inserted. `READ COMMITTED` matters: each statement takes a new snapshot after the lock is held, so it sees the rows committed while it waited; under `REPEATABLE READ` the snapshot would come from the lock statement and the race would return.
  2. **Slot**: in-process semaphores (anthropic: 3 per `gameId`, 6 in total, calls without `gameId` sharing one bucket; lmstudio: 1).
  3. **Call** the provider, then **complete** the row with tokens, cost (from `apps/server/config/prices.json`, FR-030), latency, outcome and error code.
  4. **429**: a provider 429 becomes 429 `rate_limited` with `Retry-After = max(provider value, BackoffPolicy step)`, the step from core's `BackoffPolicy` with the request's `attempt` (per-call scope) or the server's per-`gameId` step (per-game scope, reset on that game's next success) (S-08).
- **Tests.** Parallel calls at cap minus one, on a connection with the production pool settings, let exactly one through; a refused call leaves no row; the spend sum excludes calls in flight, so the cap can be overshot by at most the 6 calls in flight, which `docs/security.md` records.
- **Rationale.** FR-045 makes `llm_calls` the single source of both limits. In-memory semaphores are correct for one server process; two processes exist only during a start-up race, which the start-up advisory lock serialises.
- **Known limit.** With two long-running server processes the concurrency caps would double; v1 runs one (4.6). Recorded in `docs/architecture.md`.

### R-21 CI (FR-103); Q-26-1 and Q-17-2 closed by D-26-8 (provisional, Trinity, by the owner's delegation D-26-7)

- **Decision.** `.github/workflows/ci.yml` runs on push and pull request:
  - install, with pnpm 12.20.0 and Node pinned to 22.23.5, the exact patch of the images, so that SC-004 compares the same V8 on both architectures;
  - lint, with the taste gate;
  - typecheck;
  - unit tests with the coverage floors;
  - server integration tests on a `postgres:17-alpine` service pinned by digest;
  - the `apps/web` integration tests over HTTP;
  - artifact build, with the `build.py` comparison (`actions/setup-python` Python 3.12, `PYTHONUTF8=1`);
  - the manifest test and the size check;
  - `golden:check`;
  - the artifact smoke (Playwright Chromium).

  `.github/workflows/nightly.yml` runs the full end-to-end suite on the web app and the artifact. Actions are pinned by commit SHA, read at task time (U-11).
- **No holds (resolved by D-26-8 (provisional, Trinity, by the owner's delegation D-26-7)).** Q-26-1: `qualita.js` is vendored with the names in the comment at line 26 replaced by invented ones; Q-17-2: the 45 sheets are published as they are. Vendoring is therefore one step on the pushable branch, with the V1 and V2 split kept only as an ordering of the work:
  - V1: every FR-080 file but `qualita.js` and `archpack-futuro.js`.
  - B8b: the builder, the golden harness modules and the smoke spec, with synthetic tests and the real V1 files where V1 suffices; `scene.js` and `archui.js` are in V1, so the hash-pinned terrain and archive-slice extractions run on the real files in CI.
  - V2: `qualita.js` (redacted; a test over a deny-list of hashes in a fixture proves no colleague first name remains), `archpack-futuro.js`, then byte identity of the build of the vendored sources, the `build.py` comparison, the size check on the real page, the recorded goldens, the smoke run and the future content. A one-time local diff check on the Mac against page `299a` proves the only difference is that comment line; it is recorded in the WI-1 notes.
  CI runs on all of this. No local branch exists.

### R-22 Prices and configuration (FR-030, FR-032)

- **Decision.** All configuration from environment variables, parsed once at start-up by one TypeBox schema in `apps/server/src/config.ts`; an invalid value stops the server with the variable's name (FR-032). Prices in `apps/server/config/prices.json` (`{ model: { inputPerMTokUsd, outputPerMTokUsd } }`), validated by a TypeBox schema at start-up; LM Studio needs none (FR-030).
- **Rationale.** "One typed configuration file read at start-up": a JSON file with a schema is editable without code and typed at run time.

### R-23 Shared backoff, call kinds, budget governor in core (S-08, S-09, FR-010, FR-011)

- **Decision.** `BackoffPolicy` is data plus one pure function: four named schedules (`island`, `talkshow`, `venture`, `archiveGenerate`) with base, factor, retry cap, step cap, scope (`perGame` or `perCall`), each constant cited (`engine.js:13-37`, `talk.js:78-87`, `llm.js:39-55`, `archfuturo.js:109-116`). The server imports it (A-02 allows server -> core). `LLM_CALL_KINDS` is one `as const` array of the 59 distinct strings of FR-011 (17 island, 9 talk show, `probe`, 12 Venture strings not shared with the island, `archive-generate`, 19 novel); `LlmCallKind` is derived from it. `BudgetGovernor` defaults to pass-through (S-09).
- **Rationale.** One rule, one module, run where D5 puts it (S-08).

### R-24 Where each adapter lives (A-04, FR-070, P-03b, FR-053)

- **Decision.** `apps/web/src/adapters/`: `HttpLlmClient`, `HttpStore` (implements `ArchiveClient` over the routes). `apps/artifact/src/adapters/`: `ArtifactLlmClient` (maps `main`, `main` + `lowLatency`, `light` to the three legacy option sets of `engine.js:8-10` and classifies runtime errors in the order of FR-053), `IndexedDbStore` (database `unscripted`, FR-051), and `LocalArchive` = `StoreArchive` over `IndexedDbStore`. In WI-1 the artifact's shipped page is still the legacy build; these adapters exist so that the contract suites prove the artifact form now (FR-050, FR-053), and they are mounted in WI-6.
- **Rationale.** A-04: the apps compose adapters; core and UI stay platform-free.
- **`ARTIFACT_URL`** (US4, 4.9) is configuration of the web tier, not of the API: `apps/web` reads it at build time (`import.meta.env`, from `.envs/.*/web.env`) and passes it to the home page as a prop, so the contract needs no field for it. Empty means no link and the four notes without a link (US4 scenario 2).

### R-25 The archive generator «✨ Genera» (FR-072, archfuturo.js:30, 69-155)

- **Decision.** `packages/core/src/archive/generate.ts` owns every rule of the generator; the UI only renders the dialog (`archfuturo.js:126-140`) and calls core.
  - `buildGeneratorPrompt(options, crew)` with `options = { role: string; sex: 'm' | 'f' | ''; tone: 'serio' | 'comico'; style: string; trait: string }`. These are exactly the fields `archGenerate` reads into `o` (`archfuturo.js:144`). `crew` is the current character list (`ArchiveClient.list()`), from which the prompt builds «PERSONAGGI GIÀ A BORDO»: the characters whose era is `futuro` and who are not deceased, each with `archRoleKey(c.role)` or «senza ruolo» (`archfuturo.js:71`).
  - The asset `packages/core/prompts/it/archive-generate.md` is a **template with named placeholders**: `{roleName}` (twice), `{style}`, `{traitLine}`, `{sex}`, `{tone}`, `{crew}`. The code keeps the conditionals of `archfuturo.js:73-77`:
    - the role name from `roleOf(o.role)[2].toLowerCase()`, or the raw role;
    - the style fallback «scegli tu un tipo di ufficiale…»;
    - the trait line, present only when a trait is given;
    - the three sex values;
    - the two tones;
    - «nessuno» for an empty crew.
  - `parseGeneratedCharacter(answer, role, clock)` ports `archGenParse` (`archfuturo.js:119-124`): 200 to 20,000 characters, parsed by `parseCharacterFile`, a name required and not «generata», `era: 'futuro'`, `role`, the name stripped of `<` and `>` and cut to 40, and `origin: { env: 'venture', label }` with the date from the injected `Clock`. Pending relations are resolved, then the result opens in the editor as a preview, never saved (`archfuturo.js:148`).
  - `generateCharacter(llm, options, crew, deps)` calls `LlmClient` with kind `archive-generate`, tier `main` and the `archiveGenerate` schedule (3 retries, `archfuturo.js:109-116`).
  - `stylesForRole(crew, role)` gives the distinct styles already present for the role, which the dialog lists (`archfuturo.js:127, 136`).
- **Oracle test.** The prompt-identity test evaluates the vendored `archGenPrompt` in `node:vm`, together with its helpers taken from the vendored `archfuturo.js` and `archui.js` (`ROLES`, `roleOf`, `archEra`, `archRoleKey`) and a stub `ARCH.chars`. It compares core's output with the legacy output byte for byte over a matrix:
  - every one of the 8 roles, plus an unknown role string;
  - both tones;
  - the three sex values;
  - trait set and trait empty;
  - style set and style empty;
  - crew empty, and crew holding a deceased member, a role-less member and a present-era character, the last two of which must be filtered as the legacy filters them.

  The same harness runs the vendored `archGenParse` against core's parser over valid, short, long and nameless answers. The test lives in `apps/artifact/test/`, which reads the vendored files; core's own unit tests cover the template filling. Every file it needs is in V1, so it runs on the pushed branch.
- **Labels stay out of core (review N9).** Core keeps the role keys in legacy order and, per key, the Italian role name the prompt needs (`ROLES[i][2]`, prompt content, `archfuturo.js:7-16`), plus the tone keys. The group labels, the role labels shown in the UI, the icons and the tone labels («Serio», «Comico (equipaggio di disadattati)», `archfuturo.js:69`) are UI text in the `it` and `en` locales by key (FR-074). The UI never renders a core constant as a label.
- **Rationale.** The prompt depends on the live archive and on three conditionals, so a verbatim text asset could not reproduce it. Only the legacy function itself can serve as the oracle.

### R-26 Prompt assets in pure core (FR-072, spec 2.7)

- **Decision.** Every prompt asset stays a versioned `.md` file under `packages/core/prompts/` (spec 2.7), the single source. A root script, `scripts/generate-prompt-modules.ts`, run by `content:generate` together with `scripts/generate-pack-content.ts`, turns each asset into a plain TypeScript module under `packages/core/src/prompts/` that exports the text as a string literal (`JSON.stringify` of the file's UTF-8 text, with a generated-file header naming the source and the command). The modules are committed; core imports them like any other `.ts`, and never reads a file. A drift test fails when a committed module differs from a fresh generation or has no `.md`. This reuses the pattern of `archpack.json` (a script, a committed generated file, a pinning test).
- **Rationale.** One plain module works in every consumer of core in WI-1 (Vitest, the Vite build, the server under `tsx`, Node scripts, `tools/golden`) and in any later bundler, with no loader, no ambient module type under `types: []` and no Node API in core (A-03). WI-2's style asset and WI-7's Venture prompts use the same path.
- **Alternatives.** Vite's `?raw` suffix: Vite-only; plain Node rejects a `.md` import with `ERR_UNKNOWN_FILE_EXTENSION` (probed 2026-11-26 with `?raw` and with `with { type: 'text' }`), so the server would crash at start once `src/index.ts` re-exports the generator. `fs.readFileSync` in core: breaks A-03. The template written directly as a TypeScript string: breaks spec 2.7's versioned `.md` assets, which later work items need byte-identical to the reference.

## Design review (three steps)

Rewritten in round 2 (review M10). The first version counted as "kills" five choices that contradicted explicit spec text before any review, and it missed seven defects that the round-1 reviews found. This version says which is which.

### Step 1: initial technical approach

1. A server-side `ArchiveService` with its own `SELECT ... FOR UPDATE` read-modify-write, and a separate applier in the artifact.
2. `dependency-cruiser` for boundaries and cycles.
3. `i18next` and `react-router`.
4. `@fastify/rate-limit` and `@fastify/helmet`.
5. The current character as the newest row of `character_versions`; `games.environment` as a PostgreSQL enum.
6. Only the four tables WI-1 writes.
7. A hand-written TypeBox character schema.
8. One vendoring commit, with only `qualita.js` held back (superseded by D-26-8: one commit, `qualita.js` redacted).
9. `@sinonjs/fake-timers` in the golden harness.
10. `llm_calls.game_id` as a foreign key to `games`.

### Step 2: self-review, honestly classified

**Contradicted the spec before any review (killing them proves reading, not judgment):**
- item 2: FR-003 and A-02 say "ESLint";
- item 4 (rate limit): FR-045 makes `llm_calls` the source of the limit;
- item 5 (enum half): 2.5 and AM2-09 already favour `text` with `CHECK`;
- item 6: FR-024 says "all tables of 2.5", and AM2-09 says the WI-1 migrations create `games.environment`;
- item 8: superseded by D-26-8 (Q-17-2 closed, sheets published as they are);
- item 10: FR-028 accepts an unknown `gameId`.

**Real design calls, where the review changed the choice:**
- item 1: two appliers would be the parallel twin P-03a forbids; replaced by `StoreArchive` in core with optimistic revisions (R-18);
- item 3: burden of proof, three views and two locales;
- item 4 (helmet half): no requirement;
- item 5 (table half): an in-place update would rewrite a version row (US1 scenario 3 forbids it) and make the 15-plus-current retention an off-by-one; replaced by current-in-`characters`, immutable history;
- item 7: a second definition of the record, and the serializer would drop the root passthrough.

**Kept:** item 9, the in-house clock, because FR-095 states a tick order the library does not document.

**Missed by step 2, found by the round-1 reviews (the real measure of this review):**
- I1, the Anthropic SDK's default retries, which would multiply provider calls behind S-08;
- I2, nested fields dropped by the response serializer (step 2 fixed only the root);
- I3 and I4, the write contract: store-owned keys required on create, the revision sent twice, the path and body ids unchecked, symmetric relations defaulting on for in-place writes, and no channel for the inconsistency warning;
- I5, the archive generator without an owner in core;
- I6, inline versions colliding with the primary key and showing as a false conflict;
- I7, the rate-limit admission racing;
- I8, no Python where the `build.py` comparison runs;
- I9, the `HttpStore` suite crossing app boundaries;
- I10, two taste-gate measurements missing, under a misapplied burden-of-proof argument;
- the Riccardo findings F1 to F9, from the warning channel to the descriptions.

Each is fixed in the section it belongs to ("Round 2" bullets) and listed in "Review responses" below.

### Step 3: consolidated choice

The consolidated design is R-01 to R-24 with their round-2 bullets.

Re-checking what the round-2 fixes introduced:
- **The `warnings` channel** adds a field to the write answers. It is a contract field beyond the spec's lists, so it is provisional (D-26-4) and stays in OI-4 for the owner.
- **The advisory transaction lock** of R-20 serialises admissions. Each holds the lock for two queries on an indexed column, which is negligible next to a model call; it is not measured yet and is tracked in the security task.
- **The import normalisation of inline versions** (data-model.md) silently drops rows the legacy would keep. That is a visible difference, so it gets a parity row, not a quiet fix.
- **Moving the hold boundary later** (M1) commits the builder and the harness without a real page to test them on. Their synthetic tests are therefore the only CI evidence until the hold lifts, and the real-page tests stay local.

## UNVERIFIED items that matter, and where they get verified

| # | Item | Risk if wrong | Verified by |
|---|---|---|---|
| U-1 | single-`Client` use of the migrator (R-07; the import path is verified, round 1) | start-up migration path changes | migration task, two concurrent start-ups test |
| U-2 | `@fastify/swagger` 9 with `typebox` 1.x schemas (R-06; `Type.Unsafe` is verified, round 1) | route schema built differently | first route task, OpenAPI snapshot test |
| U-3 | answered in round 1: boundaries needs `settings['import/resolver'].typescript` (R-04) | - | the injected `core -> ui` import must still fail |
| U-4 | `@anthropic-ai/sdk` 1.x error shape and `maxRetries: 0` behaviour (R-10) | FR-028 table maps wrongly; hidden retries | provider task: local HTTP stub behind the real SDK (429, 401, 404, one request each); then a gated manual live check with the owner's key (401, 404, 429 if reachable), recorded |
| U-5 | LM Studio loaded context vs `max_context_length` (R-10) | US2 scenario 3 misses a short context | settings task, against the owner's LM Studio |
| U-6 | nginx-unprivileged `*.envsh` hook; Vite 8 `proxyReq` event (R-16) | token not injected, every call 401 | Docker task, SC-006 token test through each web tier |
| U-7 | pnpm 12 defaults for build scripts and catalogs (R-02) | install differs in CI | tooling task, clean install in the container |
| U-8 | `uuid` 14 v5 without platform crypto (R-11) | artifact bundle needs a polyfill in WI-6 | id task, a core test run under `lib: ES2022` only |
| U-9 | Fastify 5.12 `bodyLimit` route option and its error code (R-06) | 413 not in the envelope | security task, SC-006 body test |
| U-10 | Image digests and their age; Playwright image digest and its Node major (must be 22 for `engine-strict`, R-02) (R-19) | FR-047 pin not reproducible | Docker task, digests read that day and recorded |
| U-11 | GitHub Actions versions and SHAs (R-21) | CI pin not reproducible | CI task |
| U-12 | Bit-identical V8 maths between arm64 and x64 (R-13) | SC-004 fails | SC-004 itself, runs in CI |

## Review responses (round 1)

Every finding is applied; none is rejected. "Where" names the file and section that now carry the fix.

| Finding | Response | Where |
|---|---|---|
| I1 SDK retries | `maxRetries: 0`, asserted; real SDK behind a local stub; gated live 401/404/429 | R-10, U-4, plan B4 and B12 |
| I2 nested fields dropped | open schemas at every level; `looseObject` everywhere; four-record round trip | R-06, data-model.md "Nested objects", openapi `CharacterFields` |
| I3 write contract | `CharacterInput` without store-owned keys; path id; one `expectedRevision`; mismatch 400 | openapi, core-ports.d.ts, R-06 |
| I4 symmetric and warning | `symmetricRelations` only with `versioned` (true with `inPlace` is 400); `warnings` on write answers (D-26-4) | openapi, core-ports.d.ts, R-06, plan OI-4 |
| I5 generator without owner | `packages/core/src/archive/generate.ts`; in round 3 the asset became a template and the oracle the vendored `archGenPrompt` (N2) | R-25, core-ports.d.ts, plan structure and FR-072 row |
| I6 inline version collisions | normalisation in `planImport`; only `characters_pkey` maps to `StaleWriteError` | data-model.md |
| I7 rate admission race | one transaction under `pg_advisory_xact_lock`; concurrency test | R-20, data-model.md `llm_calls` |
| I8 no Python in the image | `python3` in the dev stage; spawn env keeps `PATH` | R-01, plan Technical Context, quickstart |
| I9 suite crosses apps | `HttpStore` suite in `apps/web` over HTTP | R-15 |
| I10 missing gate measurements | `jscpd` and the catch-all selector, proven red | R-05, plan guards |
| M1 hold boundary too early | superseded by D-26-8: no hold; builder, harness modules and smoke spec are in B8b anyway | R-21, plan branch strategy |
| M2 golden inputs | `TZ=UTC`, 3 s phase, archive slices hash-pinned, zero-argument `Date` faked | R-13 |
| M3 golden and A-02 | reads `dist/index.html` from disk, records its md5 | R-13 |
| M4 framework errors, Ajv coercion | mapped to `invalid_request`; `coerceTypes: false` | R-06, openapi info |
| M5 resolver settings | both settings | R-04, U-3 |
| M6 musl and glibc | `supportedArchitectures`; Playwright Node major in U-10 | R-02, U-10 |
| M7 data-model gaps | `CharacterSnapshot`; archived cleared on versioned save; `updated` sentence; pending after import | data-model.md, openapi |
| M8 `ceilings` | kept, justified by US2 scenario 4 and Riccardo F2 (the page bounds its inputs); listed in OI-4 | openapi `Settings`, plan OI-4 |
| M9 `disable` | exercised through `edit` in the FR-050 suite, parity note | core-ports.d.ts, plan FR-050 row |
| M10 design review | rewritten | "Design review" above |
| M11 CI Node pin | exact 22.23.5 | R-21 |
| M12 `error.details.error_code` | read when present; 429 added to U-4 | R-10 |
| F1 warning channel | `warnings: [{ code: 'relation_mismatch', characterId, otherId, ownType, otherType }]`, always present | openapi, core-ports.d.ts |
| F2 `message` | English diagnostic text; UI texts by code; Riccardo's Italian table goes to the B5 UX study | openapi, R-12, plan B5 |
| F3 `models` twice | `allowedModels` in `GET /models` (a name the plan chose) | openapi |
| F4 `contextLength` | `loadedModels: [{ id, contextLength }]`, lmstudio only | openapi |
| F5 `version` vs `revision` | descriptions; one revision input | openapi |
| F6 409 meanings | two responses, `Error409Edit` and `Error409Batch` | openapi |
| F7 `symmetric` name | `symmetricRelations`, one name in the port and the API | openapi, core-ports.d.ts |
| F8 health constants | `{ status: 'ok' }`; 503 meaning written | openapi |
| F9 descriptions | `attempt`, `lowLatency`, `kind`, `schema`, `available`, settings defaults, 404 on soft-deleted, versions, counts, 401 | openapi |

**Citation check (D-26-4 point 4).** Riccardo cited `archui.js:270, 295, 297` for the checkbox, the symmetric read and the warning. Those lines come from the 14 November snapshot `unscripted-reference/island/live/archui.js` (md5 `2839c44f…`). In the pinned file `unscripted-reference/2026-11-17/island/live/archui.js` (md5 `bd9e70d6f584e1a7019a8050514eae66`, equal to its line in `reference-2026-11-23.md5`), the checkbox is at line 278, the read of `#aeSym` at line 304 and the warning at line 306. The spec's `archui.js:278, 304-306` is therefore correct, and nothing in the plan changes. Riccardo's other `archui.js` line numbers also come from the old snapshot; the plan cites only pinned lines: pack 209, import 249, the empty-name check 303, the warning 306.

**Names fixed by the spec, kept and asked of the owner instead of renamed** (D-26-4 point 3):
- `mode: versioned | inPlace` (FR-022) uses camelCase values, while the error codes use snake_case.
- `schema` on `POST /api/llm` (P-01, FR-028) shares its name with the format tag `schema: 'personaggio/1'` of the record (FR-013); the description now tells them apart.

Both questions are in plan.md OI-4.

## Review responses (round 2)

All nine findings are applied. In R-05, R-06, R-10, R-15, R-20 and R-21 I rewrote the Decision bullets so that each section now states only the final decision; the history of what changed lives in these two tables.

| Finding | Response | Where |
|---|---|---|
| N1 Ajv strips unknown keys | `removeAdditional: false` next to `coerceTypes: false`; option objects closed, records open; one misspelt-option test per write route and for `POST /api/llm` | R-06, openapi `info` |
| N2 generator cannot reproduce `archGenPrompt` | signature takes `{ role, sex, tone, style, trait }` and the crew; the asset is a template with placeholders; the vendored `archGenPrompt` and `archGenParse` are the oracle over a matrix | R-25, core-ports.d.ts, plan FR-072 row |
| N3 stale Decision bullets | R-05, R-06, R-10, R-15, R-20, R-21 rewritten; the superseded wording appears only here and in round 1's table | research.md |
| N4 branch base | no local branch (D-26-8); B8b uses the real V1 `scene.js` and `archui.js` for the hash-pinned extractions, with synthetic sources only for the failure paths | R-21, plan branch strategy |
| N5 guard bypasses | catch selector limited to the catch's own body; selectors for `.catch(handler)` without a rethrow and for `.then(_, onRejected)`; the exemption script also checks `jscpd:ignore-start`; each proven red | R-05, plan guards |
| N6 `Omit` over an index signature | `CharacterInput` and `CharacterSnapshot` are inferred from `CharacterSchema.omit(...)`, which keeps the named keys and the catch-all | core-ports.d.ts |
| N7 isolation level | admission at `READ COMMITTED`, stated on the transaction; concurrency test on the production pool settings | R-20 |
| N8 anthropic `available` | a cached `models.list` probe, at most once a minute and spending no tokens, so a revoked key or an outage turns red within a minute; the status-bar wording goes to the B5 UX study | R-10, openapi `available`, plan B5 |
| N9 Italian labels in core | core keeps role keys, the prompt role names and tone keys; UI labels come from the locales | R-25, core-ports.d.ts |

**Superseded wording, for the record.** The earlier text of R-06 opened only the root of the record and tested one root key. R-10 relied on faked SDK objects for the error mapping. R-15 ran the `HttpStore` suite from the server's tests. R-20 inserted the row before counting. R-21 took Node from `.nvmrc`. None of these is the decision any more.

## Review responses (verification round)

| Finding | Response | Where |
|---|---|---|
| V1 `list()` order undefined | one order, insertion `seq`, on both stores; asserted in the FR-050 suite; parity row for the legacy reload order | data-model.md, R-18, core-ports.d.ts, openapi, plan FR-050 row |
| V2 selector not expressible | local ESLint rule `local/no-swallowed-error`, proven with `RuleTester` (valid and invalid cases, `.catch(fnRef)` included) | R-05, plan guards |
| V3 probe blocking and outbound | background probe, 5 s timeout, only while anthropic is selected; the route serves the cached value; recorded in `docs/security.md` | R-10, openapi `available` |

## Review log

| Round | Reviewer | Verdict | Findings (critical/important/minor) | Coverage |
|---|---|---|---|---|
| 1 | Matteo mode | NOT CONVERGED | 0/10/12 | full |
| 1 | Riccardo mode (API) | 6 important, 3 minor | - | - |
| 2 | Matteo mode | NOT CONVERGED | 0/2/7 | full |
| Verification | Matteo mode | CONVERGED | 0/0/3 | full |

The three minors of the verification round are applied above. The plan is approved provisionally under D-26-5, awaiting the owner's confirmation.
