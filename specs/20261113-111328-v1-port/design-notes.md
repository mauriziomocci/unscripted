# Design notes: v1 port (three-step design process)

Working document for the three-step design process required by the constitution. The spec (`spec.md`) is written only after step 3.

## Step 1: Initial proposal

### Context

The reference implementation is the published Claude artifact "Esperimento sociale: l'isola" (about 960 KB of hand-written JavaScript in one HTML page, version 1794502765-533a). Source modules and sizes:

| Module | Size | Role | DOM | LLM | three.js |
|---|---|---|---|---|---|
| sim.js | 57 KB | island geometry, seeded RNG, weather generator, legacy rule-based sim | no | no | no |
| engine.js | 177 KB | island game state `G`, perception, prompts, decisions, director, physics of actions, god mode, save | no | yes | no |
| env.js | 38 KB | tides, moon, drift, wounds, diet, bio, fog of war, interviews, daily story | no | yes | no |
| features.js | 35 KB | scenarios, secrets, medals, predictions, rare events, weekly episode | no | yes | no |
| fun.js | 58 KB | names, gestures, habits, sketches, pets, spectacles, supplies, social circle, novel chapters | no | yes | no |
| scene.js | 58 KB | three.js island, props, creatures, people | minimal | no | yes |
| ui.js + funui.js | 231 KB | island UI, panels, minimap, records, charts, PDF | yes | no | yes |
| archpack.js | 60 KB | 16 ready-made characters (schema `personaggio/1`) | no | no | no |
| archui.js | 37 KB | character archive UI, markdown import/export, IndexedDB | yes | no | no |
| report.js | 19 KB | shared report model, relation graph SVG, A5 PDF | no (SVG strings) | no | no |
| talk.js + talkfun.js | 127 KB | talk show: state, turn picking, listening, chorus, twists, moments, televote, off-air, replay, studio 3D, UI | yes (mixed) | yes | yes |

Island logic (sim, engine, env, features, fun: about 365 KB) is already DOM-free. Talk show logic is interleaved with DOM code. Platform access is concentrated in a few points: `SAMPLE.json(prompt, opts)` for the LLM, `localStorage` / `IndexedDB` for saves, the artifact's `downloads` and `tts` capabilities.

### Goals

1. The web app does everything the artifact does today (archive, island, talk show, reports, PDF, god mode, director, saves).
2. The artifact is rebuilt from the same source, so the two forms cannot drift.
3. Strict TypeScript, tests, Docker, PostgreSQL, Anthropic and LM Studio providers.
4. Slightly better, still light graphics.

### Proposed architecture

```
packages/core        pure TS: model, island, talkshow, archive, reports, prompts, i18n, ports
packages/ui          React components + three.js scenes shared by web and artifact
apps/web             Vite SPA: mounts packages/ui with HttpLlmClient + HttpStore
apps/server          Fastify: /api/llm, /api/models, /api/archive, /api/games, /api/events, /api/reports; Drizzle + PostgreSQL
apps/artifact        Vite single-file build of packages/ui with ArtifactLlmClient + IndexedDbStore
```

Ports in core (dependency injection, the only side effects core can perform):

- `LlmClient.complete({ prompt, tier, maxTokens, json })` returning text; core parses JSON with a tolerant parser and validates it with zod schemas.
- `Store`: `characters`, `games`, `events.append(batch)`, `snapshots`, `reports`, `llmCalls`.
- `Clock` (now, setTimeout abstraction) and `Rng` (seeded).
- `Speech` (optional TTS) and `Downloads` (file save) as optional capabilities.

### Migration strategy: strangler, not big-bang rewrite

Rewriting 960 KB from scratch would take weeks and lose behavior that was tuned through many play sessions. Instead:

1. **Move**: the DOM-free island modules go into `packages/core/src/island/` converted to TypeScript modules: globals (`G`, `SAMPLE`, `localStorage`) replaced by an injected `IslandContext`; types start loose (`IslandState` interface covering the top-level shape, nested parts typed progressively) and become strict module by module.
2. **Extract**: talk show logic is separated from its DOM code into `packages/core/src/talkshow/` (state machine, turn picker, listening, chorus, twists, moments, televote, off-air, replay selection). Archive parsing and the report model go to `core/archive` and `core/reports`.
3. **Rebuild UI**: one React UI in `packages/ui` (shared by web and artifact), reusing the three.js scene code from scene.js as imperative modules driven by React refs.
4. **Characterization tests** first: before moving a module, record its behavior with the mock LLM (fixed seed, fixed answers) as golden tests; the moved module must reproduce them.

