# Amendment 1 to the umbrella spec and WI-1: the 17 November reference

Status: three-step design complete; adversarial review CONVERGED with full coverage; approved provisionally by the Trinity (D-17-2) (the owner delegated decisions to the Trinity for this piece on 2026-11-17, see `docs/diary/decisioni.md`, D-17-0).

Input: `docs/handoff/claude-code-v1-update-2026-11-17.md`. The owner's decision, verbatim: **«deve entrare tutto»**.

This document follows the constitution's three-step design process. Steps 1 and 2 are kept as a record. Step 3 is the consolidated amendment, which is applied to `spec.md` only after the review converges and the amendment is approved. WI-1 has no code yet, so the amendment changes no delivered work.

## 0. Facts verified (2026-11-17)

These facts were checked on the Mac before any design. Every `file:line` below refers to the snapshot `unscripted-reference/2026-11-17/island/live/` unless stated otherwise.

- **Integrity.** md5 of `venture.js` `e6e40279aeaaf82d080f277645421b94`, `ventureui.js` `76ea67c83c5b870dad36a15a06032d04`, `talk.js` `b66bdbd7dd5c6340737c2da7426e0f46`: as the handoff states.
- **Build.** In a temporary copy, `python3 build.py` writes a `live.html` byte-identical to `published/esperimento-sociale-1794922407-478d.html` (md5 `49ff58739a82e54ae1cd3535a6f67267`, 1,350,264 bytes). `python3 build.py mock` writes `test.html` with md5 `e8bed20a56b9000bd6e7ed62dfba0b91`.
- **Tests.** `node tests/venture.test.js` prints `ALL OK`. The run ends at turn 18 with 122 calls (`bibbia` 1, `agende` 1, `ascolto` 18, `battuta` 18, `ordine` 18, `esterni` 20, `esecuzione` 18, `racconto` 18, `mondo` 7, `diario` 3).
- **What changed since 14 November.**
  - Unchanged: `engine.js`, `features.js`, `scene.js`, `archpack.js`, `talkfun.js`, `sim.js`.
  - Changed: `env.js`, `fun.js`, `funui.js`, `ui.js`, `archui.js`, `report.js`, `talk.js`, `mock.js`, `shell.html`, `build.py`.
  - New: `style.js`, `archfuturo.js`, `archpack-futuro.js`, `llm.js`, `venture.js`, `venture-missions.js`, `ventureui.js`, `ventbridge.js`, `tests/venture.test.js` (with `tests/fixtures/mission.md`), `tools/pack_future.py`, `tools/pack_missions.py`.
- **Island and talk-show call sites.** The 17 island kinds are unchanged. The 8 talk-show `tsAsk(` call sites moved: `talk.js:153, 200, 384, 670, 683, 701` and `talkfun.js:83, 129`.
- **Venture call sites** (`venture.js`, literal kinds with their tiers): `agende` main (279), `mondo` main (614), `ascolto` light (623), `battuta` main (635), `ordine` main (640, 651), `esterni` main (640), `comando` main (648), `esecuzione` light (667), `racconto` light (688), `sbarco` main (693), `diario` light (702), `bibbia` main (711), `report` main (717), `romanzo` main (776, 783), `intervista` main (857). That makes 15 kinds at 17 sites, as the handoff lists.
- **A model call with no kind.** The archive generator «✨ Genera» calls the runtime directly (`archfuturo.js:108-115`). It always uses the main model, retries a rate limit at most 3 times with waits of 15 s × 2^attempt, and has no in-flight cap. The handoff does not list it.
- **A third queue.** `llm.js` runs the Venture queue: 2 calls in flight, at most 4 retries, waits of 15 s × 2^attempt per call, one cooldown end shared through `Math.max`, and the refused light model falls back to Sonnet quick. Every logical call is counted once (`llm.js:33-47`).
- **Record keys.** `era`, `role`, `style` and `venture`. The handoff calls the second one `preferredRole`; the record key is `role`. Their exact rules:
  - `era`: any value other than `'futuro'` means present (`archEra`, `archfuturo.js:28`).
  - `role`: the parser stores `archRoleKey(v) || v.slice(0, 40)` (`archui.js:70`); the editor stores a key from a select (`archui.js:269`); the generator forces the role key and caps the name at 40 (`archfuturo.js:122`).
  - `style`: the parser caps it at 80 characters (`archui.js:70`); the editor field is capped at 80 (`archui.js:270`).
  - When the editor saves a present character, it deletes `role` and `style` (`archui.js:297`).
  - `venture`: written by the campaign (`ventureui.js:564-569`) as `{ missions, log (last 10), medals (last 20) }`. A death also sets `status: 'deceduto'` and appends `'venture:' + seed` to `deaths`. The write is in place: `archSave` on the stored object, so it creates no version (P-03).
