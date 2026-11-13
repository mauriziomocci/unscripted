# Prompt for Claude Code: continue the Unscripted v1 port

Paste everything below the line into Claude Code, started on the Mac in an empty working folder (`/Users/mauriziomocci/Documents/workspace/Opensource`).

---

You are taking over the project **Unscripted** (an open-source game: free-willed AI characters on a stage the player directs). Your job is to port the existing Claude artifact into this repository so that the new web app does **exactly** what the artifact does today, while the artifact keeps being built from the same code and never drifts apart. Precision matters more than speed: nothing the artifact does may be silently lost or changed.

## 0. Set up the workspace (do this first, then stop and report)

1. Clone the repository from the bundle and publish it:
   ```bash
   git clone ~/Downloads/unscripted.bundle /Users/mauriziomocci/Documents/workspace/Opensource/unscripted
   cd /Users/mauriziomocci/Documents/workspace/Opensource/unscripted
   git remote set-url origin https://github.com/mauriziomocci/unscripted.git
   git push -u origin main develop 20261113-111328-v1-port
   git checkout 20261113-111328-v1-port
   ```
   The GitHub repository `mauriziomocci/unscripted` already exists and is empty.
2. Unpack the reference implementation **outside** the repository, as read-only reference material:
   ```bash
   mkdir -p /Users/mauriziomocci/Documents/workspace/Opensource/unscripted-reference
   unzip -q ~/Downloads/esperimento-isola/esperimento-isola-sorgenti.zip -d /Users/mauriziomocci/Documents/workspace/Opensource/unscripted-reference
   ```
   The sources are in `/Users/mauriziomocci/Documents/workspace/Opensource/unscripted-reference/island/live/`, with `sim.js` and the three.js, OrbitControls and jsPDF copies in `/Users/mauriziomocci/Documents/workspace/Opensource/unscripted-reference/island/`. The built page is `~/Downloads/esperimento-isola/esperimento-sociale-isola-talkshow.html`, the same build as the published artifact version `1794502765-533a`. Player feedback history, in Italian, is in `island/lavori-2026-11-12/diario-2026-11-12.md` and in `~/Downloads/esperimento-isola/diario-2026-11-12.md`.
3. Verify the reference is the right one: `md5 /Users/mauriziomocci/Documents/workspace/Opensource/unscripted-reference/island/live/talk.js` must print `c59b511113266df966734d3b747442cd`.
4. Read, in this order and in full: `CLAUDE.md`, `.specify/memory/constitution.md`, `README.md`, `specs/20261113-111328-v1-port/design-notes.md`. They are binding. If they disagree, the constitution wins, then CLAUDE.md, then the design notes.
5. Report what you found, then wait for my go-ahead.

## 1. What the reference contains (inventory you must preserve)

The reference is one HTML page, about 960 KB of hand-written JavaScript, assembled by `live/build.py`:
- `shell.html` gets `../sim.js`, `scene.js` and `engine.js` injected at `/*__SIM__*/`, `/*__SCENE__*/` and `/*__ENGINE__*/`.
- `env.js`, `features.js` and `fun.js` are injected at `/*__ENV__*/` inside the engine closure.
- `/*__UI__*/` gets `ui.js` with this text inserted before its final `})();`, in this order: `funui.js`, `archpack.js`, `archui.js`, `report.js`, `talk.js`, `talkfun.js`.
- `test.html` is the same page with `mock.js` prepended and local copies of three r128, OrbitControls and jsPDF 2.5.1.