Until the React UI reaches parity, the current artifact stays the published reference. When parity is reached, the artifact is published from `apps/artifact` and the old source is retired.

### Data model (PostgreSQL, Drizzle)

```
characters(id uuid pk, slug text unique, created_at, updated_at, archived_at null)
character_versions(id uuid pk, character_id fk, version int, schema text, data jsonb, created_at, unique(character_id, version))
games(id uuid pk, environment enum('island','talkshow'), title, seed bigint, status enum('running','paused','ended'),
      settings jsonb, created_at, updated_at, ended_at null)
game_participants(game_id fk, character_version_id fk null, role text, display_name text, pk(game_id, display_name))
events(id bigserial pk, game_id fk, seq int, game_time numeric, kind text, actor text null, payload jsonb, created_at,
       unique(game_id, seq))   index (game_id, kind), index (game_id, actor)
snapshots(game_id fk, seq int, state jsonb, created_at, pk(game_id, seq))
relations(game_id fk, from_name, to_name, value smallint, reason text, updated_seq int, pk(game_id, from_name, to_name))
reports(id uuid pk, game_id fk, kind text, data jsonb, created_at)
llm_calls(id bigserial pk, game_id fk null, kind text, provider text, model text, tier text, prompt_tokens int,
          completion_tokens int, latency_ms int, ok bool, error text null, created_at)
settings(key text pk, value jsonb)
```

Events are append-only and carry everything shown to the player (lines, thoughts, actions, director interventions, votes, chronicle entries). Snapshots are taken every N events (default 50) and at pauses; resuming loads the latest snapshot and replays nothing (state is complete in the snapshot), while the event log serves reports, replay and statistics.

### Server

Fastify with TypeBox schemas, routes under `/api`. LLM proxy: provider chosen per request from server config (`LLM_PROVIDER=anthropic|lmstudio`, model per tier from env or from `/api/models`). Concurrency limit and exponential backoff on 429 live on the server for the web app and in core for the artifact (same policy module in core, reused by the server). No authentication in v1 (single-player, bound to localhost by default); documented as a known limitation.

### Docker

`docker-compose.local.yml`: `postgres:17-alpine` with volume and health check, `server` (tsx watch, source mounted), `web` (Vite dev server). `docker-compose.production.yml`: `postgres`, `server` (multi-stage build, node:22-alpine, non-root, runs migrations at start), `web` served by `nginx:1.27-alpine` with `/api` reverse-proxied to `server`. `extra_hosts: host.docker.internal:host-gateway` on `server` for LM Studio.

### Tests

- core: Vitest, deterministic mock LLM, characterization (golden) tests for moved modules, unit tests for new logic.
- server: Vitest + Fastify `inject` against a real PostgreSQL (testcontainers or compose service in CI).
- UI: Vitest + Testing Library for components; Playwright end-to-end on web app and on the built artifact with the mock LLM.
- CI: GitHub Actions running lint, typecheck, unit, integration, e2e.

### Trade-offs and dependencies

- Shared React UI for both forms gives maximum alignment but makes the artifact heavier (React ~45 KB gz plus three.js from CDN as today).
- Strangler migration keeps behavior but carries loose types for a while.
- New dependencies: react, react-dom, three, zod, fastify, @fastify/type-provider-typebox, drizzle-orm, drizzle-kit, pg, @anthropic-ai/sdk, openai (for LM Studio, OpenAI-compatible), jspdf, vitest, playwright, testcontainers.

### Open decisions (for the review council)

D1. Shared React UI for both forms (packages/ui) versus React only in the web app and a separate light UI in the artifact.
D2. Strangler migration versus clean rewrite.
D3. Snapshot + append-only event log versus pure event sourcing (state rebuilt from events).
D4. Relations as a table versus inside snapshots only.
D5. Where the LLM concurrency/backoff policy runs for the web app (server vs browser).
D6. Scope of v1: full parity in one work item versus a sequence of work items (foundation, island, talk show, archive and reports).

## Step 2: First critical self-review (review council)

