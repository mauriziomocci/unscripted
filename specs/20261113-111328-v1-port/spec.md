# Feature Specification: Unscripted v1 port (umbrella) and WI-1 Foundation

**Feature Branch**: `20261113-111328-v1-port` (umbrella; each work item gets its own Spec Kit branch off this one)

**Created**: 2026-11-13

**Status**: Approved provisionally by the Trinity under the owner's autonomy windows (D-14-7 for the original, D-17-2 for Amendment 1); every provisional decision awaits the owner's confirmation.

**Amendment 1 (2026-11-17)**: the binding reference moves to the 2026-11-17 snapshot, which adds the starship environment **Venture** and changes the archive, the reports and the novels. The owner's decision, verbatim: «deve entrare tutto». The amendment, with its three-step design, its four rounds of adversarial review and its FAQ, is `amendment-2026-11-17.md` in this folder; its items AM-01 to AM-18 are applied below, and where a sentence here and that document disagree, that document prevails. Every `file:line` citation refers to the 2026-11-17 snapshot.

**Input**: Port the published Claude artifact "Esperimento sociale: l'isola" (version `1794502765-533a`, updated to `1794922407-478d` by Amendment 1) into this repository so that the new web app does exactly what the artifact does today, while the artifact keeps being built from the same code. Binding sources: `CLAUDE.md`, `.specify/memory/constitution.md`, `design-notes.md` (three-step design), `docs/handoff/claude-code-v1-port.md` (the handoff), `docs/handoff/claude-code-v1-update-2026-11-17.md` (the handoff update) and `amendment-2026-11-17.md`.

**API contract**: new API, with no external client. The WI-1 merge into `develop` counts as delivery under the owner's rule "a delivered API contract never changes", and from then on a schema-shape snapshot test (FR-063) enforces it. WI-2 to WI-7 must add to it, so the planned additions are listed now in section 2.9 as **CONTRACT CHANGE (planned)**: each needs the owner's explicit permission before the WI that adds it starts, or a project autonomy profile that opens `contract` (set only by the owner, `git config --local pe.autonomy`). No addition is made without one of the two.

---

## 1. Scope of this document

This file is the umbrella specification. Section 2 holds the architecture rules that bind every work item (WI). Section 3 lists the work items. Section 4 specifies WI-1 Foundation in full. Section 5 is the FAQ. WI-2 to WI-7 get their own specs, on their own branches, each with its own heavy gate.

The reference implementation is the **oracle**. It is kept read-only outside the repository, in `../unscripted-reference/2026-11-17/` (sources in `island/live/`, plus `island/sim.js` and the three.js r128, OrbitControls and jsPDF 2.5.1 copies; the published page in `published/`; the design documents and character sheets in `design/`). Its integrity is checked by the md5 of `venture.js` `e6e40279aeaaf82d080f277645421b94`, `ventureui.js` `76ea67c83c5b870dad36a15a06032d04` and `talk.js` `b66bdbd7dd5c6340737c2da7426e0f46`. Its build reproduces the published page byte for byte (`live.html` = `published/esperimento-sociale-1794922407-478d.html`, md5 `49ff58739a82e54ae1cd3535a6f67267`, 1,350,264 bytes), and `node tests/venture.test.js` prints `ALL OK`. The 14 November snapshot `../unscripted-reference/island/` is kept as history only. Every number this spec takes from the reference is cited as `file:line`.

## 2. Cross-cutting architecture (binding for all work items)

These rules come from decisions D1-D6 and the handoff, section 2. They are not reopened without the owner's approval.

### 2.1 Structure

- **A-01 Workspaces.** pnpm workspaces: `packages/core`, `packages/ui`, `apps/web`, `apps/server`, `apps/artifact`, `tools/golden`.
- **A-02 Dependency direction.** `core` imports nothing from the repository. `ui` imports `core`. `apps/*` import `ui` and `core`. `tools/golden` imports `core` and reads `apps/artifact/legacy/`. ESLint boundary rules fail the build on any other import, and on import cycles.
- **A-03 Pure core.** `packages/core` compiles with `lib: ["ES2022"]`, no DOM and no Node types. Its only side effects go through the ports of 2.2. Time and randomness are always injected.
- **A-04 One shared UI (D1).** `packages/ui` holds every screen of both forms. `apps/web` and `apps/artifact` only compose the adapters (LLM client, stores, speech, downloads) and mount the UI.
- **A-05 Strangler migration (D2).** Golden characterization tests are recorded before any legacy code moves. The first move of a module is mechanical: `Math.random` becomes `ctx.rng()` in the same call order, `Date.now` and `performance.now` become `ctx.clock`. Typing comes after. A module leaves its `legacy/` folder only when it passes the strict TypeScript gate.
- **A-06 The legacy artifact is frozen** after WI-1, at the 2026-11-17 snapshot: bug fixes only; new features go into core. Any artifact change before WI-1 lands repeats the procedure of Amendment 1: a dated snapshot in `unscripted-reference/` and a handoff note.

### 2.2 Ports of `packages/core`

- **P-01 `LlmClient.complete(request): Promise<LlmResult>`**, where `request = { kind: LlmCallKind; tier: 'main' | 'light'; lowLatency?: boolean; attempt?: number; prompt: string; schema?: JsonSchema; maxTokens?: number; gameId?: string; signal?: AbortSignal }` and `LlmResult = { value: unknown; usage?: { inputTokens?: number; outputTokens?: number } }`. `value` is the already-parsed JSON answer, because the artifact runtime returns parsed objects (`engine.js:19`, `talk.js:75`). Failures are thrown as `LlmError` with a closed `code` (P-02). No model name crosses the port: the player's per-game choice of a lighter model for minds (`engine.js:18`, `G.mindModel`; `talk.js:72`) is expressed by core sending `tier: 'light'` for those calls.
- **P-01a Model selection stays a game rule in core** (council decision C17). It applies to the island and, in the variant of AM-02, to the Venture; the archive generator has no fallback; the talk show has no fallback and only two option sets (`talk.js:72-76`), which map to `light` and `main`. On the island, the legacy uses three option sets (`engine.js:8-10`): MODEL for calls asked with the legacy tier `'mind'`, HAIKU for the others, and SONNET_QUICK for the others once the light model has been refused, which is remembered in the game state as `G.lightModel = false` (`engine.js:18, 21`). The request therefore carries one optional, additive field, `lowLatency?: boolean`, meaningful only with `tier: 'main'` (not named `quick`, which in the legacy `tsAsk(prompt, quick)` means the light model, `talk.js:72`). Core owns the rule: on `model_refused` for a light call it resends the call with `tier: 'main'` (legacy tier `'mind'`), or with `tier: 'main', lowLatency: true` and `G.lightModel = false` (any other legacy tier), as part of the same logical call, so `callsByKind` and `stats.calls` count it once, as `askOnce` does (`engine.js:21, 26`). `ArtifactLlmClient` maps `main` to MODEL, `main` plus `lowLatency` to SONNET_QUICK and `light` to HAIKU. The server maps `main` and `light` to the models configured per tier, and `main` plus `lowLatency` to `ANTHROPIC_MODEL_MAIN_LOW_LATENCY` (default: the main model, without an effort setting); LM Studio serves the same loaded model for both. **Venture variant** (AM-02): the "light model refused" state lives in the client session, not in the game state, and resets on reload; one refusal disables the light model for both tiers; the fallback uses up a retry and goes back through the cooldown and the slot; a refused light call goes to `main` with `lowLatency`, a refused light mind to `main` (`llm.js:16, 25-27, 36-45`). Tests cover each variant.
- **P-02 `LlmError.code`** is one of `rate_limited` (with `retryAfterMs`), `timeout`, `unparseable`, `unavailable`, `denied`, `model_refused`, `budget`, `invalid_request`. `rate_limited` keeps the legacy code (`engine.js:32`). `denied` covers the legacy permission codes `not_granted`, `sampling_disabled`, `not_declared`, `capability_disabled` (`engine.js:527`). `model_refused` covers the legacy light-model refusal (`engine.js:21`). Callers decide by code, never by message text.
- **P-03 `CharacterStore`** is persistence only: `list`, `get`, `versions`, and one atomic write, `apply(batch)`, where a batch holds writes and soft deletes. Every write carries the expected `revision`, a counter that grows on every write of any kind and only serves optimistic concurrency; a stale one throws `StaleWriteError`. A write is one of two kinds, because the legacy `archSave` adds a history row only when the saved object is not the stored one (`old !== c`, `archui.js:36-37`):
  - **versioned save** (the legacy saves a new object: the editor works on a clone, `archui.js:257`; restore, `293`; import over a stored character, `249`; the pack): the superseded version becomes a history row, and the version number grows by one;
  - **in-place update** (the legacy changes the stored object: relation cleanup, `294`; symmetric relations, `306`; pending relations, `307`, which touches every character with pending relations on every editor save, whether or not one resolves, and so refreshes the `updated` that the import skip rule compares, `249`, with a test; and from WI-2 the game writes "in scena", "morte", "nuova vita #N", «puntata …», `archui.js:151, 155, 186, 320`, `talk.js:242`): no history row, the version number stays, only `updated` and `revision` change.

  It keeps 15 prior versions plus the current one per character, and version numbers that grow and are never reused (`archui.js:37`). The reason follows the legacy semantics exactly: each history row is the snapshot of a superseded version, with that version's number and timestamp and the reason of the save that superseded it (`{ v: old.version, at: old.updated, why: <reason of the new save> }`, `archui.js:37`); the history shows only prior versions (`archui.js:280`), and a character saved for the first time has no reason stored anywhere.
- **P-03a Archive rules have one owner: the core `Archive` module.** It holds pure planners over the current records that return a batch: create, edit (with symmetric relations, `archui.js:306`), restore (`archui.js:293`), delete (relations pointing to the character removed from the others, `archui.js:294`), resolution of pending relations by name (`archui.js:85-88`), archive import with the legacy skip rule (`archui.js:249`), the ready-made pack (FR-024), and export. Each form runs the same planners where its data lives: the artifact in the browser over `IndexedDbStore`; the web form on the server over its PostgreSQL store, inside one transaction per batch, because the server imports core (A-02 allows it). No archive rule is written anywhere else. Which of these writes are versioned saves and which are in-place updates, and which reasons are stored, is fixed by P-03 and FR-016.
- **P-03b `ArchiveClient`** is what the UI uses: list, get, versions, create, edit, restore, disable, delete, import, export, add the pack. `HttpStore` implements it over the server routes (the server runs `Archive`); `LocalArchive` implements it as `Archive` over `IndexedDbStore`. Two shared contract suites prove the forms equal: the `CharacterStore` suite on the PostgreSQL store and `IndexedDbStore`, and the `ArchiveClient` suite on `HttpStore` (against a real server and database) and `LocalArchive` (fake-indexeddb).
- **P-04 `GameStore`**: games, an atomic `commit({ gameId, expectedSeq, events, state })` that throws `StaleWriteError`, event paging, reports. `Store = CharacterStore & GameStore`.
- **P-05 `Clock`** (`now()` wall time, `perfNow()` monotonic), **`Scheduler`** (timers), **`Rng`** (seeded, `next(): number` in [0, 1)).
- **P-06 Optional capabilities**: `Speech` (speak, stop) and `Downloads` (save a named file). Each form may lack them, and the UI hides what is missing. `packages/ui` also has an optional UI-level `Sound` capability (synthesised, no files), used by the Venture bridge.