| Module | Responsibility |
|---|---|
| `sim.js` | Seeded RNG (`rngFrom`, mulberry32-like), random island geometry `ISL` and resources, `LOC` coordinates, weather generator `genWeather` |
| `engine.js` | Island state `G` (`newGame`, `makeAgent`); perception, mind prompt, decisions, director, action physics; animals; god mode (`applyOps`, `godText`); time and sleep; save and restore (`localStorage` key `isola-esperimento-v1` with progressive slimming); LLM queue (`MAX_INFLIGHT = 2`, backoff on `rate_limited` from 15 s doubling, at most 5 retries, fallback from the light model to the main model) |
| `env.js` | Tides (12.42 h), moon (29.5 d), drift and what the sea brings, wounds, diet, biographies, perception of the environment, daily story, interviews, analysis, fog of war |
| `features.js` | Scenarios, secrets, mysteries, camp objects, rare events, dog, medals, predictions, weekly episode, ages, radio, story hours |
| `fun.js` | Names, gestures, moods, habits, sketches (SVG from the LLM, `cleanSvg`), pets, spectacles, supplies, world modes, social circle, group stats, adding people, novel chapters and title |
| `scene.js` | three.js island, sea, palms, props, creatures, people (`makePerson`, `posePerson`), labels, sand writing |
| `ui.js`, `funui.js` | Island UI: setup, layout, panels, minimap, records (`isola-classifica`), charts, PDF and downloads, speed and pause modes |
| `archpack.js` | 16 ready-made characters in schema `personaggio/1` |
| `archui.js` | Character archive: IndexedDB `esperimento` / store `chars` with a localStorage fallback, markdown import and export (`archParse` with section synonyms), versions |
| `report.js` | Shared report model `{ env, title, subtitle, date, people, relations, sections, chapters, appendix }`, relation graph SVG, A5 book PDF |
| `talk.js`, `talkfun.js` | Talk show: state (`talk-sessione`), host and guests from the archive, turn picking, listening, chorus, poses, twists, moments, televote, off air, claque, replay, studio 3D, UI |

Artifact runtime capabilities used: `window.claude.use('sample')` (LLM, called as `SAMPLE.json(prompt, opts)`), `window.claude.use('downloads')`, `window.claude.use('tts')`.

LLM call kinds in the island: `mente`, `regista`, `animali`, `mare`, `biografia`, `intervista`, `analisi`, `racconto`, `episodio`, `previsione`, `mistero`, `oggetto`, `schizzo`, `cerchio`, `gruppo`, `romanzo`, `god`. The talk show calls the LLM through `tsAsk(prompt, quick)`. List its call kinds yourself, from `talk.js` and `talkfun.js`.

Other localStorage keys: `isola-setup-v1`, `isola-cast-v1`, `isola-layout-v2`, `isola-archivio-v1`, `isola-names`, `isola-island-seed`, `isola-island-size`, `isola-foto`.

## 2. Decisions already taken (do not reopen them without asking me)

A review council of three independent reviewers (architect, adversarial critic, game designer) decided these unanimously. The details and reasons are in `design-notes.md`.

- **D1. One shared React UI.** `packages/ui` is used by both forms. The web app and the artifact differ only in the adapters they inject.
- **D2. Strangler migration, not a rewrite.** Record golden characterization tests **before** moving any code. The first move is mechanical: `Math.random` becomes `ctx.rng()` in the same call order. Typing comes after, and each module must pass a strict-typing gate before it leaves its `legacy/` folder.
- **D3. Latest state plus an append-only event log, committed together.** One atomic commit per tick or beat, with `expectedSeq`. No pure event sourcing.
- **D4. Relations live in the state.** Every change also emits a `relation_changed` event with delta and reason. There is no relations table.
- **D5. Concurrency, backoff and budget run on the server** for the web app. `Retry-After` and cool-downs flow back to core, which shows them inside the fiction, as the in-show commercial break or the "slow down" overlay.
- **D6. Six work items, each ending playable:**
  - WI-1 Foundation
  - WI-2 Island core
  - WI-3 Island UI
  - WI-4 Talk show
  - WI-5 Reports and books
  - WI-6 Switch-over

  The current branch `20261113-111328-v1-port` is the umbrella. Each WI gets its own Spec Kit branch off it.
- **Stack:** pnpm workspaces; `packages/core` (pure TS, `lib: ES2022`, no DOM, no node types); `packages/ui`; `apps/web` (Vite); `apps/server` (Node 22 + Fastify + TypeBox + Drizzle + PostgreSQL 17); `apps/artifact` (Vite single-file build). Vitest, Playwright, ESLint with boundary rules, Prettier, GitHub Actions.
- **LLM providers:**
  - `anthropic`: official SDK, model per tier from env; 3 calls in flight per game, 6 in total.
  - `lmstudio`: OpenAI-compatible at `LMSTUDIO_BASE_URL` (default `http://host.docker.internal:1234/v1`); concurrency 1; `response_format: json_schema` built from the zod schema; context length read from the provider, with a compact prompt profile below 8K and a UI warning.
  - Both: timeouts per tier (main 90 s, light 30 s; lmstudio 180 s and 60 s), one repair retry, then a safe fallback beat (rest, silence or gesture). The game never stalls.
  - Model names never appear in core.