The council had three independent reviewers: architect, adversarial critic and game designer. They reviewed Step 1 separately, and their findings are merged and deduplicated below.

### Critical

- **K1. Late LLM results.** With 2 or more calls in flight, an answer can change state that has already moved on (the actor moved, died or paused). *Fix:* core never changes state across an `await`. An answer becomes a validated *intent* tagged with the actor and the state version it was asked for. A single reducer applies intents at tick boundaries, in the order they were requested, and drops any whose preconditions no longer hold. `LlmClient.complete` accepts an `AbortSignal`.
- **K2. Snapshots and the event log can diverge, and `seq` has no owner.** *Fix:* `Store.commit({ gameId, expectedSeq, events, state })` writes events and the latest state in one transaction (one PostgreSQL transaction, or one IndexedDB transaction). Core is the only writer and allocates `seq`. The server rejects a stale `expectedSeq` with 409 and accepts the same batch again idempotently. Each game holds a single-writer lease, and on resume a game marked `running` goes back to `paused`.
- **K3. The goldens cannot be recorded as described.** The reference calls `Math.random` about 136 times, uses `Date.now`, `setTimeout` and `MAX_INFLIGHT=2`, and the mock matches Italian prompt text. *Fix:* record the goldens **before** moving any code. The harness stubs `Math.random` with the same seeded PRNG core will use and runs on fake timers. The first port step is mechanical: `Math.random` becomes `ctx.rng()` in the same call order. The mock answers by call `kind` and actor, never by prompt text. Goldens compare state after N ticks plus the sequence of call kinds, not the prompts.
- **K4. The server would be an open proxy for a paid API key.** *Fix:*
  - Publish ports on `127.0.0.1` only.
  - Allow-list `Host` and check `Origin`; no CORS.
  - Require a per-install session token.
  - Enforce body-size limits, a server-side `maxTokens` ceiling and a model allow-list (the client never chooses the model).
  - Rate-limit calls per minute and cap daily spend, both computed from `llm_calls`.
- **K5. Small local models stall or break the game.** Mind prompts are about 5-8K tokens, LM Studio often defaults to a 4K context, small models are weak at JSON, and one call takes 20-40 s on the M3. *Fix:*
  - Send `response_format: json_schema`, generated from the same zod schemas.
  - One request at a time per LM Studio provider.
  - A timeout per tier and one repair retry; after that a safe fallback beat (rest or silence), never a stall.
  - Read the loaded context length and switch to a compact prompt profile; warn in the UI under 8K.
- **K6. Pacing is what makes the game feel alive, and the design ignored it.** *Fix:* a core `Showrunner` timeline owns every timing constant (typing speed 32 chars/s, hold 1.8-5 s, 1.5 s minimum before an interrupt cut, 400 ms gaps, staggered chorus) and the prefetch/listen overlap, driven by the injected clock. When the model is late, the gap is filled with reaction shots and gestures. The server allows at least 3 calls in flight per game for Anthropic.
- **K7. There is no feature inventory, so parity cannot be verified.** *Fix:* `docs/parity.md`, one row per player-facing feature with an acceptance check, built from the source and the diaries. Parity means that checklist plus a side-by-side playtest of old and new.

### Important

