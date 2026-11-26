/* ===== One queue for every call to Claude =====
   At most MAX_INFLIGHT calls at once, growing pauses when the platform says rate_limited, counters per kind and tier,
   an optional cap per session. Used by the Venture and by the archive generator; the island and the talk show still
   have their own queues (recorded as a gap in the alignment notes, to be migrated). */
const LLM = (() => {
  /** Two calls at once: enough to overlap the council and the externals, low enough not to trigger rate limits. */
  const MAX_INFLIGHT = 2;
  /** First pause after a rate_limited answer, doubled at every new one, in milliseconds. */
  const COOL_BASE_MS = 15000;
  const MAX_RETRY = 4;
  const MODELS = {
    fable: { model: 'claude-fable-5-1', modelTier: 'default', effort: 'low', cache: false },
    opus: { model: 'claude-opus-5-5', modelTier: 'default', effort: 'low', cache: false },
    sonnet: { model: 'claude-sonnet-5-5', modelTier: 'default', effort: 'low', cache: false },
    sonnetQuick: { model: 'claude-sonnet-5-5', modelTier: 'quick', cache: false },
    haiku: { model: 'claude-haiku-5-5', modelTier: 'quick', cache: false },
  };
  /** Minds the player can choose, strongest first; a mind the platform refuses falls back to the next one down. */
  const MINDS = ['fable', 'opus', 'sonnet', 'haiku'];
  const st = { inflight: 0, waiters: [], coolUntil: 0, sample: null, haikuOk: true, off: {}, light: '', mind: 'sonnet', stats: { light: 0, main: 0, byKind: {}, failed: 0, rateWaits: 0 }, cap: 0, onChange: null };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function slot() { while (st.inflight >= MAX_INFLIGHT) await new Promise((r) => st.waiters.push(r)); st.inflight++; }
  function free() { st.inflight = Math.max(0, st.inflight - 1); const w = st.waiters.shift(); if (w) w(); }
  async function sampler() {
    if (!st.sample) { try { st.sample = window.claude && window.claude.use ? await window.claude.use('sample') : null; } catch (e) { st.sample = null; } }
    if (!st.sample) throw new Error('Claude non disponibile: apri la pagina da claude.ai.');
    return st.sample;
  }
  /** First available mind from m downwards (haiku falls back to a quick Sonnet). */
  function avail(m) { for (let i = Math.max(0, MINDS.indexOf(m)); i < MINDS.length; i++) { const k = MINDS[i]; if (k === 'haiku') return st.haikuOk ? MODELS.haiku : MODELS.sonnetQuick; if (!st.off[k]) return MODELS[k]; } return MODELS.sonnet; }
  function optsFor(tier) {
    if (tier === 'light') return st.light ? avail(st.light) : st.haikuOk ? MODELS.haiku : MODELS.sonnetQuick;
    return avail(st.mind);
  }
  /**
   * Sends one prompt and returns the parsed JSON object. tier: 'main' (character lines, decisions) or 'light'
   * (listening, narration). Throws after the retries; callers apply their own fallback.
   */
  async function ask(kind, prompt, tier = 'main') {
    const s = await sampler(); const t = tier === 'light' ? 'light' : 'main';
    st.stats[t]++; st.stats.byKind[kind] = (st.stats.byKind[kind] || 0) + 1; if (st.onChange) st.onChange();
    for (let attempt = 0; ; attempt++) {
      while (Date.now() < st.coolUntil) await sleep(Math.min(1000, st.coolUntil - Date.now()));
      await slot();
      try { return await s.json(prompt, optsFor(t)); }
      catch (e) {
        const code = String((e && (e.code || e.message)) || '');
        const used = optsFor(t); const refused = /model|not.?allowed|invalid|unsupported|unavailable|permission/i.test(code);
        if (refused && used === MODELS.haiku && st.haikuOk) { st.haikuOk = false; continue; }
        if (refused && (used === MODELS.fable || used === MODELS.opus)) { st.off[used === MODELS.fable ? 'fable' : 'opus'] = true; if (st.onChange) st.onChange(); continue; }
        if (e && e.code === 'rate_limited' && attempt < MAX_RETRY) { st.stats.rateWaits++; st.coolUntil = Math.max(st.coolUntil, Date.now() + COOL_BASE_MS * 2 ** attempt); if (st.onChange) st.onChange(); continue; }
        st.stats.failed++; throw e;
      } finally { free(); }
    }
  }
  return {
    ask,
    /** Mind for main calls (author, writing, decisions): fable, opus, sonnet or haiku. */
    setMind(m) { st.mind = MINDS.includes(m) ? m : 'sonnet'; },
    /** Mind for light calls (characters, editor, reader); '' keeps the default (Haiku). */
    setLight(m) { st.light = MINDS.includes(m) ? m : ''; },
    /** Minds the platform refused in this session (they fall back to the next one). */
    refused: () => Object.keys(st.off).concat(st.haikuOk ? [] : ['haiku']),
    MINDS,
    reset() { st.stats = { light: 0, main: 0, byKind: {}, failed: 0, rateWaits: 0 }; },
    restore(x) { if (x && typeof x === 'object') st.stats = Object.assign({ light: 0, main: 0, byKind: {}, failed: 0, rateWaits: 0 }, JSON.parse(JSON.stringify(x))); },
    inflight: () => st.inflight,
    stats: () => st.stats,
    coolUntil: () => st.coolUntil,
    set onChange(f) { st.onChange = f; },
  };
})();