### 2.3 State, events and the LLM

- **S-01 No state change across an `await`.** An LLM answer becomes a validated intent tagged with the actor and the `stateVersion` it was asked for. One reducer applies intents in request order and drops stale ones.
- **S-02 Latest state plus an append-only event log (D3)**, committed atomically per tick or per beat with `expectedSeq`. No pure event sourcing.
- **S-03 Relations live in the state (D4).** Every change also emits `relation_changed` with delta and reason. No relations table.
- **S-04 Versioning.** State, characters and events carry `schema_version`; core holds a chain of pure `migrate` functions.
- **S-05 Untrusted LLM output.** Parsed, validated with zod, clamped, never executed. Sketches become a whitelisted SVG element tree rendered as React elements. Lint bans `dangerouslySetInnerHTML`.
- **S-06 Repair and failure handling.** On `unparseable` or a schema failure core asks once more with a fixed repair suffix (a call the legacy never makes, recorded in `docs/alignment.md`; golden mock answers are answers the legacy accepts, so that it never fires in goldens; zod schemas for the island kinds arrive with WI-2). Every other failure keeps the catch behaviour of its legacy call site, verbatim, cited and tested in the WI that ports it. For example: a mind decision gets a rest beat of 0.4 h, and the game pauses on `denied`, on `rate_limited` after the last retry, or after 3 failures in a row, each with its legacy message (`engine.js:523-531`); analysis returns nothing (`env.js:302`); the director falls back to the base result (`engine.js:779`); the animal director returns nothing (`engine.js:840`); a talk-show turn clears `thinking` and rethrows (`talk.js:200`). `budget` pauses the game with its own message. A rate limit is never answered with a fallback while its cooldown runs. For the Venture the legacy rules hold (AM-17): every failed call becomes a logged fallback (`venture.js:605`); a turn that throws is rolled back to its snapshot and the game pauses (`ventureui.js:217`); the call cap ends the game as `tetto`, keeping the report reserve (`ventureui.js:218`). The server's daily `budget` stop is a v1 safety net of the web form, defined per environment in AM-17 (Venture: rethrown past the per-call fallback, turn rolled back, pause; island: end of tick, `G.running = false`; talk show: end of beat; Venture calls outside a turn keep their legacy catch, and the final report stays retryable), with a parity row and tests.
- **S-07 Rate limits stay in the fiction (D5).** The web server enforces concurrency and budget and computes the wait (S-08); core shows the existing cooldown: the island freezes time with "riprendo da solo tra N s" (`ui.js:1360`, `engine.js:1144`), the talk show goes to "Pubblicità" (`talk.js:237`).
- **S-08 Retries and waits: one rule, one module, run where D5 puts it.** `BackoffPolicy` is a core module that reproduces the legacy schedule: base 15 s, factor 2, at most 5 retries; on the island the step is capped at 5 (240 s), and one cooldown end (`coolUntil`) is shared by concurrent calls through `Math.max` (`engine.js:32`). Its step scope is a parameter, because the island shares one step per game and resets it on success (`engine.js:32`), while the talk show counts per call (`talk.js:76`); four named legacy schedules exist: island (`engine.js:13-37`), talk show (`talk.js:69-78`), Venture (`llm.js:33-47`: 2 in flight, 4 retries, per-call doubling, one cooldown end shared through `Math.max`) and archive generator (`archfuturo.js:108-115`: per call, 3 retries). The schedule follows the environment of the game; a call whose `gameId` is absent or unknown uses the calling module's schedule with the per-call scope and is never an error (`probe` and `archive-generate` are per call). Who runs it depends on the form:
  - **Web form (D5: the server computes the wait).** The server never retries a provider call. On a provider 429 it answers 429 `rate_limited`, with `Retry-After` set to the larger of the provider's value and the `BackoffPolicy` step. It computes that step from the call's `attempt` (FR-028) for the per-call scope, and from its own per-`gameId` step, reset on that game's next success, for the per-game scope. Its own rate limit sets `Retry-After` to the seconds until the window frees.
  - **Artifact.** The runtime gives no wait, so core runs the same `BackoffPolicy` in the browser.

  In both forms the clients pass `retryAfterMs` through and never compute one, and core alone counts attempts (at most the schedule's retry cap), waits `retryAfterMs` when present, and otherwise uses its own `BackoffPolicy` step. This is the pattern of P-03a: one rule in core, run where D5 puts it. A test proves that one provider 429 produces exactly one server answer and one core retry, and that the waits of both forms follow the legacy schedule for both scopes.
- **S-09 `BudgetGovernor`** limits calls per game-minute per tier. Its default is pass-through, so goldens stay equal to the legacy, which has no governor.

### 2.4 Providers (server)

- **L-01 `anthropic`**: official SDK; model per tier from env; at most 3 calls in flight per game and 6 in total.
- **L-02 `lmstudio`**: OpenAI-compatible at `LMSTUDIO_BASE_URL` (default `http://host.docker.internal:1234/v1`, env only); one call at a time; `response_format: json_schema` from the zod schema serialized in core; context length read from the provider, with a compact prompt profile below 8K tokens and a UI warning.
- **L-03 Both**: timeouts per tier, main 90 s and light 30 s (lmstudio 180 s and 60 s); the server runs the tolerant JSON extractor and returns parsed values.

### 2.5 Data model (PostgreSQL 17, Drizzle)

`characters`, `character_versions` (with `reason` and `created_at`), `games` (with `last_seq` and a lease), `game_participants` (uuid identity, names are data), `game_state`, `game_snapshots`, `events` (unique `(game_id, seq)`, zod payload per kind with stage directions), `reports`, `llm_calls` (prompt hash only, nullable token counts), `settings`, `records` (rankings: `id`, `environment`, `game_id` nullable, `seed` nullable, `score`, `data` jsonb, `created_at`; a partial unique constraint on (`environment`, `seed`) for island rows with a seed; island retention top 30 by score, the latest run per seed replacing the earlier one, `funui.js:236`; Venture retention the last 100, `ventureui.js:555`), `missions` (custom Venture missions: `id`, `title`, `source` as `missione/1` text, `created_at`, `archived_at`; the ready-made missions are content). `games.environment` is one of `island`, `talkshow`, `venture`. The artifact stores the same model in IndexedDB, with a capped event log.

### 2.6 Security baseline

Ports published on `127.0.0.1` only; Host allow-list and Origin check, no CORS; a session token generated at first start and injected by the web tier, which protects the server from callers inside the container network that bypass the web tier (other origins are stopped by the Origin checks, other machines by the binding); body limit 256 KB by default, with measured per-route limits for archive writes (FR-044); `maxTokens` ceiling; model allow-list; rate limit per minute and daily spend cap from `llm_calls`. Detail in FR-040 to FR-050.

### 2.7 Language, i18n, graphics

- Story prompts stay Italian in v1, as versioned assets under `core/prompts/it`, byte-identical to the reference. The UI ships complete `it` (default) and `en` locales. English story prompts come later, recorded in `docs/alignment.md`.
- Graphics "slightly better, still light": procedural low-poly, ACES tone mapping, sRGB, one soft-shadow light, idle breathing, heads turning toward the speaker, eased camera cuts, DOM text for bubbles and labels, under 150 draw calls and 60 fps on an M3, FXAA only, one pinned modern three.js ESM version for both forms, before/after screenshots for every visual change.

### 2.8 Proof of sameness (handoff 3b, binding for every WI)

Differential tests against the oracle (state after N ticks, sequence of call kinds, events and chronicle); byte-identical prompts per call kind; every constant read from the reference with `file:line`; UI parity per screen with side-by-side Playwright screenshots and a row in `docs/parity.md`; a side-by-side playtest with the mock and a playtest with the real model at the end of every WI. A WI closes only with the owner's approval.

### 2.9 Planned contract additions (CONTRACT CHANGE, owner permission required)

| WI | Addition | Why | Permission |
|---|---|---|---|
| WI-2 | Routes `POST /api/games`, `GET /api/games/:id`, `POST /api/games/:id/commit`, `GET /api/games/:id/events`, `GET|POST /api/games/:id/reports` | `GameStore` in the web form (FR-052) | pending |
| WI-2 to WI-7 | New `LlmCallKind` values only if a ported module calls the model at a site not listed in FR-011 | the enum is generated from core | pending |
| WI-3 | Routes `GET` and `POST /api/records`, filtered by environment | rankings (AM-03, AM-04) | pending |
| WI-7 | Routes `GET`, `POST` and `DELETE /api/missions` | custom Venture missions (AM-04) | pending |
| WI-2 | The game routes accept the three environments from the start | the Venture (AM-04) | pending, with the WI-2 routes |
| WI-2 | Error code `conflict` reused for a stale `expectedSeq` (no new code) | atomic commit (P-04) | not a change |

Additions only: no field, route, value or status that exists after WI-1 is renamed or removed.

## 3. Work items

| WI | Name | Delivers | Ends playable as |
|---|---|---|---|
| WI-1 | Foundation | Monorepo, core ports and character model, server with archive and LLM proxy, both stores and clients for characters, legacy artifact built by the new pipeline, golden harness, parity inventory, CI | Web archive and settings; the game itself in the legacy artifact |
| WI-2 | Island core | Island engine moved into core (mechanical move, then typing), `GameStore` in both stores with the game routes, Showrunner for the island, the single style asset `core/prompts/it/style.md` (AM-05), differential and prompt-identity tests | Island playable headless and in the legacy UI |
| WI-3 | Island UI | Island screens in `packages/ui`, three.js scene, god mode, reports of the island | Island playable in the web app and the new artifact |
| WI-4 | Talk show | Talk-show logic extracted into core, Showrunner timeline goldens, studio UI | Talk show playable in both forms |
| WI-7 | Venture | The Venture core (arbiter, world, turn, council as in `venture.js`, command, agendas, trust, landing party, bets, medals, score, novel chapters, interview, director levers), the 6 missions as content and custom missions, setup with crew picking, the 3D bridge with the stage player on a Showrunner timeline, sounds, voices, fast forward, Command by the player or a model, ranking, campaign, home card, differential goldens from `tests/venture.test.js` with STYLE evaluated (AM-05) | The Venture playable in both forms; its report and novel arrive with WI-5 |
| WI-5 | Reports and books | Shared report model, relation graph, A5 book PDF without a characters page for every environment, novel, `ventureReport` and the Venture book | Reports and books in both forms |
| WI-6 | Switch-over | The new artifact replaces the legacy one; legacy retired; migration aids | One codebase, two forms |

Order of work: WI-1, WI-2, WI-3, WI-4, WI-7, WI-5, WI-6 (Amendment 1). WI-3 and WI-4 offer only present characters in their pickers (`archui.js:165-166`, `talk.js:274, 617`).

## 4. WI-1 Foundation

### 4.1 User scenarios and testing

#### User Story 1: Manage the character archive in the web app (Priority: P1)

The player opens the web app on their own machine, sees the 58 ready-made characters (16 present, 42 future), reads a card, edits a character in the editor, sees the version history and restores an older version, imports their own character files and exports the archive.

**Why this priority**: The archive is the only player-facing feature of WI-1, and it carries the characters into every later environment.

**Independent test**: Start the local stack, open the archive, edit one section of a character, restore the previous version, import a markdown file, export the archive, and import that export into the legacy `test.html`.

**Acceptance scenarios**:

1. **Given** a fresh database, **When** the stack starts for the first time, **Then** the archive lists exactly the 58 ready-made characters (the 16 present of `archpack.js` and the 42 future of `archpack-futuro.js`), with their relations resolved.
2. **Given** a character, **When** the player edits a section and saves, **Then** the version number grows by one, and the history gains a row for the previous version, with its number and timestamp and the reason "modifica manuale" (the reason of the save that replaced it, `archui.js:37, 305`); the history keeps the 15 prior versions plus the current one.
3. **Given** a character with older versions, **When** the player restores version N, **Then** a new current version is created from N's data, the version it replaces enters the history with the reason "ripristino vN", and no existing row is rewritten (`archui.js:293`).
4. **Given** a `personaggio/1` markdown file, **When** the player drops it on the archive, **Then** the editor opens as a preview with the recognised sections, the count of recognised sections, the note about text that went to "Altro" and a warning on duplicate names; nothing is saved until "Controlla e salva" (`archui.js:251`).
5. **Given** an `archivio/1` JSON file exported by the legacy artifact, **When** the player imports it, **Then** each character is added, or skipped when the stored one has `updated >= incoming.updated` (`archui.js:249`).
6. **Given** the web archive, **When** the player exports it, **Then** the file is `{ schema: 'archivio/1', exported, chars }` without versions (`archui.js:211`), and the legacy artifact imports it with the same characters and relations.
7. **Given** a character with relations from others, **When** the player deletes it, **Then** a confirmation shows how many versions and relations are lost, and the relations that pointed to it are removed from the other characters in the same atomic write (`archui.js:294-295`).
8. **Given** a character, **When** the player disables it, **Then** it stays in the archive, marked as disabled, and is hidden from game choices (`archui.js:165`); a deceased character is shown as deceased and is distinct from both.
9. **Given** alive, deceased and disabled characters, **When** the player switches the filter, **Then** the four legacy filters `vivi`, `deceduti`, `disattivati` and `tutti` select exactly as `archui.js:232` does, and the counter reads "(N vivi · M deceduti · K disattivati)", the last part only when K > 0 (`archui.js:231`).

#### User Story 2: Configure the language model (Priority: P1)

The player chooses the provider (Anthropic or LM Studio) among those configured on the server, picks a model per tier from the allowed list, runs a test call, lowers the budget if they want, and picks the interface language.

**Why this priority**: Without a working model nothing in WI-2 onward can run; the test call proves the whole path now.

**Independent test**: With LM Studio running on the host, select it, pick a loaded model for each tier, press "Prova", and see the answer and its latency.

**Acceptance scenarios**:

1. **Given** the server is configured for Anthropic and LM Studio, **When** the player opens the settings, **Then** both providers are listed, and for each tier only models on the allow-list are offered (for LM Studio, the loaded models that are also allowed).
2. **Given** a selected provider, **When** the player presses the test button, **Then** one `probe` call goes through `POST /api/llm` and the answer, the latency and the token counts are shown.
3. **Given** LM Studio reports a context shorter than 8K tokens, **When** the settings page loads, **Then** a warning says that the loaded model's context is too short for the full character prompts (the compact prompt profile that answers it arrives with WI-2).
4. **Given** the env ceilings, **When** the player sets a daily spend cap or rate higher than the ceiling, **Then** the server refuses it; lower values are accepted.
5. **Given** the interface language is changed, **When** the page reloads, **Then** every visible text is in the chosen language.

#### User Story 3: Know that the services are healthy (Priority: P2)

A status bar shows the provider, the model per tier and the health of the server, the database and the provider.

**Independent test**: Stop LM Studio while the web app is open and see the provider state turn to unavailable within one health poll.

**Acceptance scenarios**:

1. **Given** all services are up, **When** the player looks at the status bar, **Then** it shows the provider, the models per tier and three healthy indicators.
2. **Given** the session token is missing or wrong (for example, the volume was removed), **When** any request fails with 401, **Then** the player sees a plain message in the current language that says how to restart the stack, never a raw error.

#### User Story 4: Keep playing the game meanwhile (Priority: P2)

The home page offers the island, the talk show and the Venture with the notes "arriva con il WI-3", "arriva con il WI-4" and "arriva con il WI-7" and a link to the published artifact, where the game is played until then.

**Independent test**: From the home page, the three entries open the published artifact link configured for the install.

**Acceptance scenarios**:

1. **Given** `ARTIFACT_URL` is configured, **When** the player opens the island, talk-show or Venture entry, **Then** the published artifact opens in a new tab, and the entry shows "arriva con il WI-3", "arriva con il WI-4" or "arriva con il WI-7".
2. **Given** `ARTIFACT_URL` is not configured, **When** the home page loads, **Then** the three entries show their note without a link, and nothing breaks.

#### User Story 5: Developer builds and checks the artifact (Priority: P1)

A contributor runs `pnpm --filter @unscripted/artifact build` and gets `dist/index.html` and `dist/test.html`, byte-identical to the output of `build.py`, and a smoke test plays a short island game and a short talk show on `test.html` with the mock, without console errors.

**Independent test**: CI runs the build, the byte comparison against `build.py` and the smoke test on every push.

**Acceptance scenarios**:

1. **Given** the vendored sources, **When** the build runs, **Then** the md5 of `dist/index.html` and `dist/test.html` equal those of `build.py`'s output (SC-003).
2. **Given** one vendored file is changed by one byte, **When** the tests run, **Then** the manifest test fails and names the file.
3. **Given** `dist/test.html`, **When** the smoke test plays, **Then** the island advances at least one game hour, the talk show shows at least three lines, a short Venture mission plays at least two turns, and the console has no error.

#### User Story 6: Developer records and checks goldens (Priority: P1)

A contributor runs `pnpm golden:record island --seed 777 --ticks 300` and `pnpm golden:check`; the check replays the legacy island engine headless and finds identical output, every time.

**Independent test**: Ten consecutive record runs produce byte-identical files.

**Acceptance scenarios**:

1. **Given** the same arguments, **When** the record runs ten times, **Then** the ten outputs are byte-identical.
2. **Given** `--seed 777`, **When** a golden is recorded, **Then** its header's island seed is 777, not 0 (the fixed island).
3. **Given** the long run of FR-097, **When** it is recorded, **Then** the game reaches day 8 and every engine kind of FR-011 appears in the call sequence, except the kinds listed as exempt with a reason.
4. **Given** a golden recorded on Node 22, **When** `golden:check` runs on another Node major, **Then** it refuses to run and says why.

### 4.2 Edge cases

- Two tabs edit the same character: the second save carries a stale expected revision and gets a conflict; the editor offers to reload without losing the typed text.
- The player deletes one of the seeded characters and restarts the stack: the seed does not bring it back (FR-024).
- An imported file has a relation to a character name that does not exist: the relation is kept as pending and becomes a link when that character appears (`archui.js:85-88`).
- An imported markdown file is over 200,000 characters: it is refused with the legacy message (`archui.js:82`).
- An imported JSON contains `__proto__`, `constructor` or `prototype` keys: it is refused before any processing.
- Several characters share a name (dead characters and new lives, `archui.js:209`): allowed; names are not unique.
- The provider answers with text that is not JSON: the server returns `unparseable`; the probe shows it as a failed test with the reason.
- The provider rate-limits: `POST /api/llm` answers 429 `rate_limited` with `Retry-After` set by the server as S-08 says; the probe shows "riprova tra N s" with that value.
- The daily spend cap is reached: `POST /api/llm` answers 429 with code `budget` and no `Retry-After`; the status bar shows the cap reached.
- A model is missing from the price table: the server refuses to call it (fail closed), and it is not offered in the settings.
- LM Studio is not running: `GET /api/models` returns the configured providers with `lmstudio` marked unavailable; the page still loads.
- PostgreSQL starts slower than the server: the server waits for the database, runs migrations under `pg_advisory_lock`, and only then reports healthy; the web container waits for that.
- Two server instances start at once: the advisory lock serializes migrations and the seed.
- The browser's IndexedDB is unavailable (private mode): `IndexedDbStore` reports `unavailable`, and the artifact UI says the archive cannot be saved in this browser. The legacy falls back to localStorage `isola-archivio` instead (`archui.js:26-31`); this difference is a parity row and an entry in `docs/alignment.md`, because the new artifact does not ship before WI-6 and the fallback's 5 MB quota cannot hold the archive with its versions.
- A ready-made character was soft-deleted and the player presses "Personaggi pronti": the archived row is restored as a new version with reason `pacchetto`, keeping its id, so the uuid never collides (FR-024).
- An archive exported by the web app (uuids) is imported again: ids that are already uuids are kept, so the skip rule matches and no duplicate appears (FR-017).
- An archive file carries inline `versions` (`[{ v, at, why, data }]`). The legacy export strips them (`archui.js:211`), and the pack and the reference file `archivio-personaggi-isola.json` hold empty arrays (measured); only hand-made files or raw dumps of the legacy IndexedDB carry them. For a character that is new to the archive, they become rows of the version history, keeping `why` and `at`, with FR-017 applied to the relations inside each snapshot. For a character that replaces a stored one, the file's versions are discarded and the stored history is kept, as `archSave` does (`archui.js:37, 249`).
- A character created in a game has an age outside 3-95 (the god mode accepts any age from the model, `engine.js:1347`; `archui.js:140` stores it unclamped): the record accepts it as is. The 3-95 clamp belongs to the markdown parser (`archui.js:70`) and to the editor's save (`archui.js:297`), as in the legacy.
- An imported archive has more than 12 secrets or goals, or sections longer than 20,000 characters: it is accepted, because only the markdown parser caps them (`archui.js:75-78`); the editor and the JSON import do not (`archui.js:59, 249, 298-299`).

### 4.3 Functional requirements

#### Monorepo and tooling

- **FR-001**: The repository MUST be a pnpm workspace with `packages/core`, `packages/ui`, `apps/web`, `apps/server`, `apps/artifact` and `tools/golden`, TypeScript strict everywhere outside `legacy/`.
- **FR-002**: `engines.node` MUST be `>=22 <23` with `engine-strict`, `.nvmrc` MUST say 22, and `packageManager` MUST pin pnpm. The default development path MUST be the containers (`docker compose -f docker-compose.local.yml run --rm server pnpm ...`), because the owner's host has Node 26 and no corepack; a host Node 22 is optional and installed only with the owner's go.
- **FR-003**: ESLint MUST enforce the boundaries of A-02 and ban `dangerouslySetInnerHTML`; Prettier MUST format everything except `apps/artifact/legacy/`, which is also excluded from ESLint and `tsc`.
- **FR-004**: Vitest MUST run every workspace with v8 coverage and per-package thresholds: core 90% lines and branches, server 80%, `packages/ui` and `apps/web` 70%. The exclusion list is closed and written in the config: `legacy/`, generated Drizzle migrations, `*.d.ts`.
- **FR-005**: `.gitignore` MUST ignore the contents of `.envs/.local/` and `.envs/.production/` but not their `*.example` files (today the whole folders are ignored, so the examples cannot be committed).

#### `packages/core`

- **FR-010**: Core MUST export the ports of 2.2 and `LlmCallKind`, `LlmError`, `StaleWriteError`, `BackoffPolicy` and `BudgetGovernor`.
- **FR-011**: `LLM_CALL_KINDS` MUST contain the legacy island kinds verbatim, because they are persisted in `G.callsByKind` (`engine.js:26`) and shown in the consumption panel (`ui.js:862`): `mente`, `regista`, `animali`, `mare`, `biografia`, `intervista`, `analisi`, `racconto`, `episodio`, `previsione`, `mistero`, `oggetto`, `schizzo`, `cerchio`, `gruppo`, `romanzo`, `god mode` (with a space, `engine.js:1492`). It MUST add the talk-show kinds, which do not exist in the legacy: `talk-host` and `talk-guest` (`talk.js:200`), `talk-listen` (`talk.js:153`), `talk-voice` (`talk.js:384`), `talk-twist` (`talkfun.js:129`), `talk-offair` (`talkfun.js:83`), `talk-review` (`talk.js:670`), `talk-story` (`talk.js:683`), `talk-recap` (`talk.js:701`); and `probe` for the settings test. A guard test MUST fail when a literal `ask('<kind>'` in the vendored sources is not in the list, and when the vendored talk-show sources do not contain exactly the 8 `tsAsk(` call sites above (the definition at `talk.js:69` excluded), mapped to their 9 kinds in a committed table (`talk.js:200` maps to `talk-host` and `talk-guest`). The server's TypeBox enum MUST be generated from the same constant. Amendment 1 (AM-06): the list also holds the 15 Venture kinds `bibbia`, `agende`, `mondo`, `ascolto`, `battuta`, `ordine`, `comando`, `esecuzione`, `esterni`, `racconto`, `diario`, `sbarco`, `intervista`, `report`, `romanzo` (the strings shared with the island are the same value; the environment comes from the game) and `archive-generate` for the archive generator (`archfuturo.js:108-115`), added before the WI-1 freeze so that no later contract change is needed. The guard test also covers the 17 literal sites of `venture.js` with their tiers (main: `agende` 279, `mondo` 614, `battuta` 635, `ordine` 640 and 651, `esterni` 640, `comando` 648, `sbarco` 693, `bibbia` 711, `report` 717, `romanzo` 776 and 783, `intervista` 857; light: `ascolto` 623, `esecuzione` 667, `racconto` 688, `diario` 702) and the generator's call site.
- **FR-012**: Core MUST provide a tolerant JSON extractor (first balanced JSON value in a text, code fences and trailing prose tolerated), the seeded `Rng` with the same algorithm the golden harness uses, the `migrate` chain and the `GameEvent` base schema (`schema_version`, `seq`, `kind`, `gameTime`, `actor`, `payload`).
- **FR-013**: Core MUST define the character model as a zod schema derived from the legacy record (`archui.js:34`): `schema` (`personaggio/1`), `id`, `legacyId`, `version`, `revision` (owned by the store: never written by the `archivio/1` export, ignored on import), `updated`, `name`, `sex` (`m`|`f`), `age` (any integer; the 3-95 clamp belongs to the markdown parser and to the editor's save, `archui.js:70, 297`), `temper`, `short`, `tags`, `sections` (`identita`, `storia`, `carattere`, `valori`, `paure`, `parlata`, `relazioni_stile`, `altro`), `secrets`, `goals` (no length caps in the record: the 20,000-character and 12-item caps belong to the markdown parser, FR-014), `relations` (`to`, `type`, `int`, `view`), `pendingRelations`, `status` (`vivo`|`deceduto`), `disabled`, `life`, `lives`, `deaths`, `origin`, `sessions`, `summary`. The legacy inline history `versions` (`[{ v, at, why, data }]`, `archui.js:37`) is not part of the record: on import it follows the inline-versions rule of the edge cases (rows for a new character, discarded when the character replaces a stored one). Unknown fields MUST pass through at the root only, so no legacy data is lost, and `__proto__`, `constructor` and `prototype` keys MUST be rejected. Amendment 1 (AM-07): the record also has `era` (any value other than `'futuro'` means present, `archfuturo.js:28`), `role` (as stored by the parser, the editor or the generator), `style` and `venture` (`{ missions, log (last 10), medals (last 20) }`, `ventureui.js:564-569`), with their legacy names and no cap or enum in the record. The campaign writes to `venture`, `status` and `deaths` are in-place updates (P-03).
- **FR-014**: Core MUST port `archParse` and `archToMarkdown` (`archui.js:54-84`, `127-136`) with the same section synonyms (`archui.js:15-17`), the same key-value header lines, the same limits (sections at 20,000 characters, secrets and goals at 12, files at 200,000 characters), the same fallback name from the file name and the same derivation of `short`. The Italian messages MUST be the legacy ones. Amendment 1 (AM-07): the parser also reads `Epoca` (`futuro` when it starts with «futur»), `Ruolo preferito` and `Ruolo` (stored as `archRoleKey(v) || v.slice(0, 40)`, with `archRoleKey` ported from `archfuturo.js:22-27`) and `Stile` (capped at 80) (`archui.js:69-70`); the serializer writes them for future characters only (`archui.js:128`), and the template takes the era (`archui.js:89-126`).
- **FR-015**: Parser tests MUST use the 16 characters of `archpack.js`, the 42 future sheets of `archpack-futuro.js`, and the 61 markdown sheets of the reference character folder `design/characters/` (19 present, of which 3 exist only as files and are fixtures, not content; 42 future), copied as test fixtures, plus a round-trip test (`archToMarkdown` with secrets, then `archParse`) that preserves every markdown-representable field, the new keys included.
- **FR-016**: Core MUST implement the `Archive` planners of P-03a, each returning one batch, and each write is a versioned save or an in-place update exactly where the legacy is (P-03). The reasons that can be stored are those of versioned saves over an existing character: `modifica manuale` (`archui.js:305`), `ripristino vN` (`293`), `import archivio` (`249`) and `pacchetto` (only for the soft-deleted case of FR-024). First saves (`creazione`, the pack, the seed) store none, and in-place updates store none either. The edit planner also applies the editor's normalisations (`archui.js:297-303`): an empty name is refused with "Il nome è obbligatorio."; the name loses `<` and `>`; the age is clamped to 3-95 (35 when empty); sections are trimmed and empty ones removed; secrets and goals are taken one per line, trimmed, with empty lines dropped; an empty relation type becomes `conoscenti`, and relations to the character itself are dropped. Symmetric relations are an option of the edit, on by default, as the editor's "vale per entrambi" checkbox, with the legacy inconsistency warning (`archui.js:278, 304-306`). The legacy saves each affected character separately (`archui.js:294`); the port writes them in one atomic batch, an improvement recorded as a parity row. Amendment 1 (AM-07): the editor's save also writes `era` from the select for every character; for a future character `role` is one of the 8 keys or `''` and `style` is trimmed and loses `<` and `>`; for a present character `role` and `style` are deleted (`archui.js:297`). The generator forces `era: 'futuro'`, the role key and a name of at most 40 characters (`archfuturo.js:122`).
- **FR-017**: Character ids MUST be uuids. On import the discriminator is the id's form (Amendment 1, AM-16): a non-empty string id that is not a uuid is a legacy id, `c_…` and the `f_…` ids of the future pack included, and becomes the uuid v5 of that id in one fixed namespace (a tested core constant), with `legacyId` kept; an id that is already a uuid is kept as is; a missing id gets a fresh uuid, as in the legacy (`archui.js:249`); an empty or `null` id also gets a fresh uuid, a v1 deviation with a parity row. The same mapping applies to archive files, the packs and the seed. One id map is built per import and applied to the ids and to every relation `to` field (snapshots included), so a relation always points to the same uuid as its target. The `archivio/1` export writes, for each character and for each relation `to`, the target's `legacyId` when present and its uuid otherwise, so both forms re-import it without duplicates. For the import skip rule (`archui.js:249`) a soft-deleted row does not count: an imported character whose id maps to a soft-deleted row restores that row as a new version with the legacy reason `import archivio`. A single-character JSON import gets a fresh id, as in the legacy (`archui.js:59`).
- **FR-018**: Core MUST serialize zod schemas to JSON Schema for `LlmRequest.schema`, with the zod major version pinned.

#### `apps/server`

- **FR-020**: Routes, each with a TypeBox schema for params, query, body and every response: `GET /api/health`, `GET /api/models`, `POST /api/llm`, `GET /api/settings`, `PUT /api/settings`, `GET /api/characters`, `POST /api/characters`, `GET /api/characters/:id`, `PUT /api/characters/:id`, `DELETE /api/characters/:id`, `GET /api/characters/:id/versions`, `POST /api/characters/:id/restore`, `POST /api/characters/pack`, `POST /api/characters/import`, `GET /api/characters/export`. Every write route runs the matching core `Archive` planner (P-03a) on the current records and applies the resulting batch in one transaction; route handlers hold no archive rule. The settings, restore and pack routes are additions to the handoff list (Council decisions C6 and C16).
- **FR-021**: Every error response MUST use one envelope, `{ error: { code, message } }`, with a closed list of codes and one HTTP status each: `invalid_request` 400, `unauthorized` 401, `forbidden_origin` 403, `not_found` 404, `conflict` 409, `payload_too_large` 413, `rate_limited` 429 (always with `Retry-After`, set as S-08 says), `budget` 429 (never with it), `internal` 500, `unparseable` 502, `denied` 502, `model_refused` 502, `unavailable` 503, `timeout` 504.
- **FR-022**: `PUT /api/characters/:id` and `POST /api/characters/:id/restore` MUST take `expectedRevision` in the body and answer 409 `conflict` on a stale one, so that an editor opened before an in-place update still gets the conflict; every batch is applied in one transaction or not at all. `PUT /api/characters/:id` MUST also take an optional `mode`, `versioned` (default, the editor's save with reason `modifica manuale`) or `inPlace`, so that the in-place game writes of later WIs (P-03) need no contract change.
- **FR-023**: `DELETE /api/characters/:id` MUST soft-delete (set `archived_at`) and remove the relations pointing to the character from the others, in the same transaction (P-03a); a soft-deleted character disappears from every list, export and game choice.
- **FR-024**: At start-up the server MUST run the Drizzle migrations for all tables of 2.5 under `pg_advisory_lock`, then add the 16 characters of `archpack.js` only once per database, gated by the `settings` marker `seed.archpack.v1`, as first saves (so, as in the legacy, no reason is stored for them); a restart never restores a deleted or edited character. "Personaggi pronti" (`POST /api/characters/pack` in the web form) MUST apply the legacy rule verbatim (`archui.js:209`): a pack character is skipped when a character that is not soft-deleted has its id, or when a character that is not soft-deleted has the same name, is not deceased and has a `storia` section. A pack character whose row is soft-deleted is restored as a new current version carrying the pack's data, and the archived version enters the history with the reason `pacchetto`; the legacy, after a hard delete, starts again at version 1, and this difference is a parity row. Tests cover the deceased, the missing-`storia` and the soft-deleted cases. Amendment 1 (AM-08): the 42 future sheets of `archpack-futuro.js` are content too, with their legacy ids, `updated` and origin (`archfuturo.js:33-39`). They are seeded once under their own marker `seed.archpack-futuro.v1` (the legacy loads them by itself once, only when no future character exists, `archfuturo.js:40-48`), and «Personaggi pronti» adds both packs with the same rule.
- **FR-025**: `POST /api/characters/import` MUST accept archive files only (`archivio/1` JSON, as written by `archui.js:211`, with or without inline `versions`) and apply the legacy skip rule (`archui.js:249`) through the core planner. Single `.md`, `.txt` and `.json` character files are parsed in core and opened as an editor preview, then saved through `POST /api/characters`.
- **FR-026**: `GET /api/characters/export` MUST return `archivio/1` without versions, importable by the legacy artifact unchanged.
- **FR-027**: `GET /api/models` MUST list the configured providers, their availability, the allowed models per tier and, for LM Studio, the loaded models and the context length.
- **FR-028**: `POST /api/llm` MUST take `{ kind, tier, lowLatency?, attempt?, prompt, schema?, maxTokens?, gameId? }` (`lowLatency` as in P-01a; `attempt` an integer from 0 to 5, 0 on the first try, as in S-08, anything else refused with 400 `invalid_request` and covered by a negative test), choose the model from the settings and the allow-list (the client never names a model), enforce the per-tier timeouts, the concurrency limits of L-01 and L-02 (calls without `gameId` share one bucket), the rate limit and the daily cap, run the tolerant extractor, and return `{ value, usage }`. It MUST NOT retry a provider call (S-08). Every call inserts one `llm_calls` row when it starts (outcome `in_flight`, so that the rate limit counts calls in flight) and completes it at the end with the prompt hash, provider, model, tier, kind, token counts, latency, outcome and error code; never the prompt text. At start-up, rows still `in_flight` from a previous process are marked `aborted`, so they stop counting toward the rate limit. Provider failures map to error codes by one closed table, with one negative test per row: A call whose `gameId` is absent or unknown is accepted and uses the per-call backoff scope (S-08); it is never an error.

  | Provider failure | Code |
  |---|---|
  | Anthropic 400 `invalid_request_error`, 413 `request_too_large`; LM Studio 400, including a context overflow | `invalid_request` |
  | Anthropic 401 `authentication_error`, 403 `permission_error` | `denied` |
  | Anthropic 404 `not_found_error` (unknown model); LM Studio 404 (model not loaded) | `model_refused` |
  | Anthropic 429 `rate_limit_error`, 529 `overloaded_error` | `rate_limited` |
  | Anthropic 500 and other 5xx; LM Studio 5xx; connection refused or reset | `unavailable` |
  | No answer within the tier timeout (L-03) | `timeout` |
  | Answer with no extractable JSON | `unparseable` |
  | Any other provider failure (for example 402, 408, 422) | `unavailable` |
- **FR-029**: `PUT /api/settings` MUST accept only a configured provider, models from the allow-list, and rate and spend caps lower than or equal to the env ceilings. Provider URLs and keys stay env-only. The interface language is a per-viewer preference stored in the browser, not a server setting.
- **FR-030**: Prices MUST live in one typed configuration file read at start-up. An Anthropic model without a price is refused (fail closed). LM Studio calls cost 0 and need no price entry. For LM Studio the allow-list is every loaded model, unless `LMSTUDIO_ALLOWED_MODELS` narrows it.
- **FR-031**: Defaults, all configurable by env: rate ceiling 120 calls per minute per install, daily spend ceiling 10 USD. Both are safety nets, not pacing (pacing is set by L-01 and L-02), and both are unmeasured interim values (Trinity decision D-14-2). They are replaced by measured values in the real-model playtests that close WI-2 (island at its highest speed) and WI-4 (talk show at its peak): the observed calls per real minute times 2, recorded with the measurement in `docs/security.md`. Both measurements are tracked tasks of those WIs.
- **FR-032**: Configuration MUST come only from environment variables, validated at start-up; the server refuses to start with an invalid configuration and names the variable.

#### Security

- **FR-040**: Every published port MUST bind `127.0.0.1`. The server port MUST NOT be published at all; the browser reaches the API only through the web tier.
- **FR-041**: The server MUST generate a random session token (at least 256 bits) at first start and write it to a named Docker volume shared read-only with the web container, with file permissions readable by both non-root users. The web tier (Vite dev proxy in local, nginx in production) MUST add it as a header to every `/api` request. It MUST never appear in any JavaScript bundle or browser-visible response. Every route except `GET /api/health` MUST require it (401 `unauthorized` otherwise). The web container MUST start only after the server reports healthy.
- **FR-042**: The web tier MUST refuse unknown hosts: Vite `server.allowedHosts` set explicitly; nginx with a `default_server` that closes the connection (444). The proxy MUST NOT rewrite `Host`: no `changeOrigin` in Vite, and `proxy_set_header Host $http_host` in nginx, whose default is `$proxy_host`. Vite MUST set `server.cors: false`, because its default sends CORS headers to localhost origins. nginx MUST set `client_max_body_size 16m` on the archive write routes, because its 1 MB default would answer with its own HTML 413 (FR-044). The token reaches nginx through a start-up hook that exports it before the configuration templates are rendered.
- **FR-043**: The server MUST check `Host` against an allow-list and, on every route, refuse with 403 `forbidden_origin` a request that carries an `Origin` not on the allow-list, or a `Sec-Fetch-Site` other than `same-origin` or `none` (so `same-site`, which any other port on `localhost` gets, is refused). No CORS headers are ever sent.
- **FR-044**: Body limits (413 `payload_too_large`): 256 KB by default and for `POST /api/llm`; 16 MB for every archive write route (`POST /api/characters`, `PUT /api/characters/:id`, `POST /api/characters/:id/restore`, `POST /api/characters/import`). Basis: the legacy caps neither a character nor an import (only the markdown parser caps sections and lists), so one bound must hold whatever the import accepted, or a character imported in one request could not be saved in the next. 16 MB holds about 3,485 characters of the largest pack size (4,814 bytes, measured). Tests save and import at the limit and just above it, with worst-case JSON escaping. `maxTokens` is clamped to 8,192 for `main` and 2,048 for `light`; `schema` is limited to 32 KB.
- **FR-045**: The rate limit and the daily spend cap MUST be computed from `llm_calls`. The day starts at midnight in the server's `TZ` (default `Europe/Rome`). The rate limit answers 429 `rate_limited` with `Retry-After`; the cap answers 429 `budget` without `Retry-After`.
- **FR-046**: Imports MUST be validated with zod before any write; the LLM answers MUST be validated by core before use.
- **FR-047**: Containers MUST run as non-root, with base images pinned by digest and health checks.

#### Stores and LLM clients

- **FR-050**: The two shared contract suites of P-03b MUST pass. The `CharacterStore` suite runs on the server's PostgreSQL store and on `IndexedDbStore` (fake-indexeddb): atomic `apply`, expected-revision conflicts with `StaleWriteError` (including after an in-place update), soft delete, 15 prior versions plus the current one with reason and timestamp, version numbers never reused, and in-place updates that add no row and keep the version. The `ArchiveClient` suite also proves that a symmetric edit and a delete cleanup leave the other characters' version and history unchanged. The `ArchiveClient` suite runs on `HttpStore` (real server and database) and `LocalArchive`: create, edit with symmetric relations, restore, disable, deceased, delete with relation cleanup, pack with the legacy skip rule, import with the skip rule and inline versions, export format, round trip of uuids and legacy ids.
- **FR-051**: `IndexedDbStore` MUST use its own database (`unscripted`), never the legacy `esperimento`; it compares the expected revision inside the same transaction.
- **FR-052**: `GameStore` is defined as types in WI-1 and implemented in both stores in WI-2, together with the game routes and one shared suite (Council decision C5). This gap is recorded in `docs/alignment.md`.
- **FR-053**: `HttpLlmClient` and `ArtifactLlmClient` MUST pass one shared contract suite: success returns `{ value }`; a rate limit becomes `rate_limited`, with `retryAfterMs` from `Retry-After` when present and empty otherwise (S-08); a budget refusal becomes `budget`; timeouts honour the `AbortSignal`; a runtime JSON error becomes `unparseable`; the legacy permission codes become `denied`; a refused light model becomes `model_refused` (matched as `engine.js:21` does); unknown failures become `unavailable`. `ArtifactLlmClient` maps `tier` and `lowLatency` to the three legacy option sets of P-01a and never decides a fallback itself: core does.

#### Docker

- **FR-060**: `docker-compose.local.yml`: `postgres:17-alpine` pinned by digest, with a volume and health check; `server` with `tsx watch` and source mounted; `web` on the Vite dev server; `extra_hosts: host.docker.internal:host-gateway`; health checks everywhere; only the web port published on `127.0.0.1`.
- **FR-061**: `docker-compose.production.yml`: `postgres`; `server` as a multi-stage build on `node:22-alpine` pinned by digest, non-root; `web` on `nginxinc/nginx-unprivileged` serving the build and proxying `/api`; the same health checks and binding rules.
- **FR-062**: `.envs/.local/*.example` and `.envs/.production/*.example` MUST list every variable with a safe default or a placeholder; a `backup` profile MUST run `pg_dump` on demand into a git-ignored folder.
- **FR-063**: A test MUST compare the OpenAPI document generated from the TypeBox schemas with a committed snapshot, so that any change to the API shape fails until the snapshot is updated on purpose.

#### `packages/ui` and `apps/web`

- **FR-070**: The pages live in `packages/ui`; `apps/web` only composes `HttpLlmClient` and `HttpStore` and mounts them.
- **FR-071**: Home: the archive (with counts per era), the settings, and the island, talk-show and Venture entries with the notes "arriva con il WI-3", "arriva con il WI-4" and "arriva con il WI-7" and a link to the published artifact URL, read from configuration.
- **FR-072**: Archive: list with the four legacy filters `vivi`, `deceduti`, `disattivati`, `tutti`, the counter and the search (User Story 1, scenario 9; `archui.js:231-232`), card, editor with every section of FR-013, version history with reason and restore, import by file picker and drag and drop, export of the archive (`archivio/1`) and of one character as markdown with or without secrets (`archui.js:127`), the "Personaggi pronti" action, disable and delete with confirmation, the downloadable template "⇩ Modello scheda" (`archui.js:89-126, 198, 210`), "⇪ Riempi da file" inside the editor (`archui.js:273`), the "vale per entrambi" checkbox, on by default, with its inconsistency warning (`archui.js:278, 304-306`), the "⚠ nome doppio" mark on cards (`archui.js:237`), and cards that show only the counts of secrets and goals, never their text. The delete confirmation keeps the legacy text "Si perdono N versioni e M rapporti" (`archui.js:295`): with soft delete the versions are no longer visible to the player, which is what the text says to them, and the difference is a parity row. The Italian texts MUST be the legacy ones. Amendment 1 (AM-09): tabs «🏝 Presente» and «🚀 Futuro» (`archui.js:194`); in the Future tab the 8 role groups in legacy order (`archfuturo.js:7-16`), each with «＋ Nuovo» and «✨ Genera» (kind `archive-generate`, the legacy prompt and retry schedule, output validated as `archGenParse` does: a string of 200 to 20,000 characters parsed by `archParse`, `archfuturo.js:118-122`), «＋ Nuovo personaggio» opening a captain there (`archui.js:205`), the Future empty state (`archui.js:244`); the editor field Epoca for every character and Ruolo preferito and Stile only when Epoca is futuro (`archui.js:268-270, 285`); search by style and the style on the card (`archui.js:233, 238`); the template download per era (`archui.js:210`). Crew picking («＋ A bordo», random draw, `venture-crew`) belongs to WI-7.
- **FR-073**: Settings and status bar as in User Stories 2 and 3; the status bar polls `GET /api/health` and `GET /api/models` every 10 s.
- **FR-074**: Every visible text MUST go through i18n, with complete `it` (default) and `en` locales and a test that both have the same keys.
- **FR-075**: The pages MUST meet the owner's interface gate: both themes, every state of every touched component, widths 320 to 1440 px and 200% zoom, WCAG 2.2 AA measured with axe, keyboard and screen-reader use, scripted screenshots. The archive pages follow the structure of the legacy archive (parity), and any departure is a parity row approved by the owner.

#### `apps/artifact`

- **FR-080**: The reference sources MUST be vendored unchanged under `apps/artifact/legacy/`, at the same relative layout, and nothing else: `island/sim.js`, `island/three.min.js`, `island/OrbitControls.js`, `island/jspdf.umd.min.js`, and in `island/live/` the files `build.py`, `shell.html`, `mock.js`, `style.js`, `engine.js`, `env.js`, `features.js`, `fun.js`, `scene.js`, `ui.js`, `funui.js`, `archpack.js`, `archui.js`, `archpack-futuro.js`, `archfuturo.js`, `llm.js`, `venture.js`, `venture-missions.js`, `ventureui.js`, `ventbridge.js`, `report.js`, `talk.js`, `talkfun.js`, `tests/venture.test.js` and `tests/fixtures/mission.md`, all from the 2026-11-17 snapshot. Not the built pages, the generator tools, `LEGGIMI.md`, backups, experiments or scripts of the reference folder. A `LICENSES` file carries the MIT texts of three.js (which also covers OrbitControls, which has no header of its own) and jsPDF. A SHA-256 manifest of exactly these files MUST fail on any change, addition or removal.
- **FR-081**: A TypeScript builder MUST reproduce `build.py`: `dist/index.html` byte-identical to `live.html`, and `dist/test.html` byte-identical to `test.html` as `build.py` writes it when run with an argument (mock injected). It MUST replace every occurrence, in the same order, with split and join (never `String.replace`, whose `$&` and `$'` patterns differ from Python), and a test MUST cover a fixture containing `$'` and `$&`. Amendment 1 (AM-11): it reproduces the 2026-11-17 `build.py` exactly, including its substitution order (SIM, SCENE, ENGINE and UI with the 13 files inserted before the final `})();` of `ui.js`, then STYLE, then ENV), which yields the page order with STYLE before ENGINE (`shell.html:472`).
- **FR-082**: A test MUST run `build.py` in a temporary copy (it writes into its working folder) and compare its output with the TypeScript builder's, byte for byte. CI needs python3.
- **FR-083**: A Playwright smoke test MUST serve `dist/test.html` with the vendored libraries at the same relative paths, play a short island game, a short talk show and a short Venture mission with the mock, and fail on any console error. It MUST also sample `SC.groundH` on a grid and compare it with the terrain function used by the golden harness (FR-092).
- **FR-084**: A size check MUST fail when `dist/index.html` exceeds 1,700,000 bytes (the legacy page is 1,350,264 bytes; 25.9% headroom, Amendment 1), proven by a negative fixture.

#### `tools/golden`

- **FR-090**: The harness MUST take its code from the output of the FR-081 builder (no second assembler) and evaluate, in a fresh `node:vm` context per run, exactly these inline scripts of `dist/index.html`, in page order: `window.ISLAND_RANDOM = true` (`shell.html:469`, without which `sim.js:27` returns the fixed island with seed 0), SIM, STYLE (`shell.html:472`; its `const NOVEL_STYLE` is read by the story prompts of ENV and FUN, Amendment 1, AM-12), ENGINE (which contains ENV, FEATURES and FUN). SCENE and UI are not evaluated; the pieces of them the engine needs come from FR-092 and FR-095 (terrain, start sequence, speed rule, archive link), extracted from the vendored files and hash-pinned. No DOM.
- **FR-091**: One `--seed N` MUST fix the PRNG that replaces `Math.random` (installed before SIM runs), the island seed read by `sim.js:28-29` and the size read by `sim.js:31` (through a storage shim filled before SIM runs; `--size` defaults to `big`), and `setup.seed` (`engine.js:117`). A test MUST assert that the golden header's island seed equals `--seed`. `Date.now`, `performance.now` and the timers MUST be faked, because `coolUntil`, `G.startedAt` and the speech-bubble times read them (`thinkSince` is in game hours, `engine.js:512, 1145`) (`engine.js:546, 561, 1433`; `fun.js:290, 352`); their start values are fixed and recorded in the header.
- **FR-092**: The shim MUST provide `window.SC.groundH` (`env.js:348`) by extracting the terrain functions of `scene.js` (`groundH` and its helpers, `scene.js:50-75`) with an AST, without loading three.js; the extraction is pinned to the vendored file's hash.
- **FR-093**: The harness MUST apply one in-memory, documented transform to the legacy engine so that both `SAMPLE.json` call sites (`engine.js:19` and `21`) also pass `kind`. It MUST fail if the transform does not match exactly 2 sites. The vendored files are never modified.
- **FR-094**: The mock LLM MUST answer by `(kind, per-kind ordinal)` from committed fixture files of answers the legacy accepts (S-06), cycled by ordinal, with a fixed latency per kind in fake time (non-zero, so that the "time stops while thinking" paths run, `engine.js:1141-1145`), and with `rate_limited` answers at scripted ordinals, so that the cooldown path runs. Every `SAMPLE.json` call consumes the next ordinal of its kind, retries included: a `rate_limited` scripted at ordinal k fails call k, and the retry is call k+1. It never reads the prompt text. Keying by actor is dropped (Council decision C1).
- **FR-095**: The driver MUST reproduce the browser exactly:
  - **Archive link.** The setup fixture's cast is made of pack characters loaded into an in-memory archive (the vendored `archpack.js` and the archive functions of `archui.js` that need no DOM). The driver replays `ui.js:110` in its order: `ENG.newGame(setup)`, then `archLinkCast(cast)`, which is not awaited and whose body (`archui.js:183-187`: `G.startedAt`, the sheets read by `sheetText`, `fun.js:457`, inside the mind prompt, `engine.js:458`) runs when `ARCH.ready` resolves, then `go()`. As in the browser, `ARCH.ready` is already resolved, so the body runs in the microtask drain after `go()`, and the first decision of p0 goes out without a sheet, exactly as in the legacy. The 3 s interval of `archSyncGame` fires first 3 s of fake time after `newGame` (in the browser its phase depends on page load, so the harness fixes it); both choices are recorded in the header. It also runs `archSyncGame` every 3 s of fake time (`archui.js:142-159`), which gives characters born during the game their id and sheet. The transcribed lines are hash-pinned like the speed rule. The process runs with `TZ=UTC`, because `archSyncGame` formats dates with `toLocaleDateString('it-IT')` (`archui.js:143`), and the header records `G.startedAt`.
  - **Start.** It replays the start sequence of `go()` (`ui.js:125-131`) without its DOM calls: `ENG.fogTick(true)`, `G.running = true`, then `ENG.decide(p0)` for the first agent that is alive, awake, not thinking and without a current action or plan. `stepTime` does nothing while `G.running` is false (`engine.js:1139`).
  - **Tick order, fixed and recorded in the header.** (1) Advance the fake clock by 100 ms, firing due timers one at a time in due order, with a full microtask drain after each. (2) Call `ENG.stepTime(0.1, speed)` (`ui.js:1005-1012`). (3) Drain microtasks again.
  - **Speed.** `speed` comes from the legacy `PACE.speed()` rule, including the doubling in dull stretches (`ui.js:754-757`), with the skip mode off and the base `ui.speed` taken from the setup fixture (legacy default 1, `ui.js:19`). `PACE.check()` is not run, because it acts only in skip mode (`ui.js:758`).
  - **Transcription.** The transcribed pieces of `ui.js` (the start sequence and the speed rule) are pinned by a test that compares the hash of the vendored source slice they come from.
  - **Excluded on purpose.** The UI interval of `funui.js:346` is not run. Its only effects on `G` are `betsTick` and `recordEnd`. The setup fixture places no bets, which the harness asserts. `recordEnd` acts only after the game has ended: it writes the leaderboard and sets `G._recorded = true` (`funui.js:236`). The digest of a golden that reaches the end therefore excludes `_recorded`, and the exclusion is listed in the header.
- **FR-096**: The setup passed to `newGame`, with its raw keys (cast, scenario, `days`, `mind`, `eco`, `circle`, `circleHaiku`, `res`, `forced`, from which the engine derives `G.mindModel`, `G.economy` and `G.eveningCircle`, `engine.js:122`, `fun.js:201`) and `thinkTime`, MUST come from a committed fixture, together with the base speed, which is not a setup field but `ui.speed` (`ui.js:19, 137`). The golden header records them, together with the seed, the speed rule, the tick order, the mock latencies, the fake-clock start values, the Node major version and the vendored-files manifest hash.
- **FR-097**: `pnpm golden:record island --seed 777 --ticks 300` MUST write a state digest every 50 ticks, the sequence of call kinds, every prompt with its kind and ordinal, and the chronicle. `pnpm golden:check` MUST replay every committed golden, compare, and refuse to run on a different Node major version. Here "engine kind" means the kinds of the ENGINE script only, not the Venture kinds (Amendment 1). The committed goldens MUST include:
  - **The short run** above.
  - **A long run.** Highest speed, at least to day 8, asserted on `G.day`, with a committed script of director actions at fixed ticks for the kinds that only a player triggers: god-mode text (`god mode`), interview (`intervista`), analysis (`analisi`), the novel button (`romanzo`, `funui.js:362-363`), a prediction (`previsione`, through `addPrediction`, `features.js:157, 162`) and the circle (`cerchio`, through `startCircle`, `fun.js:249`; the automatic evening circle of `fun.js:313` runs only when `G.eveningCircle` is set, which the setup fixture states either way).
  - **A kind-coverage check.** It fails unless every engine kind of FR-011 appears in the long run's call sequence, or is on an exemption list with a reason.

#### Documentation and CI

- **FR-100**: `docs/parity.md` MUST hold at least 200 rows (Amendment 1, AM-13: every item of handoff update 2.2 to 2.6 has a row, including the `ui.js` render skip, `venture-prefs` and the home card, and the campaign's design-versus-code contradiction is recorded) built from the reference source and the diaries, each with id, feature, acceptance check (with `file:line`), target WI, and status for web and for artifact. It MUST also record the known differences decided in this spec, each as a row in `docs/parity.md` and, where the web form and the artifact differ, as an entry in `docs/alignment.md` (constitution I): uuid ids with `legacyId`, inline versions turned into rows, seed semantics (the legacy adds the present pack only when the player presses "Personaggi pronti", and the future pack by itself once, `archfuturo.js:40-48`, `archui.js:209`, while the web form also adds it once when the database is created, FR-024), soft delete (FR-023), atomic relation cleanup (FR-016), no localStorage fallback (edge cases), the repair re-ask (S-06). It MUST correct the inventory of the handoff (section 1): `isola-archivio-v1` is the archive of past runs, capped at 12 (`ui.js:877-883`), while the character archive is `isola-archivio` (`archui.js:26`), and the god-mode kind is `god mode`.
- **FR-101**: `docs/architecture.md` with diagrams of the workspaces, the ports and the request path; `docs/security.md` with the threat model, the controls of FR-040 to FR-047, and the interim rate and spend defaults marked as unmeasured until the WI-2 and WI-4 playtests (FR-031).
- **FR-102**: Constitution 1.1.0 and `CLAUDE.md` MUST be amended for `packages/ui`, `tools/golden`, the full list of ports and the UI-level `Sound` capability, the new `LlmClient` signature and the tiers; README.md and README.it.md MUST be updated together with setup and run instructions.
- **FR-103**: GitHub Actions on every push and pull request: install, lint, typecheck, unit tests, server integration tests against a PostgreSQL service, artifact build with the `build.py` comparison, golden check, artifact smoke test. Nightly: the full end-to-end suite on the web app and the artifact.
- **FR-104**: The session diary is kept in Italian in `docs/diary/AAAA-MM-GG.md`.

### 4.4 Key entities

- **Character**: a versioned sheet (FR-013), identified by uuid, optionally linked to a legacy id, soft-deletable, with relations to other characters by id.
- **Character version**: an immutable snapshot of a character, with its number, reason and timestamp; the 15 prior versions are kept, plus the current one.
- **Archive file**: `archivio/1` JSON (`{ schema, exported, chars }`) or a `personaggio/1` markdown, text or single JSON file.
- **Setting**: a key-value pair for server concerns (provider, model per tier, lowered caps, seed marker).
- **LLM call record**: one row per call, with the prompt hash and its outcome, the source of the rate limit and the spend cap.
- **Session token**: a random secret shared by the server and the web tier, never seen by the browser.
- **Golden run**: a seed, a setup fixture, a mock fixture set and a header, producing digests, call kinds, prompts and the chronicle.
- **Parity row**: one player-facing feature with its acceptance check and status per form.
- **Record**: one ranking entry of an environment (island or Venture), with score, optional seed and its data.
- **Mission**: a custom Venture mission in `missione/1` text; the ready-made missions are content.

### 4.5 Success criteria

- **SC-001**: `docker compose -f docker-compose.local.yml up --build` reaches healthy on every service in under 3 minutes after the images are pulled, measured on the owner's M3.
- **SC-002**: Coverage at least 90% (lines and branches) for core, 80% for the server, 70% for `packages/ui` and `apps/web`; every route has at least one negative test.
- **SC-003**: `dist/index.html` and `dist/test.html` are byte-identical to the output of the 2026-11-17 `build.py` (md5 `49ff58739a82e54ae1cd3535a6f67267` and `e8bed20a56b9000bd6e7ed62dfba0b91`).
- **SC-004**: Ten consecutive golden record runs produce byte-identical files, `golden:check` passes, and the goldens recorded on the owner's arm64 machine pass `golden:check` on the x64 CI runner, both on Node 22.
- **SC-004a**: The long golden reaches day 8 and covers every ENGINE-script kind of FR-011 not on the exemption list.
- **SC-005**: `docs/parity.md` has at least 200 rows.
- **SC-006**: Security tests pass: a foreign `Origin` gets 403; a cross-site request without `Origin` gets 403; a missing token gets 401; a body over 256 KB gets 413; a reached rate limit gets 429 `rate_limited` with `Retry-After`; a reached spend cap gets 429 `budget`; no compose file publishes a port outside `127.0.0.1`, and the server port is not published.
- **SC-007**: A web archive export imported into the legacy `test.html` gives back the same characters with relations intact.
- **SC-008**: The archive and settings pages pass axe with zero violations in both themes.
- **SC-009**: The adversarial code review of WI-1 reaches CONVERGED, and every quality lens the work touches scores at least 8/10.

### 4.6 Assumptions

- Single player, on one machine, through `localhost`; no user accounts in v1.
- LM Studio runs on the host, not in Docker.
- The owner's host has Node 26 and Docker; development runs in containers unless the owner installs Node 22.
- The legacy artifact remains the place where the game is played until WI-3, WI-4 and WI-7; its LLM calls work only inside claude.ai (`talk.js:71`), while `test.html` runs anywhere with the mock.
- The 16 characters of `archpack.js` and the 16 markdown sheets of the reference are invented people; they are published as they are, by the owner's decision (section 4.9). The 42 future sheets and the 3 file-only present sheets await Q-17-2 (section 4.9).

### 4.7 Known limitations

- The web app has no game in WI-1: the island, the talk show and the Venture stay in the legacy artifact, the Venture until WI-7.
- `GameStore` is not implemented until WI-2 (FR-052).
- The session token protects the server only from callers inside the container network that bypass the web tier. Other origins are stopped by the `Origin` and `Sec-Fetch-Site` checks, and other machines by the `127.0.0.1` binding. None of the three stops a process of the same local user.
- The daily spend cap is estimated from token counts and a price table, not from the provider's bill.
- The golden mock is keyed by kind and ordinal, not by actor, because the legacy call site has no actor (C1).
- Story prompts exist only in Italian.

### 4.8 Council decisions

The council (architect, adversarial critic, game designer) voted on 14 open points on 2026-11-13 (C1-C14); C15 and C16 come from its "missing" lists, and C17 from the first adversarial review of 2026-11-14. The majority is applied; where the votes split, the coordinator chose and the choice is marked. Decisions taken under the owner's autonomy window of 2026-11-14 are logged as `D-14-n` in `docs/diary/decisioni.md`.

- **C1 Golden mock keying** (3/3 modify): kind passed by an in-memory transform of both call sites, `(kind, ordinal)` fixtures, fixed non-zero latency, scripted rate limits; keying by actor dropped. *Deviation from handoff section 5, item 8, to approve.*
- **C2 Golden driver** (3/3 modify): browser tick of 100 ms, the legacy speed rule including the dull-stretch doubling, terrain from `scene.js` by AST, fresh `vm` context, faked `Date.now` and `performance.now`.
- **C3 LLM result** (split 1 modify, 1 modify, 1 abstain; coordinator's choice): the port returns parsed `value`; the server parses; repair is one re-ask with a fixed suffix in both forms. Rationale: one owner of parsing per form, and the artifact runtime already returns parsed values.
- **C4 Call kinds** (3/3 accept, with the guard test and the `talk-host` / `talk-guest` split).
- **C5 Store scope** (2/3 against the proposal): ports split into `CharacterStore` and `GameStore`; only `CharacterStore` implemented in WI-1, in both stores; no in-memory store. *Narrows the handoff wording "Store" to characters in WI-1, to approve.*
- **C6 Settings routes** (3/3 modify): server concerns only, models from the allow-list, caps only lowered, URLs env-only, per-game model choice kept as a tier, locale in the browser.
- **C7 Session token** (3/3 modify): named volume, web waits for a healthy server, proxy-side host checks, `Origin` and `Sec-Fetch-Site` on every route, server port not published, plain 401 message.
- **C8 Identity** (3/3 modify): uuid v5 namespace constant, relation rewrite on import and back on export, root passthrough, prototype keys rejected, seed gated once, soft-deleted rows never re-seeded.
- **C9 Versions** (3/3 modify): 15 in both stores, with reason and timestamp, monotonic numbers, restore as a new version.
- **C10 Import and export** (3/3): legacy `archivio/1` both ways, single files as editor preview, drag and drop, legacy skip rule.
- **C11 Builder** (3/3 modify): split and join, temporary copy for `build.py`, SHA-256 manifest, legacy excluded from lint and format, license notices.
- **C12 Budget** (3/3 modify; measurement moved to the WI-2 and WI-4 playtests by D-14-2): interim rate default 120 per minute, spend 10 USD per day, prices in a typed file and fail closed, budget code pauses the game, size check proven by a negative fixture.
- **C13 Coverage** (3/3 modify): closed exclusion list, floors for UI and web, golden determinism tested.
- **C14 Toolchain** (3/3 modify): Node 22 range with engine-strict, containers by default, golden refuses another Node major.
- **C15 Soft delete** (architect, critic): `DELETE` sets `archived_at`; the visible behaviour matches the legacy hard delete, recorded in parity.
- **C16 One owner of archive rules** (critic, architect; revised after the first adversarial review): the core `Archive` planners (P-03a) run where the data lives, the server for the web form and the browser for the artifact; every write route is a thin wrapper around a planner and one transaction. The earlier batch route is dropped, and the restore and pack routes are added.
- **C17 Model selection** (first adversarial review): the fallback from the light model and `G.lightModel` stay a game rule in core; the request gains the optional fields `lowLatency` (P-01a) and `attempt` (S-08, which keeps the waits on the server as D5 decided), both additive to the handoff port.

### 4.9 Owner decisions: closed, provisional, open

- **Link to the published artifact** (closed, technical): it is the `ARTIFACT_URL` setting, empty by default (User Story 4).
- **Deviations C1 and C5, and the port addition C17** (provisional, owner to confirm). They change what the handoff asked. The owner told the Trinity to take every decision, merge included («fai tutto, anche il merge ecc», D-14-1); the Trinity decided them under that go (D-14-4, D-14-5). They stay provisional until the owner confirms or overturns them.
- **Other deviations from the binding sources** (provisional, owner to confirm under D-14-1):
  - **Failure handling.** The handoff (section 2) says the game never stalls, while S-06 pauses it where the legacy pauses (`engine.js:527-529`). The Trinity chose parity with the oracle, as handoff 3b requires.
  - **Session token.** Design-notes step 3 puts it in `.envs/.local/session-token`; it moves to a named volume (C7).
  - **`LlmClient` result.** Design-notes step 1 returns text; the port returns parsed values (C3).
  - **Routes.** The handoff route list grows by settings, restore and pack (C6, C16).
  - **Constitution I.** It names only `LlmClient` and `Store` as ports. The other ports of section 2.2 conflict with it until FR-102 amends it to 1.1.0, which is the first task of WI-1, so that no code lands under the old text: the amendment is the first commit of the WI-1 branch, with the version bump and the amendment-log entry. It reaches `develop` through the pull request of WI-1, as the constitution's governance asks.
- **Merge** (owner's go, D-14-1). The owner's «fai tutto, anche il merge ecc» is read narrowly. It allows the `--no-ff` merges of the WI-1 branch into the umbrella branch and then of the umbrella into `develop`, as `CLAUDE.md` prescribes, only after the internal final validation (full suite, review of the whole diff, 8/10 on every lens). It never allows `main` or a force-push. The merge is reported first on the owner's return.
- **Ready-made characters in a public repository** (closed by the owner on 2026-11-14, in chat: «Sì, così come sono»). The 16 characters are published as they are, in the vendored sources, the FR-015 fixtures, the FR-024 seed and the goldens. Two requirements pulled apart: the handoff asks to vendor the reference sources unchanged (FR-080), and the byte-identical build (SC-003) needs `archpack.js` as it is, while section 6 of the handoff forbids real names and two pack names echo real public figures. The owner settled it in favour of the unchanged sources (D-14-3).
- **Contract additions of section 2.9** (open, reserved to the owner). They are needed only from WI-2 on, and WI-1 does not depend on them. Amendment 1 adds the records and missions routes and the three environments of the game routes.
- **Q-17-1** (open, reserved to the owner; Amendment 1, section 3.2): whether v1 also builds the items designed in `note-allineamento.md` and `ux-ponte.md` but not built in the artifact. The Trinity's proposal: v1 is the 17 November artifact, and these items become a later work item.
- **Q-17-2** (open, reserved to the owner): publication of 45 new character sheets (the 42 future ones and 3 present ones that exist only as files). Until the owner decides, nothing carrying them is pushed.

The legacy wording "Claude chiede di rallentare" (`talk.js:74`) is false under LM Studio. It is a story text, so changing it needs the owner's approval. It does not affect WI-1 and is recorded in `docs/alignment.md` for WI-2 and WI-4.

## 5. FAQ

**Why is the legacy page built by a TypeScript builder, instead of keeping `build.py`?**
The two forms must be built by one pipeline in one toolchain, and CI must not depend on a script nobody runs. Keeping `build.py` as the oracle for a byte comparison gives the safety of the old tool while the new one takes over. The comparison test is what makes the replacement safe, not the rewrite.

**Why record goldens on the legacy engine before moving any code?**
Without them the port has nothing to be compared with, and every tuned behaviour could change without anyone noticing. The goldens fix the state, the call order, the prompts and the chronicle of the original, so that WI-2 can prove each moved module against them. This is the core of decision D2.

**Why patch the legacy engine in memory for the goldens, if the vendored files must not change?**
`SAMPLE.json` receives no kind (`engine.js:19`), so a mock keyed by kind cannot work without it, and the alternatives (reading the prompt, or guessing from counters) are either forbidden or ambiguous with two calls in flight. The transform adds one argument at exactly two sites, never touches the files on disk, and fails loudly if the source changes. The rest of the behaviour is untouched.

**Why not key the mock by actor, as the handoff asks?**
The actor is not in scope where the call is made, and inferring it from agents marked as thinking is ambiguous when two calls run at once. Since the move is mechanical and keeps the call order, the pair (kind, ordinal) identifies each call as precisely as (kind, actor) would. The deviation is listed for the owner's approval.

**Why a non-zero mock latency, if it makes the runs slower?**
With instant answers the paths where island time stops while a character thinks never run, and those paths fixed the castaways dying of thirst while waiting for the model. The latency runs in fake time, so it costs no real time. It is fixed per kind and recorded in the golden header.

**Why does the server parse the model's answer, instead of the browser?**
The artifact runtime already returns parsed values, so the port has to carry parsed values, and in the web form the server is the natural single owner of that step. Parse failures are logged in `llm_calls` with the outcome, which is where operational problems are looked for. Core still validates every value with zod before use.

**Why keep legacy kind names like `mente` and `god mode` in an English codebase?**
They are data, not identifiers: the island persists them in its state and shows them in the consumption panel, and the state goldens compare them. Translating them would change both. The TypeScript names around them stay English.

**Why implement only `CharacterStore` in WI-1, when the port includes games?**
No screen or engine uses games until WI-2, while the archive has a consumer in both forms from WI-1: the web pages, and the archive contract suite that the new artifact's pages will mount (the artifact itself stays the legacy build until WI-6). A games implementation with no screen and no engine behind it could only be tested against itself. WI-2 brings the game routes, both store implementations and one shared suite at the same time, which keeps the two forms aligned. The types exist now, so the design is fixed.

**What does the player lose if the database is deleted?**
The archive, since games are not stored until WI-2. The `backup` profile makes a `pg_dump` on demand, and the export gives a portable `archivio/1` file that both forms read. Restoring is a `psql` import of the dump, documented in the README.

**How does the design keep the web app and the artifact from drifting?**
Every rule, model and parser sits in core, both forms mount the same UI, and the two store and client pairs pass the same contract suites. The artifact build is tested byte for byte in WI-1 and replaced by the core-based build only in WI-6, after parity is shown row by row. Known gaps live in `docs/alignment.md`.

**Can a web page on another site use the player's API key through this server?**
It should not be able to, and each control has its own job. A request from another site is refused with 403 by the `Origin` and `Sec-Fetch-Site` checks. Another machine cannot reach any port, because everything binds `127.0.0.1` and the server port is not published at all. The session token covers the remaining path: a container that calls the server directly, bypassing the web tier, gets 401. A process of the same local user is outside this threat model, as the security document says.

**What stops a runaway cost?**
A rate limit and a daily spend cap computed from the call records, a per-tier ceiling on `maxTokens`, an allow-list of models, and a refusal for any model without a price. The player can only lower the caps from the settings page; raising them needs a change to the environment. Both defaults are declared unmeasured safety nets until the real-model playtests of WI-2 and WI-4 measure them.

**What latency and call volume should the player expect?**
With Anthropic, up to 3 calls in flight per game, and the legacy island never has more than 2 (`engine.js:13`). With LM Studio, one call at a time, at 20-40 s per call on the M3, which is why the island stops time while a character thinks. WI-1 itself makes LLM calls only for the settings test.

**Is a golden run reproducible across machines?**
It is designed to be, on the same Node major version. The seed fixes the PRNG, the island and the game; all clocks and timers are fake; and the tick order is fixed and recorded in the header. Whether V8's maths gives the same bits on arm64 and x64 is not assumed: SC-004 requires goldens recorded on the owner's arm64 machine to pass on the x64 CI runner. The harness also refuses to run on another Node major version.

**Why `pg_advisory_lock` for migrations?**
Two server processes can start together, for example after a crash restart. Without a lock they would race to apply the same migration and to seed the same characters. The lock makes both steps run once.

**What are the failure modes of the session token, and how does the player recover?**
If the token volume is removed while the stack runs, the server and the web tier disagree and every request gets 401. The player sees a plain message that says to restart the stack, which regenerates and shares the token. The token never needs to be typed.

**Why not keep unlimited versions on the server, since a database has room?**
The two stores must pass one contract suite, and the legacy behaviour the player knows keeps 15. A different retention on each side would make the forms drift. The number is one constant, easy to change for both if the owner wants more.

**Why a soft delete, when the legacy deletes for real?**
From WI-2 on, games reference character versions (`game_participants`), so a hard delete would either break the history of past games or cascade into it. A soft delete keeps that history intact, while the player sees the same thing as in the legacy: the character is gone from every list, export and game choice, and the "Personaggi pronti" action can add a deleted ready-made character again, as in the legacy, because its skip rule looks only at characters that are not deleted. The difference is recorded in `docs/parity.md`.

**What leaves the player's machine, and what is kept?**
With Anthropic, every prompt leaves the machine, character sheets and secrets included, because the model needs them to play the characters. With LM Studio nothing leaves the machine. The server stores only a hash of each prompt in `llm_calls`, never the text; the rows are kept until the player deletes the database volume, and the security document says so.

**Who retries a rate-limited call, and how many times?**
Only core retries, at most 5 times, as the legacy does. In the web form the server computes each wait with the core `BackoffPolicy`, as D5 decided, and passes each provider 429 back once with that wait; in the artifact core computes it. The server itself never retries, so the attempts never multiply between the two. A test pins one provider 429 to one server answer and one core retry.

**What alternatives were rejected?**
A clean rewrite (it would lose tuned behaviour), pure event sourcing (slow resumes and heavy replays), a relations table (two sources of truth), a separate light UI in the artifact (two UIs drift), backoff in the browser for the web app (the server is the only place that sees all calls), and an in-memory store (no consumer). The reasons are in `design-notes.md` and section 4.8.