- **Ports in core:**
  - `LlmClient.complete({ kind, tier: 'main' | 'light', prompt, schema?, maxTokens?, gameId?, signal? })`
  - `Store` (characters, games, an atomic `commit({ gameId, expectedSeq, events, state })` that throws `StaleWriteError`, events paging, reports)
  - `Clock`, `Scheduler`, `Rng` (seeded)
  - optional `Speech` and `Downloads`

  No state change across an `await`: an LLM answer becomes a validated intent tagged with the actor and `stateVersion`, applied by a single reducer in request order, and dropped if stale.
- **Data model (PostgreSQL):** `characters`, `character_versions`, `games` (with `last_seq` and a lease), `game_participants` (uuid identity, names are data), `game_state`, `game_snapshots`, `events` (unique `(game_id, seq)`, zod payload per kind with stage directions), `reports`, `llm_calls` (prompt hash only, nullable token counts), `settings`. `schema_version` on state, characters and events, with pure `migrate` functions. The artifact stores the same model in IndexedDB with a capped event log.
- **Security:**
  - Ports published on `127.0.0.1` only; Host allow-list and Origin check, no CORS.
  - Session token generated at first start and passed to the web container.
  - Body limit 256 KB, `maxTokens` ceiling, model allow-list on the server.
  - Rate limit per minute and daily spend cap computed from `llm_calls`.
  - LLM output is parsed, validated with zod and clamped, never executed. Sketches are parsed into a whitelisted SVG tree rendered as React elements, and lint bans `dangerouslySetInnerHTML`.
- **i18n:** v1 story prompts stay Italian and behaviour-tuned, as versioned assets under `core/prompts/it`. The UI ships complete `it` (default) and `en` locales. English story prompts come later and are recorded in `docs/alignment.md`.
- **Graphics, "slightly better, still light":**
  - procedural low-poly with no external assets; ACES tone mapping and sRGB; one soft-shadow light;
  - idle breathing; heads turn toward the speaker; looks taken from the archive card; eased camera cuts;
  - bubbles and labels as escaped DOM text;
  - under 150 draw calls and 60 fps on an M3, no post-processing beyond FXAA;
  - one pinned modern three.js ESM version for both forms, with before/after screenshots for any visual change.
- **The legacy artifact is frozen** after WI-1: bug fixes only, new features go into core.

## 3. Behaviour that must survive exactly (the "soul")

The pacing makes the game feel alive. Move every constant below into a core `Showrunner` timeline driven by the injected clock, with the same values, and cover it with timeline goldens (event kind, clock offset, camera shot):
- the next line is generated while the current bubble is still typing;
- the listening call runs in parallel with the line on screen, capped at 15 s;
- typing at 32 chars/s, then a hold of 1.8-5 s depending on length;
- an interruption cuts the current line after at least 1.5 s and leaves a faded ghost bubble;
- 400 ms gaps between lines;
- chorus exclamations staggered;
- when the model is late, the gap is filled with reaction shots and gestures, never dead air.

Verify every number against `talk.js` and `talkfun.js` before copying it, and record the source line in a comment.

Talk-show rules to keep, with their current probabilities and caps:
- a third voice joins at 30% base, 45% when the tone is heated, 60% after 2 exchanges and 85% after 3; the duel stops by itself after 4;
- who joins depends on feelings toward each duellist, the side taken, being named, a raised hand and time spent silent;
- the host lets between 5 and 7 lines pass between guests, or 8 with the provocative style, and moderates when 3 or more guests want to speak;
- line formats: jab, normal, rant and long;
- interruptions;
- outside voices: director, phone, audience, a guest entering, anonymous message, big screen;
- moments: point-blank question, duel of 6 lines, televote, off air (1 call; starts by itself on 70% of breaks);
- claque, best-5 replay, whispers, pinned thoughts, studio events remembered for 5 lines, opinions (`opinioni`) changing during the show.