- **I1. Documentation drift.** The constitution allows ports only for LLM and Store; CLAUDE.md lists no `packages/ui`, and its `LlmClient` has no `kind`, `json` or `signal` and uses tiers `main`/`light`. *Fix:* amend constitution 1.1.0 and CLAUDE.md in this work item.
- **I2. Participants are keyed by display name.** Characters can be renamed during a game. *Fix:* use a `participant_id` uuid everywhere and keep names as data.
- **I3. Nothing is versioned.** *Fix:* add `schema_version` to state, characters and events, with a chain of pure `migrate` functions in core. Add a file importer for existing saves (`isola-esperimento-v1`, the archive, `personaggio/1` markdown).
- **I4. Core purity is not enforced.** *Fix:* core's tsconfig uses `lib: ES2022` with no DOM and no node types; boundary lint rules (core imports nothing, ui imports core, apps import ui and core); a `Scheduler` port for timers.
- **I5. LLM output reaches HTML.** This covers `cleanSvg` plus `innerHTML` sketches and string SVG reports. *Fix:* parse sketches into a whitelisted element tree rendered as React elements, render reports as JSX, lint-ban `dangerouslySetInnerHTML`, and validate imports with zod.
- **I6. Call budget.** *Fix:* a `BudgetGovernor` in core sets calls per game-minute per tier; the server enforces the hard cap. The setup screen keeps the call and cost estimate.
- **I7. three.js version.** The reference uses r128 UMD and `examples/js`. *Fix:* pin one modern ESM version for both forms and make visual changes deliberately, with before/after screenshots. The artifact size budget is checked in CI.
- **I8. Talk show.** Its logic is interleaved with 29 `innerHTML` uses and timers, so it is a redesign and gets its own work item.
- **I9. i18n.** UI locale and story language are separate axes. v1 parity means Italian prompts (canonical, versioned assets under `core/prompts/it`) and a full English UI locale. English story prompts are a later item, recorded in `docs/alignment.md`.
- **I10. Rate limits stay in the fiction.** The cool-down flows from server to core and appears as the in-show commercial break, never as a raw error.
- **I11. Freeze the legacy artifact.** Once the foundation lands, it gets bug fixes only and new features go into core.
- **I12. Event payloads.** One zod schema per kind, carrying stage directions (tone, shape, addressee, gesture, interrupt offset, camera shot, claque, listener thoughts). Replay and reports are pure functions of events, and director interventions are events too.
- **I13. Director commands live in core** (whisper, event, on-air voice, twist, claque), so both forms share them.

### Minor

- `llm_calls` keeps a prompt hash and token counts, never the prompt text (opt-in only). Token columns are nullable.
- Production web image `nginxinc/nginx-unprivileged`; base images pinned by digest; an advisory lock on migrations.
- Cap the size of the state JSON and keep the full history in events; cap the event log in the artifact for the IndexedDB quota.
- Render with `useSyncExternalStore` and selectors; the three.js loop reads state by reference.
- E2E runs nightly; smoke tests run on PRs.

### What works

Ports around a pure core; strangler migration; snapshot plus append-only log; zod-validated output; one backoff policy; island first because it is already DOM-free; keys only on the server.

### Council votes (unanimous, 3/3)

| Decision | Outcome |
|---|---|
| D1 | One shared React UI (`packages/ui`) for both forms |
| D2 | Strangler migration, mechanical first step, goldens recorded before the move |
| D3 | Latest state plus an append-only event log, committed atomically per tick; no pure event sourcing |
| D4 | Relations live in the state; every change is a `relation_changed` event with delta and reason; no separate table |
| D5 | Concurrency, backoff and budget enforced on the server; `Retry-After` flows back to core |
| D6 | A sequence of work items, each ending in a playable build and a slice of the parity checklist |

## Step 3: Second review and consolidation

Problems introduced by the fixes, and how they are resolved:

- **K1 against K6.** Applying intents only at tick boundaries could delay a talk-show line by one tick. *Resolution:* the talk show's tick is the Showrunner beat (event-driven, not a fixed period), so an intent applies at the next beat. Only staleness checks drop work, never latency.
- **K2 against the artifact.** IndexedDB has no 409. *Resolution:* `IndexedDbStore` compares `expectedSeq` inside the same transaction and throws the same `StaleWriteError`, so both stores satisfy one shared contract test suite.
- **K4 against usability.** A session token on localhost adds friction. *Resolution:* the server generates the token at first start, writes it to `.envs/.local/session-token`, and the web container receives it through compose; the player never types it. The token stops other origins and other LAN hosts, not the local user.
- **K5 against parity.** The compact prompt profile changes behaviour. *Resolution:* the full profile is the default; compact turns on only when the provider reports a context under 8K, and the player sees why.
- **K3 against the D2 timeline.** Recording goldens first delays visible progress. *Resolution:* WI-1 delivers a visible foundation (archive in the new app, legacy artifact built by the new pipeline) while the harness is built, so the player always has something playable.
- **D4 against reports.** Relations come from the state for the current value and from events for the history; the report merges both through a pure function.
- **Too much in one item.** Following D6, this branch is the umbrella (large feature with subtasks). Its spec fixes the cross-cutting architecture and specifies WI-1 Foundation in detail. WI-2 to WI-6 get their own Spec Kit branches off this one, each with its own heavy gate.

Consolidated design: see `spec.md`.