- **The markdown parser** accepts the header lines `Epoca` (`futuro` when it starts with «futur», otherwise present), `Ruolo preferito`, `Ruolo` and `Stile` (`archui.js:69-70`). The serializer writes them only for future characters (`archui.js:128`).
- **The ready-made future crew.** `archfuturo.js:33-39` parses the 42 embedded sheets with `archParse`, gives them fixed ids, `updated = '2026-11-16T12:00:00.000Z'` and origin `{ env: 'venture' }`, and appends them to `ARCH_PACK`. «Personaggi pronti» therefore adds both packs. The future pack also loads by itself once, under the flag `venture-pack-auto`, and only when the archive has no future character yet (`archfuturo.js:40-48`).
- **The selected crew** is stored in localStorage `venture-crew` (`archfuturo.js:19, 172-173`), not in the archive store, as the handoff says.
- **The island and talk-show pickers** offer only present characters (`archui.js:165-166` for the island, `talk.js:274, 617` for the talk show).
- **Ids of the future pack** have the form `f_<slug>`, that is `f_` followed by a slug of the name (42 of 42, `archpack-futuro.js`). They are not `c_` ids.
- **Venture failures** (`venture.js:605`, `ventureui.js:217-218`).
  - Every failed call becomes a logged fallback.
  - A turn that throws is rolled back to its snapshot, and the game pauses.
  - Reaching the call cap ends the game as `tetto`, keeping a reserve for the report (`REPORT_RESERVE`).
- **Venture model state.** `haikuOk` lives in the page module, not in the game state, and resets on reload. A refused Haiku disables Haiku for both tiers. The fallback uses up a retry and goes back through the cooldown and the slot (`llm.js:16, 36-45`).
- **Rankings.** The island keeps the top 30 by score, one per seed (`funui.js:236`). The Venture keeps the last 100 (`ventureui.js:555`).
- **The Venture novel prompt** reads `NOVEL_STYLE` through a `typeof` guard (`venture.js:762`). `tests/venture.test.js` evaluates `venture.js` alone (`tests/venture.test.js:3-4`), so its prompts have no style, unlike the page.
- **Further archive changes** (`archui.js`):
  - search also matches the style (233), and the card shows it (238);
  - the Future tab has its own empty state (244);
  - «＋ Nuovo personaggio» opens a captain in the Future tab (205);
  - `archOpen(era)` opens a given tab (217);
  - the editor shows the role and style fields only for the future (285).
- **Spec citations.** Of the 111 distinct `file:line` citations in `spec.md`, 71 point to unchanged lines and 40 have moved. Of those 40, 33 moved without change and 7 changed content: `archui.js:70, 89, 165, 207, 208, 288` and `talk.js:673`.
- **Page size.** The legacy page is now 1,350,264 bytes, above the 1,200,000-byte budget of FR-084.
- **Design versus code.** The design document says the campaign never touches the base sheet (`design/venture/specifica-ambiente-venture.md`, section 15). The code writes `c.venture` and `status: 'deceduto'` into the archive card (`ventureui.js:564`), and the handoff confirms it as archive data (handoff 2.4, item 8).
- **Designed but not built.** `design/venture/note-allineamento.md` lists parts of the design that the artifact does not do yet:
  - the mutiny procedure and the forced medical veto;
  - pause at the end of a call, not at the end of a turn;
  - five tabs on phones;
  - bridge comforts (zoomed map, per-person filter, adjustable announcements);
  - a landing scene split between bridge and team;
  - campaign damage and reputation between missions;
  - the IndexedDB v2 layout;
  - extraction of the council engine;
  - one queue for the island and the talk show;
  - the time gate between eras.

## 1. Step 1: initial proposal

P1. **Reference.** The binding reference becomes the 2026-11-17 snapshot, with the integrity values above. Rule A-06 freezes this snapshot once WI-1 lands. Any artifact change before then repeats the procedure: a dated snapshot and a handoff note.

P2. **Character model (WI-1).** Add `preferredRole`, `era`, `style` and `venture`, as the handoff names them.

P3. **Content (WI-1).** The 42 future sheets become content seeded with the present pack.

P4. **Build (WI-1).** The TypeScript builder follows the new `build.py`.

P5. **Home (WI-1).** Three environments.

P6. **WI-7 Venture.** A new work item after WI-4 and before WI-5, as the handoff proposes.

P7. **WI-5.** The book has no characters page, one style asset is shared, and `ventureReport` is added.