Island rules to keep:
- time stops while a character is thinking, and the 🧠 pause, slow and continue modes;
- speeds up to 60×; an hour at 1× lasts 10 s; nights run about 3 times faster;
- death and bodies, the raft, ships, rescue;
- all god mode operations and the free-text god mode;
- animals directed by the LLM;
- notebook, sand writing, carvings, amnesia;
- fog of war, minimap, name labels (key L);
- the novel (one chapter per day), album, records, replay, the "reopen and continue" and "review" flows.

Characters are never scripted: code decides only the physical world, turn order, budgets and rules. Keep the prompt wording exactly; any change in wording is a behaviour change and needs my approval.

## 3b. How sameness is proven (binding for every WI)

The goal is that the new project behaves like the current artifact: the same rules, prompts, probabilities, timings, screens and features. Publishing the artifact on claude.ai is not required. The reference code in `unscripted-reference` is the **oracle**. Compare every ported piece against it, not against a description of it.

1. **Differential tests.** For every ported module, run the original headless (through the `tools/golden` shim) and the new core with the same seed, the same fake clock and the same mock answers. Compare:
   - the state after N ticks;
   - the sequence of LLM call kinds;
   - the events and the chronicle.

   Every difference is either a bug to fix or a deliberate choice recorded in `docs/alignment.md` with my approval.
2. **Byte-identical prompts.** For every call kind, given the same state, the prompt built by the new core must be byte-identical to the one built by the original, with one test per kind.
3. **Verified constants.** Read every probability, timing, threshold and cap from the original code and annotate it with file and line. Never take a number from memory, or from this prompt, without checking it.
4. **UI.** For every screen and panel of the original, the new version has the same features, the same commands (keyboard shortcuts included) and the same Italian texts. Check each one with a side-by-side Playwright screenshot of old and new, and with a row in `docs/parity.md`. The graphics may be slightly better but must stay recognizable: nothing is removed or moved without my approval.
5. **Playtest.** At the end of every WI, prepare two playtests for me: old and new side by side with the same seed and the mock, and a game with the real model. A WI closes only with my approval.

## 4. How to work (binding)

Follow the workflow in CLAUDE.md for every work item, with no shortcuts:
1. Spec Kit: `/speckit-specify` for the work-item branch, then spec, plan and tasks.
2. The three-step design process.
3. A FAQ in every spec.
4. An adversarial review by a separate subagent with a hostile mandate, until the verdict is CONVERGED.
5. Tasks of 2-5 minutes flagged one at a time.
6. The 8-point review before every commit.
7. Conventional Commits with no reference to AI.
8. No auto-push.
9. README.md and README.it.md updated together.

For decisions the spec does not settle, convene the review council (three independent subagents: architect, adversarial critic, game designer), apply the majority, and record the decision in the spec. Ask me only for irreversible choices or matters of taste.

Report status as "verified in the running app", "tests passing, manual check pending" or "unit tests only". Never claim more than that.

## 5. First task: write the WI-1 spec

On branch `20261113-111328-v1-port`, `specs/20261113-111328-v1-port/spec.md` still holds the empty Spec Kit template. Replace it with the umbrella spec:
- the cross-cutting architecture from section 2, as binding rules for all WIs;
- the WI table;
- **WI-1 Foundation** in full detail, with the user stories, edge cases, functional requirements, key entities, success criteria, assumptions, known limitations and FAQ below.

WI-1 delivers:
1. **Monorepo and tooling:** pnpm workspaces, strict TS, ESLint with boundary rules, Prettier, Vitest, Node 22.
2. **`packages/core`:**
   - the port interfaces, `LlmCallKind`, `BackoffPolicy`, `BudgetGovernor`;
   - a tolerant JSON extractor, seeded RNG, the `migrate` chain, the `GameEvent` base schema;
   - the character model with its zod schema, plus a `personaggio/1` markdown parser and serializer ported from `archui.js` (`archParse`), with tests that use real files from `archpack.js` and the project character files.