P8. **Contract.** Add the Venture call kinds to section 2.9 as planned additions, reuse the game routes for `env: 'venture'`, and add a records list.

P9. **Alignment.** No new gap.

## 2. Step 2: first critical self-review

**Critical**

- **K1. The style asset is placed too late.** `NOVEL_STYLE` already enters the island daily story (`env.js`) and novel chapter (`fun.js`), and the talk-show story (`talk.js:683`). WI-2 must reproduce the island prompts byte for byte, so the style has to exist as a core asset in WI-2, not in WI-5. *Fix:* the style asset `core/prompts/it/style.md` lands with the first ported prompt that uses it (WI-2). WI-5 keeps only the book and the reports.
- **K2. The page breaks FR-084.** At 1,350,264 bytes the legacy page fails the 1,200,000-byte check, and WI-1 could never pass. *Fix:* a budget of 1,700,000 bytes, which is 25.9% headroom, the same margin as before.
- **K3. The golden harness would run without `NOVEL_STYLE`.** `env.js` and `fun.js` read the top-level `const NOVEL_STYLE` from the new STYLE script, which runs before ENGINE (`shell.html:472`). FR-090 evaluates only ISLAND_RANDOM, SIM and ENGINE, so the engine would throw on the first story prompt. *Fix:* evaluate ISLAND_RANDOM, SIM, STYLE and ENGINE, in page order.
- **K4. "Deve entrare tutto" has two readings.** The handoff says everything the artifact gained goes into v1. The designed-but-unbuilt items of `note-allineamento.md` are not in the artifact, so there is no oracle to prove them identical. Putting them in v1 is a new requirement; leaving them out may contradict «senza rimandare niente». *Fix:* v1 is the 17 November artifact, proved against the oracle. The unbuilt items are listed one by one as an open question for the owner. The Trinity does not decide it, because it changes what the owner asked for.

**Important**

- **I1. Key names.** *(Superseded in part by 3.0 and AM-07: the stored role is not free text.)* The record key is `role`, not `preferredRole`. Renaming it would break the `archivio/1` round trip with the legacy artifact. *Fix:* keep the legacy keys `era`, `role`, `style` and `venture` in the record. `role` keeps the free text as written, and `archRoleKey` normalises it to one of the 8 roles only for grouping.
- **I2. A call kind is missing.** The archive generator has no kind and is not in the handoff. The archive is WI-1's, so «✨ Genera» is WI-1's too. *Fix:*
  - a new kind `archive-generate` on the main tier, with its own legacy retry schedule (3 retries, per call);
  - a prompt byte-identical to `archGenPrompt`;
  - output validated as `archGenParse` does: a string of 200 to 20,000 characters, parsed by `archParse`.
- **I3. Kinds as planned additions cost a later contract change for nothing.** All 15 Venture kinds are known now, and the enum freezes when WI-1 merges. *Fix:* add them, and `archive-generate`, to `LLM_CALL_KINDS` in WI-1. Section 2.9 then needs no entry for them. The guard test extends to the 17 literal sites of `venture.js`, each with its tier.
- **I4. S-08 derives the backoff scope from the kind, which no longer works.** `intervista`, `racconto` and `romanzo` are both island and Venture kinds. The Venture schedule is also different (4 retries, per-call doubling, one shared cooldown end), and so is the archive generator's. *Fix:* the scope and the schedule follow the environment of the game (server: from `gameId`; artifact: from the calling module). A call without `gameId` (`probe`, `archive-generate`) uses the per-call scope with its own retry cap. `BackoffPolicy` holds four named legacy schedules: island, talk show, Venture and archive generator.
- **I5. Model selection.** *(Superseded by 3.0 and AM-02: the Venture rule differs from the island's.)* P-01a limits the light-model fallback to island kinds. `llm.js` applies the same rule to the Venture: a refused light model goes to Sonnet quick, which is `main` plus `lowLatency`, and a refused Haiku mind goes to Sonnet (`llm.js:25-27, 42`). *Fix:* P-01a covers the island and the Venture. The talk show and the archive generator keep no fallback.
- **I6. The data model is incomplete.** WI-1 creates all tables (FR-024), but nothing holds the rankings (`isola-classifica`, `venture-records`) or the player's custom missions (`venture-missions-custom`), and `games.environment` lacks `venture`. *Fix:* add a `records` table (`id`, `environment`, `game_id` nullable, `score`, `data` jsonb, `created_at`) and a `missions` table (`id`, `title`, `source` as the `missione/1` text, `created_at`, `archived_at`), and add `venture` to the environment enum. The ready-made missions are content, not rows.
- **I7. Seeds.** The future pack loads by itself once, only when no future character exists yet, while the present pack is button-only in the legacy (`archfuturo.js:40-48`, `archui.js:209`). *Fix:* the web form seeds both packs once, under separate markers `seed.archpack.v1` and `seed.archpack-futuro.v1`. "Personaggi pronti" adds both packs with the legacy skip rule. A deleted character never comes back.
- **I8. Citations.** 40 citations moved and 7 changed content. *Fix:* every citation in `spec.md` is re-based on the 2026-11-17 snapshot, and the 7 changed lines are re-read before re-citing. The FR-013 parser limits, the editor normalisations and the pack rule are checked against the new code.
- **I9. Crew picking has no consumer in WI-1.** «＋ A bordo», the random draw and `venture-crew` live in the legacy archive screen, but they only serve the mission setup. *Fix:* they belong to WI-7. WI-1 delivers the era tabs, the role groups, the new editor fields, the era template, «＋ Nuovo» per role and «✨ Genera» per role.
- **I10. The contradiction in the campaign design.** The design document says the campaign never touches the sheet, while the code and the handoff write it into the card. *Fix:* the oracle wins. `venture` is archive data, and game writes to it (and `status: 'deceduto'`) are in-place updates in the sense of P-03. A parity row records the contradiction, so nobody "fixes" it back to the design.

**Minor**

- **M1.** The handoff says the crew lives in the archive storage. It lives in `venture-crew`, which is browser storage and a per-viewer convenience in both forms.
- **M2.** The FR-015 fixtures grow to the 61 sheets of `design/characters/` (19 present, 42 future).
- **M3.** The artifact smoke test (FR-083) must also play a short Venture mission with the mock, because `mock.js` already answers every Venture marker.
- **M4.** The parity floor of 120 rows was sized for two environments. The Venture adds roughly as much behaviour (865 + 598 + 265 lines of engine, UI and bridge), so the floor becomes 200, with every row of handoff section 2.4 covered.

**What works.** The handoff's mapping to the monorepo (handoff, section 4) fits the architecture: the engine is pure and injected with `ask`, so it maps to core; the stage player maps to a Showrunner timeline; sounds go to a UI-level port; and the scripted-model tests map to differential goldens.

## 3. Step 3: second review and consolidation

Problems the fixes introduced, and how they are resolved:

- **I2 against WI-1's size.** «✨ Genera» adds a model-dependent feature to WI-1, so WI-1's real-model playtest must include it. *Resolution:* accepted. The archive belongs to WI-1, and leaving the generator out would make the web archive poorer than the legacy one for six work items. Each generated sheet costs one main call.
- **I6 against the burden of proof.** The `records` and `missions` tables have no routes until WI-3 and WI-7. *Resolution:* WI-1 creates every table by rule, so migrations stay additive and are written once. Their routes are planned contract additions, which need the owner's permission (AM-04).
- **I4 against WI-1.** Before WI-2 there are no games, so the server cannot map a `gameId` to an environment. *Resolution:* a call whose `gameId` is absent or unknown always uses the per-call scope and is never an error, from WI-1 on. This keeps a later WI from adding a new status for a request that succeeds today.
- **I3 against the contract rule.** The owner's rule counts any new enum value as a contract change. *Resolution:* the Venture kinds can enter the enum at no cost only because WI-1 has not been delivered yet. They do so now, before the freeze.
- **K4 against the autonomy window.** The Trinity decides every point in this piece except what changes the owner's requirements, the contract and public releases. *Resolution:* Q-17-1, Q-17-2 and the contract additions stay with the owner.

### 3.0 Rounds of the adversarial review (2026-11-17)

The first round ended `NOT CONVERGED`, `FINDINGS: 1/10/9`. Every finding was verified at its source before it was fixed. The fixes below are already part of 3.1 and 3.2:

- the ids of the future pack (`f_…`) are legacy ids (AM-16);
- the exact rules of `role`, `style`, `era` and `venture` (section 0, AM-07);
- the Venture's failure rules and the `budget` stop (AM-17);
- the Venture variant of the model fallback (AM-02);
- the corrections to Q-17-1;
- the contract additions and the 45 new sheets go to the owner (3.2);
- unknown game ids (I4 above);
- STYLE in the Venture goldens (AM-05);
- the stale texts of the spec (AM-18);
- the full review of the changed archive lines (section 0, AM-09);
- every minor finding.

Round 2 ended `NOT CONVERGED`, `FINDINGS: 0/3/4`, with `COVERAGE: partial`, because `ux-ponte.md` had been only partly read. It found:
- Epoca must stay visible in the editor for every character (AM-09);
- the editor's save rules (AM-07);
- an undefined `budget` stop (AM-17);
- missing ids (AM-16);
- four more stale texts (AM-18);
- the island ranking rule (AM-03);
- two superseded step-2 points.

Round 3 read `ux-ponte.md` in full and ended `NOT CONVERGED`, `FINDINGS: 0/1/4`, `COVERAGE: full`. It found four more unbuilt `ux-ponte.md` items (Q-17-1), the empty-id deviation (AM-16), the Venture seed constraint (AM-03), the Venture calls outside a turn (AM-17), and this log. All are fixed above and below.

An extra verification round on the round-3 fixes, decided by the coordinator after the cap (D-17-1), ended `CONVERGED`, `FINDINGS: 0/0/3`, `COVERAGE: full`. Its three minor findings, the retryable report after `budget` and two headings, are fixed.

### 3.1 Consolidated amendments to `spec.md`

The amendment is applied as a dated section at the top of `spec.md`, plus edits in place. The WI-1 spec was already approved, so every edit is listed here rather than made silently.

**Umbrella sections**

- **AM-01 Reference.** The header and section 1 bind the 2026-11-17 snapshot, with the integrity values of section 0:
  - the md5 and size of the published page;
  - the md5 of `venture.js`, `ventureui.js` and `talk.js`;
  - the md5 of `test.html`;
  - `tests/venture.test.js` ALL OK.

  The 14 November snapshot is kept as history. A-06 freezes the 2026-11-17 snapshot after WI-1. Any artifact change before then repeats the procedure: a dated snapshot plus a handoff note.
- **AM-02 Retries and model fallback** (P-01a, S-08). `BackoffPolicy` holds four named legacy schedules:
  - island: `engine.js:13-37`, shared step per game, 5 retries;
  - talk show: `talk.js:69-78`, per call, 5 retries;
  - Venture: `llm.js:33-47`, 2 in flight, 4 retries, per-call doubling, one cooldown end shared through `Math.max`;
  - archive generator: `archfuturo.js:108-115`, per call, 3 retries, no in-flight cap.

  The schedule follows the environment of the game; for a call without a known `gameId`, it follows the calling module (`probe` and `archive-generate` are per call).

  P-01a gains a **Venture variant**, which keeps the legacy behaviour:
  - the "light model refused" state lives in the client session, not in the game state, and resets on reload;
  - one refusal disables the light model for both tiers;
  - the fallback uses up a retry and goes back through the cooldown and the slot;
  - a refused light call goes to `main` with `lowLatency`, and a refused light mind goes to `main` (`llm.js:16, 25-27, 36-45`).

  The talk show and the archive generator have no fallback. Tests cover each variant.
- **AM-03 Data model** (section 2.5).
  - `games.environment` gains `venture`.
  - New table `records`: `id`, `environment`, `game_id` (nullable), `seed` (nullable), `score`, `data` jsonb, `created_at`. It keeps the legacy retention of each environment. The island keeps the top 30 by score, and a new run replaces the earlier record with the same seed even when it scores lower (`funui.js:236`); a partial unique constraint on (`environment`, `seed`) for island rows with a seed enforces one per seed. The Venture keeps the last 100, including several with the same seed, because the player can set the seed in setup (`ventureui.js:555`); the constraint does not apply to it.
  - New table `missions`: `id`, `title`, `source` (the `missione/1` text), `created_at`, `archived_at`.
  - The ready-made missions are content, not rows.
- **AM-04 Planned contract additions** (section 2.9). Pending the owner's permission, never decided by the Trinity:
  - **WI-3:** `GET` and `POST /api/records`, filtered by environment;
  - **WI-7:** `GET`, `POST` and `DELETE /api/missions`;
  - **WI-2:** the game routes are written with the three environments from the start;
  - **row "WI-2 to WI-5":** it now reads "WI-2 to WI-7".
- **AM-05 Work items** (section 3). WI-7 Venture is added, and the order becomes WI-1, WI-2, WI-3, WI-4, WI-7, WI-5, WI-6. Its "Ends playable as" cell reads "the Venture playable in both forms; report and novel arrive with WI-5".
  - **WI-7 delivers:**
    - the Venture core: arbiter, world, turn, the council as written in `venture.js`, command, agendas, trust, landing party, bets, medals, score, novel chapters, interview and director levers, with prompts as assets in `core/prompts/it/venture/`;
    - the 6 missions as `missione/1` content, and custom missions;
    - mission setup: crew picking («＋ A bordo», random draw, locks), `venture-crew` and `venture-prefs` as browser preferences;
    - the bridge: a three.js scene created once, the stage player on a Showrunner timeline with the constants of handoff 2.5, the screen cut, battle effects, synthesised sounds, voices, fast forward, and the island render loop paused while the Venture is active (`ui.js`);
    - Command played by the player or by a model;
    - end screen, ranking, campaign writes;
    - the home card with «Ultima missione» and «Classifica»;
    - differential goldens built from the scripted-model tests of `tests/venture.test.js`, run with STYLE evaluated first, as on the page (`venture.js:762`).
  - **WI-5** adds `ventureReport` and the Venture book. The book has no characters page in any environment.
  - **WI-2** owns the single style asset (K1).
  - **WI-3 and WI-4** offer only present characters in their pickers (`archui.js:165-166`, `talk.js:274, 617`).
  - **Ports:** P-06 adds an optional UI-level `Sound` capability (synthesised, no files), and FR-102 lists it.

**WI-1 sections**

- **AM-06 Call kinds** (FR-011). `LLM_CALL_KINDS` adds the 15 Venture kinds and `archive-generate`. Kinds shared with the island (`intervista`, `racconto`, `romanzo`) are the same string, and the environment comes from the game. The guard test covers:
  - the 17 literal sites of `venture.js`, with their tiers;
  - the 8 talk-show sites at their new lines (the definition is now at `talk.js:69`);
  - the generator's call site.

  FR-097 and SC-004a refer to the kinds of the ENGINE script only.
- **AM-07 Character model** (FR-013, FR-014, FR-016). The new keys keep their legacy names: `era`, `role`, `style`, `venture`. Their rules are those of section 0:
  - `era`: any value other than `'futuro'` means present;
  - `role`: the parser stores `archRoleKey(v) || v.slice(0, 40)`;
  - `style`: capped at 80 by the parser;
  - present characters: the editor deletes `role` and `style` when it saves them;
  - the generator: forces the role key and caps the name at 40.

  The record itself puts no cap and no enum on these keys. The campaign writes (`venture`, `status`, `deaths`) are in-place updates.

  FR-016's editor normalisations gain the save rules of `archui.js:297`:
  - `era` is always written from the select, so an edited present character gains `era: 'presente'`;
  - for a future character, `role` is one of the 8 keys, or `''`, from the select;
  - `style` is trimmed and loses `<` and `>`;
  - for a present character, `role` and `style` are deleted.
- **AM-08 Content and seeds** (FR-015, FR-024).
  - The 42 future sheets become content, with their legacy ids, `updated` and origin.
  - Both packs are seeded once, under separate markers.
  - «Personaggi pronti» adds both packs with the legacy skip rule.
  - The FR-015 fixtures are the 16 present pack characters, the 42 future sheets and the 3 further present sheets of `design/characters/presente/` (fixtures only, not content).
  - User Story 1, scenario 1 now reads "58 characters (16 present, 42 future), with their relations resolved".
- **AM-09 Archive UI** (FR-072).
  - Tabs «🏝 Presente» and «🚀 Futuro».
  - In the Future tab, the 8 role groups in legacy order, each with «＋ Nuovo» and «✨ Genera»; «＋ Nuovo personaggio» opens a captain.
  - The editor field Epoca, shown for every character, so a character can move between eras; Ruolo preferito and Stile, shown only when Epoca is futuro (`archui.js:268-270, 285`).
  - Search by style; the style on the card.
  - The Future empty state; the template download per era; home counts per era.

  Crew picking belongs to WI-7.
- **AM-10 Home** (FR-071, User Story 4). Three environment entries: island WI-3, talk show WI-4, Venture WI-7.
- **AM-11 Build and vendoring** (FR-080 to FR-084).
  - **Vendored files:** the list adds `style.js`, `archfuturo.js`, `archpack-futuro.js`, `llm.js`, `venture.js`, `venture-missions.js`, `ventureui.js`, `ventbridge.js`, `tests/venture.test.js` and `tests/fixtures/mission.md`.
  - **Not vendored:** the tools and `LEGGIMI.md`.
  - **Builder:** reproduces `build.py` exactly, including its substitution order (SIM, SCENE, ENGINE and UI, then STYLE, then ENV), which yields the page order with STYLE before ENGINE.
  - **SC-003:** takes the new md5 values.
  - **Size budget:** 1,700,000 bytes.
  - **Smoke test:** adds a short Venture mission.
- **AM-12 Golden harness** (FR-090). It evaluates ISLAND_RANDOM, SIM, STYLE and ENGINE, in page order.
- **AM-13 Parity** (FR-100, SC-005).
  - At least 200 rows, and SC-005 is updated to match.
  - Every item of handoff 2.2 to 2.6 has a row, including the `ui.js` render skip, `venture-prefs` and the home card.
  - The design-versus-code contradiction of the campaign is recorded.
- **AM-14 Citations.** Every `file:line` in `spec.md` is re-based on the 2026-11-17 snapshot. The changed lines (`archui.js:70, 89, 165, 207, 208, 288`, `talk.js:673`) are re-read and re-cited. Every changed hunk of `archui.js` and `talk.js` has been reviewed against the WI-1 requirements (section 0).
- **AM-15 Alignment.** Until WI-7 the web form has no Venture, which the existing "Everything" row of `docs/alignment.md` already covers.
- **AM-16 Legacy ids** (FR-017). A non-empty string id that is not a uuid is a legacy id, `c_…` and `f_…` included. It becomes the uuid v5 of that id, and `legacyId` is kept. A missing id gets a fresh uuid, as `Object.assign(archBlank(), c)` keeps a fresh id in the legacy (`archui.js:249`). An empty or `null` id also gets a fresh uuid. This is a v1 deviation, recorded as a parity row, because `Object.assign` copies `''` and `null` over the fresh id and the legacy stores them as they are. The same mapping applies to archive files, the packs and the seed. Tests cover `f_` ids in import, pack, soft-delete restore and the round trip, and missing ids.
- **AM-17 Failures and `budget`** (S-06). For the Venture the legacy rules hold:
  - every failed call becomes a logged fallback (`venture.js:605`);
  - a turn that throws is rolled back to its snapshot, and the game pauses (`ventureui.js:217`);
  - the call cap ends the game as `tetto`, keeping the report reserve (`ventureui.js:218`).

  The server's daily `budget` stop has no legacy equivalent: it is a v1 safety net in the web form only, defined as follows. A parity row records it, and tests cover each environment.
  - **Venture.** `budget` is rethrown past the per-call fallback, a documented deviation from `venture.js:605`. The running turn is rolled back to its snapshot, as `ventureui.js:217` does, and the game pauses with the budget message.
  - **Island.** The safe point is the end of the current tick. The calls that failed with `budget` are not turned into rest beats, and the game stops, as `G.running = false` does for the legacy fatal errors (`engine.js:527-529`), with the budget message.
  - **Talk show.** The safe point is the end of the current beat. The show pauses with the budget message, and no fallback line is written. The legacy already rethrows here (`talk.js:200`) and stops the show (`talk.js:255`).
  - **Venture calls outside a turn** (the bible and the agendas at mission start, the interview, the report, the novel). Each keeps its legacy catch and shows the budget message instead of its usual error. A bible that fails stops the mission start, as any failure of it does in the legacy (`venture.js:709-714`, `ventureui.js:162-164`). One exception: on `budget` the final report leaves `G.report` unset rather than empty, so «📜 Scrivi il report» can retry once the cap allows it. Otherwise an empty report would stay for good (`venture.js:716-719`, `ventureui.js:507`).
- **AM-18 Stale texts.** These are applied together:
  - SC-005: 200 rows;
  - User Story 1, scenario 1, and its description: 58 characters (16 present, 42 future);
  - User Story 5, scenario 3: the smoke test also plays a short Venture mission;
  - section 4.4: the entities Record and Mission;
  - section 4.7: the Venture is absent from the web form until WI-7;
  - User Story 4: three entries;
  - FR-011: the talk-show definition is at `talk.js:69`;
  - section 2.9: "WI-2 to WI-7";
  - the WI-7 row of the work-item table, as in AM-05.

### 3.2 Open, reserved to the owner

- **Q-17-1. Designed in `note-allineamento.md` and `ux-ponte.md` but not built in the artifact.** Should v1 also build these items?
  - the mutiny procedure and the forced medical veto;
  - pause at the end of a call;
  - five tabs on phones;
  - bridge comforts;
  - the split landing scene;
  - campaign damage and reputation between missions;
  - the time gate between eras;
  - one queue shared by the island and the talk show;
  - a council engine extracted and shared by the talk show and the Venture;
  - a separate campaign store;
  - from `design/venture/ux-ponte.md`:
    - the director lever «✉ Messaggio dalla famiglia» (5.3);
    - the repeated-network-error state with «Riprova adesso» and «Metti in pausa» (5.4);
    - the full shortcut set F, R, D, M with the «⌨ Tasti» list and the «?» help (7); only P and N exist (`ventureui.js:186-187`);
    - the reload line «↺ Ripreso dal turno N…» (6.4).

  Q-17-1 covers every designed-but-unbuilt item of `note-allineamento.md` and `ux-ponte.md`. The designer's open questions (`ux-ponte.md`, section 10) need no entry, because the diary of 17 November settles them with prudent values that the artifact implements.

  The Trinity's proposal: v1 is the 17 November artifact, proved against it, and these items become a later work item. Two reasons:
  - nothing can prove them identical to the reference;
  - three of them contradict it: the artifact keeps per-environment queues, a council inside `venture.js` and the campaign in the archive card.
- **Q-17-2. Publication of 45 new character sheets.** These are the 42 future sheets (content and fixtures) and 3 present sheets that exist only as files, never in the pack. D-14-3 covered only the 16 present pack characters. The Trinity's proposal: publish as they are, the 3 only as fixtures. Until the owner decides, nothing carrying them is pushed.
- **The contract additions of AM-04.**

## 4. FAQ

**Why amend a WI-1 spec that was already approved, instead of starting WI-1 and adding the Venture later?**
WI-1 builds the legacy page byte for byte, creates every table and freezes the API when it merges. The reference page has changed, the record has four new keys and the call kinds have grown. Starting from the 14 November spec would build a page that is no longer the published one and freeze an enum without the Venture kinds. Amending now costs one review and saves a contract change.

**Why does the Venture come after the talk show and before the reports?**
The Venture reuses the talk show's Showrunner pattern and bridge figures, and its reports and book are built by WI-5, which covers every environment at once. Building it before WI-4 would design the stage timeline twice. After WI-5, the report work would have to be reopened. The handoff proposes the same order.

**Why add the Venture call kinds now, and not as planned contract additions as the handoff suggests?**
The owner's rule counts a new enum value as a contract change once the contract is delivered. WI-1 is not delivered yet, and every kind the owner decided on is already known. Adding them before the freeze costs nothing and avoids asking for a change in WI-7.

**Why does the style asset arrive in WI-2 and not in WI-5?**
The island prompts that use the style are ported in WI-2 and must match the legacy byte for byte, so without the asset they would differ. WI-5 still owns the book layout and the reports.

**Why keep the legacy key `role` instead of `preferredRole`?**
The archive file format is shared with the legacy artifact, and a web export must import into it and come back without loss. The TypeScript type documents the meaning without renaming the key.

**How do the goldens stay deterministic with the new STYLE script?**
STYLE is a constant string with no randomness, no time and no I/O, so evaluating it changes nothing for determinism. Without it the island engine throws on its first story prompt, and the Venture novel prompts would lose the style that the page gives them. That is why both harnesses evaluate it first.

**What happens when a model call fails in the Venture?**
The same as in the artifact. The failed call becomes the documented fallback for that step, and the turn goes on. A turn that throws is rolled back to its snapshot and the game pauses. Reaching the mission's call cap ends the game as `tetto`, keeping the report's reserve. The web server's daily budget is the only addition: it pauses the game at the next safe point.

**What does the Venture add to the cost of a game, and who controls it?**
The legacy estimate for a normal mission of 40 turns with 5 officers is 94 light and 128 main calls, in 14 to 32 minutes; the test run prints it. The server's rate and spend caps and its per-game concurrency apply as for the other environments. The Venture's legacy cap of 2 calls in flight is kept as a game rule, as the island's is.

**Can the mission bible leak into the crew's prompts?**
The legacy engine builds each prompt through projection functions with an explicit list of fields. Its tests check that bible secrets, other factions' secrets and other officers' agendas never appear in the wrong prompt. WI-7 ports those projections and those tests unchanged.

**What leaves the player's machine with the Venture, and what is kept?**
With Anthropic every prompt leaves the machine, and that includes the crew sheets, the mission and the bible sent to the World. With LM Studio nothing does. The server stores only prompt hashes. The campaign memory is archive data, so it lives in the player's database or browser and is part of the export.

**What happens to a campaign memory when the archive moves between the two forms?**
`venture` is a record key the legacy already reads and writes, so it survives the round trip in both directions. The ids of the future pack are legacy ids and map to the same uuid every time, so a re-import never duplicates an officer.

**What was considered and rejected?**
A separate Venture project was rejected because it would duplicate the archive, the reports and the bridge figures. Renaming the record keys was rejected because it breaks the archive round trip, and trimming the page to keep the 1.2 MB budget because the page must stay byte-identical. Adding the kinds later as contract changes was rejected because they are known now and cost nothing before the freeze.

**What are the operational risks?**
The main ones are the size of WI-7 and the real-model cost of the Venture playtests, which the daily budget rule controls. The legacy page is still checked byte for byte against `build.py`, so a wrong file order fails at once. Q-17-1 and Q-17-2 must be answered before the WI-7 spec and before the first push of the vendored sources, respectively.