3. **`apps/server`:**
   - routes: `GET /api/health`, `GET /api/models`, `POST /api/llm`, `GET|POST /api/characters`, `GET|PUT|DELETE /api/characters/:id`, `GET /api/characters/:id/versions`, `POST /api/characters/import`, `GET /api/characters/export`, with TypeBox schemas;
   - Drizzle schema and migrations for **all** tables, run at start-up under `pg_advisory_lock`; idempotent seed of the 16 characters from `archpack.js`;
   - the full security baseline from section 2.
4. **Two Store implementations and two LLM clients** that pass **shared contract test suites**: `HttpStore` and `IndexedDbStore` (using fake-indexeddb in tests); `HttpLlmClient` and `ArtifactLlmClient`.
5. **Docker:**
   - `docker-compose.local.yml`: postgres:17-alpine, server with tsx watch, web on the Vite dev server, source mounted;
   - `docker-compose.production.yml`: postgres; server as a multi-stage build on `node:22-alpine` pinned by digest, non-root; web on `nginxinc/nginx-unprivileged` proxying `/api`;
   - health checks everywhere; `extra_hosts: host.docker.internal:host-gateway`;
   - `.envs/.local` and `.envs/.production` with committed `.example` files;
   - an on-demand `pg_dump` backup profile;
   - everything published on 127.0.0.1.
6. **`apps/web`:**
   - home;
   - archive: list, card, versioned editor, import, export;
   - settings: provider, models per tier, a test call, budget, locale;
   - a status bar with provider, models and health;
   - island and talk-show entries that say "coming in WI-3/WI-4" and link to the artifact meanwhile;
   - all text through i18n, `it` and `en`.
7. **`apps/artifact`:**
   - vendors the reference sources **unchanged** under `apps/artifact/legacy/`;
   - reproduces `build.py` in TypeScript, so that `pnpm --filter @unscripted/artifact build` produces `dist/index.html` and `dist/test.html` **byte-identical** to `build.py`'s output (add a test that runs both and compares);
   - a Playwright smoke test opens `test.html` with the mock and plays a short island game and a short talk show with no console errors;
   - a size budget check.
8. **`tools/golden`:**
   - runs the legacy island engine headless in Node, through a minimal shim with no DOM, with `Math.random` replaced by the seeded PRNG, fake timers, and a mock LLM keyed by call kind and actor (never by prompt text);
   - `pnpm golden:record island --seed 777 --ticks 300` writes the state digest every 50 ticks, the sequence of call kinds and the chronicle; `pnpm golden:check` replays and compares;
   - 10 consecutive runs must be identical.
9. **`docs/parity.md`:** at least 120 rows, built from the reference source and the diaries. Each row has an id, the feature, an acceptance check, the target WI, and a status for web and for the artifact. Also `docs/architecture.md` with diagrams, `docs/security.md`, constitution 1.1.0 and CLAUDE.md amended (`packages/ui`, the list of ports, the new `LlmClient` signature, tiers), and README.md and README.it.md updated together.
10. **GitHub Actions:** install, lint, typecheck, unit, server integration tests with a postgres service, artifact build and smoke on every push and PR; full e2e nightly.

WI-1 success criteria:
- `docker compose -f docker-compose.local.yml up --build` is healthy in under 3 minutes after the images are pulled;
- coverage at least 90% for core and at least 80% for the server, with a negative test for every route;
- artifact output byte-identical to `build.py`;
- goldens deterministic;
- parity rows at least 120;
- security tests pass: foreign Origin 403, missing token 401, oversized body 413, budget 429, LAN bind check;
- the adversarial code review reaches CONVERGED.

After writing the spec, run the adversarial spec review with a subagent until CONVERGED, show me the result, and wait for my approval before `/speckit-plan`.

## 6. Constraints

- **Language:**
  - English for code, comments, docs, commits and specs;
  - Italian for README.it.md and the in-game Italian locale;
  - talk to me in Italian, concisely.
- **No emoji** in code, comments, docs, logs or commits. Emoji are allowed only in locale files, as UI content.
- **No real people:** the host, the show and every character are invented, and no real names may appear.
- **Never commit secrets.** `.envs/` is git-ignored.
- **Keep a diary** of every session in Italian under `docs/diary/AAAA-MM-GG.md`: what was asked, what was decided, what was verified and how.
