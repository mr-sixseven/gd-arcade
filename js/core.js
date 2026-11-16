/* ==========================================================================
   GD ARCADE — shared core
   Central data layer, deterministic daily seeds, storage, stats, shell UI.
   Everything here is used by all six games. Game rules stay in games/*.js.
   ========================================================================== */
(() => {
  "use strict";

  const DAY_MS = 86400000;
  const EPOCH = Date.UTC(2026, 0, 1);
  const ROOT_PREFIX = "gdarcade.v1.";

  const DIFF_RANK = {
    Easy: 1, Normal: 2, Hard: 3, Harder: 4, Insane: 5,
    "Easy Demon": 6, "Medium Demon": 7, "Hard Demon": 8,
    "Insane Demon": 9, "Extreme Demon": 10
  };
  const LENGTHS = ["Tiny", "Short", "Medium", "Long", "XL"];
  const POP_STEPS = [1e6, 5e6, 2e7, 5e7, 1e8, 2e8];

  const SETTINGS_KEY = "settings";
  const DEFAULT_SETTINGS = { sound: true, reduceMotion: false, volume: 0.55 };
  const GAME_META = {
    gdle: { name: "GD-le", color: "#3ce0ff", icon: "grid", path: "games/gdle.html" },
    connections: { name: "Connections", color: "#35dd82", icon: "nodes", path: "games/connections.html" },
    thumbnaille: { name: "Thumbnaille", color: "#a77bff", icon: "image", path: "games/thumbnaille.html" },
    "higher-lower": { name: "Higher / Lower", color: "#ff9f43", icon: "arrows", path: "games/higher-lower.html" },
    "demon-order": { name: "Demon Order", color: "#ff5d7a", icon: "sort", path: "games/demon-order.html" },
    songle: { name: "Songle", color: "#ff7ce5", icon: "music", path: "games/songle.html" }
  };

  /* ------------------------------------------------------------------ *
   * Safe storage
   * ------------------------------------------------------------------ */
  const store = {
    get(key, fallback = null) {
      try {
        const raw = localStorage.getItem(ROOT_PREFIX + key);
        if (raw == null) return fallback;
        try { return JSON.parse(raw); } catch { return raw; }
      } catch { return fallback; }
    },
    set(key, value) {
      try {
        localStorage.setItem(ROOT_PREFIX + key, typeof value === "string" ? value : JSON.stringify(value));
        return true;
      } catch { return false; }
    },
    remove(key) {
      try { localStorage.removeItem(ROOT_PREFIX + key); } catch {}
    },
    keys() {
      try { return Object.keys(localStorage).filter((k) => k.startsWith(ROOT_PREFIX)); } catch { return []; }
    },
    clear() {
      for (const key of store.keys()) {
        try { localStorage.removeItem(key); } catch {}
      }
    }
  };

  /* ------------------------------------------------------------------ *
   * Text / number helpers
   * ------------------------------------------------------------------ */
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = (s) => String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const pad = (n) => String(n).padStart(2, "0");

  function fmtNum(n) {
    const v = Number(n) || 0;
    if (v >= 1e9) return (v / 1e9).toFixed(v >= 1e10 ? 0 : 1).replace(/\.0$/, "") + "B";
    if (v >= 1e6) return (v / 1e6).toFixed(v >= 1e7 ? 0 : 1).replace(/\.0$/, "") + "M";
    if (v >= 1e3) return (v / 1e3).toFixed(v >= 1e4 ? 0 : 1).replace(/\.0$/, "") + "K";
    return String(Math.round(v));
  }

  function fmtFull(n) {
    return (Number(n) || 0).toLocaleString("en-US");
  }

  function fmtDuration(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  }

  function fmtDate(iso) {
    try {
      return new Date(iso + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    } catch { return iso; }
  }

  function initials(name) {
    const parts = String(name || "?").replace(/[^\p{L}\p{N} ]/gu, " ").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
  }

  /* ------------------------------------------------------------------ *
   * Deterministic dates & RNG
   * ------------------------------------------------------------------ */
  function dateKey(d = new Date()) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function dayNumber(d = new Date()) {
    const localMidnight = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.max(1, Math.floor((localMidnight - EPOCH) / DAY_MS) + 1);
  }
  function yesterdayKey(iso = dateKey()) {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() - 1);
    return dateKey(dt);
  }
  function msToMidnight(now = new Date()) {
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
    return next - now;
  }

  function hashString(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function rngFor(game, extra = "") {
    return mulberry32(hashString(`${game}|${dateKey()}|${extra}`));
  }
  function shuffle(list, rnd = Math.random) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function pick(list, rnd = Math.random) {
    return list.length ? list[Math.floor(rnd() * list.length)] : null;
  }
  function pickN(list, n, rnd = Math.random) {
    return shuffle(list, rnd).slice(0, n);
  }

  /* ------------------------------------------------------------------ *
   * Central level database
   * ------------------------------------------------------------------ */
  function prepare(raw) {
    if (!raw || !raw.id || !raw.name || !String(raw.name).trim()) return null;
    if (!DIFF_RANK[raw.difficulty] || !LENGTHS.includes(raw.length)) return null;
    const id = String(raw.id);
    const songId = raw.songId ? String(raw.songId) : null;
    return {
      ...raw,
      id,
      _name: norm(raw.name),
      _creator: norm(raw.creator),
      _song: norm(raw.song),
      _artist: norm(raw.songAuthor),
      _diff: DIFF_RANK[raw.difficulty],
      _len: LENGTHS.indexOf(raw.length),
      _ver: raw.version === "Pre-1.7" ? 0 : Math.round(parseFloat(raw.version) * 10),
      _pop: POP_STEPS.filter((t) => raw.downloads >= t).length,
      songId,
      thumb: thumbUrl(id)
    };
  }

  const rawLevels = Array.isArray(window.GD_LEVELS) ? window.GD_LEVELS : [];
  const seenIds = new Set();
  const seenNames = new Map();
  const levels = [];
  for (const raw of rawLevels) {
    const item = prepare(raw);
    if (!item || seenIds.has(item.id)) continue;
    seenIds.add(item.id);
    const prev = seenNames.get(item._name);
    if (prev) {
      // Keep the more downloaded version of an ambiguous duplicate name.
      if ((item.downloads || 0) > (prev.downloads || 0)) {
        const i = levels.indexOf(prev);
        if (i >= 0) levels[i] = item;
        seenNames.set(item._name, item);
      }
      continue;
    }
    seenNames.set(item._name, item);
    levels.push(item);
  }

  const byId = new Map(levels.map((l) => [l.id, l]));
  const byName = new Map(levels.map((l) => [l._name, l]));
  const dailyPool = levels.filter((l) => l.downloads >= 1e6 && !l.platformer);
  const rankedDemons = levels
    .filter((l) => l.demonPosition && l.difficulty.includes("Demon"))
    .sort((a, b) => a.demonPosition - b.demonPosition);

  const songs = (Array.isArray(window.GD_SONGS) ? window.GD_SONGS : [])
    .filter((s) => s && s.id && s.name && s.audioUrl)
    .filter((s, i, arr) => arr.findIndex((x) => x.id === s.id) === i)
    .map((s) => ({ ...s, _name: norm(s.name), _artist: norm(s.artist) }));

  const songByLevel = new Map();
  for (const level of levels) {
    const match = level.songId ? songs.find((s) => String(s.id) === String(level.songId)) : null;
    if (match) songByLevel.set(level.id, match);
  }

  const demonlist = (Array.isArray(window.GD_DEMONLIST) ? window.GD_DEMONLIST : []).slice();
  const connectionsGroups = (Array.isArray(window.GD_CONNECTIONS_GROUPS) ? window.GD_CONNECTIONS_GROUPS : [])
    .map((g) => ({ ...g, levels: g.levels.map((n) => byName.get(norm(n))).filter(Boolean) }))
    .filter((g) => g.levels.length === 4);

  function thumbUrl(id) {
    return `https://levelthumbs.prevter.me/thumbnail/${encodeURIComponent(id)}/medium`;
  }

  function findLevel(query) {
    if (!query) return null;
    const q = norm(query);
    return byName.get(q) || levels.find((l) => l._name.includes(q)) || null;
  }

  /* ------------------------------------------------------------------ *
   * Settings
   * ------------------------------------------------------------------ */
  function getSettings() {
    return { ...DEFAULT_SETTINGS, ...(store.get(SETTINGS_KEY, {}) || {}) };
  }
  function saveSettings(patch) {
    const next = { ...getSettings(), ...patch };
    store.set(SETTINGS_KEY, next);
    applySettings(next);
    return next;
  }
  function applySettings(s = getSettings()) {
    document.documentElement.classList.toggle("reduce-motion", !!s.reduceMotion);
    document.documentElement.classList.toggle("sound-off", !s.sound);
    document.documentElement.style.setProperty("--master-volume", String(s.volume ?? DEFAULT_SETTINGS.volume));
  }

  /* ------------------------------------------------------------------ *
   * Tiny synthesised UI sounds (no audio files, no copyright issues)
   * ------------------------------------------------------------------ */
  let audioCtx = null;
  function sfx(kind = "click") {
    const s = getSettings();
    if (!s.sound) return;
    try {
      audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const seq = {
        click: [[420, 0.045]],
        correct: [[523, 0.06], [784, 0.09]],
        wrong: [[190, 0.09], [140, 0.11]],
        win: [[523, 0.08], [659, 0.08], [784, 0.1], [1047, 0.16]],
        lose: [[330, 0.1], [262, 0.12], [196, 0.18]],
        tick: [[760, 0.025]]
      }[kind] || [[420, 0.04]];
      let t = audioCtx.currentTime;
      for (const [freq, dur] of seq) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = kind === "wrong" || kind === "lose" ? "sawtooth" : "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.09 * s.volume, t + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + dur + 0.01);
        t += dur * 0.8;
      }
    } catch {}
  }

  /* ------------------------------------------------------------------ *
   * Stats — one isolated namespace per game
   * ------------------------------------------------------------------ */
  function statsKey(game) { return `stats.${game}`; }
  function dailyKey(game, date = dateKey()) { return `daily.${game}.${date}`; }
  function progressKey(game, date = dateKey()) { return `progress.${game}.${date}`; }

  function getStats(game, defaults = {}) {
    const stored = store.get(statsKey(game), {}) || {};
    return {
      played: 0, wins: 0, streak: 0, maxStreak: 0, lastDaily: null,
      practice: 0, practiceWins: 0, ...defaults, ...stored
    };
  }
  function saveStats(game, stats) { store.set(statsKey(game), stats); }
  function getDaily(game) { return store.get(dailyKey(game), null); }
  function isDailyDone(game) { return !!getDaily(game); }
  function getProgress(game) { return store.get(progressKey(game), null); }
  function saveProgress(game, progress) { store.set(progressKey(game), progress); }
  function clearProgress(game) { store.remove(progressKey(game)); }

  function updateStreak(stats, won) {
    const today = dateKey();
    if (won) {
      stats.streak = stats.lastDaily === yesterdayKey(today) ? (stats.streak || 0) + 1 : 1;
      stats.maxStreak = Math.max(stats.maxStreak || 0, stats.streak);
    } else {
      stats.streak = 0;
    }
    stats.lastDaily = today;
  }

  function markDaily(game, payload, customize) {
    if (isDailyDone(game)) return { added: false, daily: getDaily(game) };
    const stats = getStats(game);
    stats.played = (stats.played || 0) + 1;
    if (payload.won) stats.wins = (stats.wins || 0) + 1;
    updateStreak(stats, !!payload.won);
    if (typeof customize === "function") customize(stats, payload);
    saveStats(game, stats);
    const daily = { date: dateKey(), ...payload };
    store.set(dailyKey(game), daily);
    refreshDailyChip();
    return { added: true, daily, stats };
  }

  function markPractice(game, payload, customize) {
    const stats = getStats(game);
    stats.practice = (stats.practice || 0) + 1;
    if (payload.won) stats.practiceWins = (stats.practiceWins || 0) + 1;
    if (typeof customize === "function") customize(stats, payload);
    saveStats(game, stats);
    return stats;
  }

  function resetGame(game) {
    store.remove(statsKey(game));
    for (const key of store.keys()) {
      if (key.includes(`daily.${game}.`) || key.includes(`progress.${game}.`)) {
        try { localStorage.removeItem(key); } catch {}
      }
    }
  }

  function resetAll() { store.clear(); }

  function dailySummary() {
    const done = Object.keys(GAME_META).filter(isDailyDone);
    return { done, count: done.length, total: Object.keys(GAME_META).length };
  }

  function refreshDailyChip() {
    const counter = document.querySelector(".daily-chip b");
    if (!counter) return;
    const summary = dailySummary();
    counter.textContent = `${summary.count}/${summary.total}`;
    const chip = counter.closest(".daily-chip");
    if (chip) chip.title = `${summary.count} of ${summary.total} daily challenges complete today`;
  }

  /* ------------------------------------------------------------------ *
   * Shared HTML fragments
   * ------------------------------------------------------------------ */
  function thumbHTML(level, opts = {}) {
    if (!level) return `<span class="thumb-wrap ${opts.wrapClass || ""}"><span class="thumb-fallback">?</span></span>`;
    const cls = opts.className || "";
    return `<span class="thumb-wrap ${opts.wrapClass || ""}">
      <img class="thumb-img ${cls}" src="${thumbUrl(level.id)}" alt="${esc(opts.alt || level.name + " thumbnail")}" loading="${opts.eager ? "eager" : "lazy"}" decoding="async" data-thumb>
      <span class="thumb-fallback" aria-hidden="true"><span>${esc(initials(level.name))}</span><small>Thumbnail unavailable</small></span>
    </span>`;
  }

  function bindThumbs(root = document) {
    root.querySelectorAll("img[data-thumb]").forEach((img) => {
      if (img.dataset.bound) return;
      img.dataset.bound = "1";
      img.addEventListener("error", () => {
        img.classList.add("thumb-broken");
        img.closest(".thumb-wrap")?.classList.add("is-broken");
      });
      if (img.complete && img.naturalWidth === 0) {
        img.classList.add("thumb-broken");
        img.closest(".thumb-wrap")?.classList.add("is-broken");
      }
    });
  }

  function icon(name, cls = "") {
    const paths = {
      grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
      nodes: '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.5 6h7M6 8.5v7M18 8.5v7M8.5 18h7"/>',
      image: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.5"/><path d="m21 15-5-5L5 20"/>',
      arrows: '<path d="M8 4v16M4 8l4-4 4 4"/><path d="M16 20V4M12 16l4 4 4-4"/>',
      sort: '<path d="M8 4v16M4 8l4-4 4 4"/><path d="M16 20V4M12 16l4 4 4-4"/><path d="M20 10h-8M20 14h-8"/>',
      music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
      trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v2a4 4 0 0 0 4 4M17 6h3v2a4 4 0 0 1-4 4"/>',
      fire: '<path d="M12 22c4 0 7-2.7 7-6.5 0-2.5-1.5-4.4-3-6.5-.7 1.8-1.7 2.8-2.5 3.2.4-3-1-6.4-3.5-8.2.2 3.4-1.7 5-3 7.2C5.9 12.4 5 14 5 15.5 5 19.3 8 22 12 22z"/>',
      check: '<path d="m5 12 4 4L19 6"/>',
      clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H2v-4h.2a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L3.4 7 6.2 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V2h4v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1z"/>',
      help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.4 2.3c-.6.25-.9.8-.9 1.45V13M12 17h.01"/>',
      chart: '<path d="M5 20V10M12 20V4M19 20v-7"/>',
      share: '<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/>',
      play: '<path d="m8 5 11 7-11 7z"/>',
      pause: '<rect x="7" y="5" width="3.5" height="14" rx="1"/><rect x="13.5" y="5" width="3.5" height="14" rx="1"/>',
      refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
      menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
      x: '<path d="M6 6l12 12M18 6 6 18"/>',
      chevron: '<path d="m9 18 6-6-6-6"/>',
      volume: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12"/>',
      home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/>'
    };
    return `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.grid}</svg>`;
  }

  function gameIcon(game, cls = "") {
    return icon(GAME_META[game]?.icon || "grid", cls);
  }

  /* ------------------------------------------------------------------ *
   * Toast, confirm, dialogs, confetti
   * ------------------------------------------------------------------ */
  function ensureToast() {
    let el = document.getElementById("arcadeToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "arcadeToast";
      el.className = "toast";
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      document.body.appendChild(el);
    }
    return el;
  }
  let toastTimer = null;
  function toast(message, kind = "") {
    const el = ensureToast();
    el.textContent = message;
    el.className = `toast show ${kind}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = "toast"; }, 2800);
  }

  function confirmDialog({ title = "Are you sure?", message = "", confirmText = "Confirm", cancelText = "Cancel", danger = false } = {}) {
    return new Promise((resolve) => {
      let dlg = document.getElementById("confirmDialog");
      if (!dlg) {
        dlg = document.createElement("dialog");
        dlg.id = "confirmDialog";
        dlg.className = "modal";
        dlg.setAttribute("aria-labelledby", "confirmDialogTitle");
        document.body.appendChild(dlg);
      }
      dlg.innerHTML = `<div class="dialog-inner confirm-inner">
        <h2 id="confirmDialogTitle">${esc(title)}</h2>
        <p>${esc(message)}</p>
        <div class="dialog-actions">
          <button class="btn" data-cancel>${esc(cancelText)}</button>
          <button class="btn ${danger ? "danger" : "primary"}" data-confirm>${esc(confirmText)}</button>
        </div>
      </div>`;
      const close = (val) => { dlg.close(); resolve(val); };
      dlg.querySelector("[data-cancel]").addEventListener("click", () => close(false));
      dlg.querySelector("[data-confirm]").addEventListener("click", () => close(true));
      dlg.addEventListener("cancel", (e) => { e.preventDefault(); close(false); }, { once: true });
      dlg.addEventListener("click", (e) => { if (e.target === dlg) close(false); }, { once: true });
      dlg.showModal();
    });
  }

  function confetti(count = 36) {
    if (getSettings().reduceMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const colors = ["#3ce0ff", "#35dd82", "#a77bff", "#ff9f43", "#ff5d7a", "#f6c945"];
    for (let i = 0; i < count; i++) {
      const p = document.createElement("i");
      p.className = "confetti-piece";
      p.style.left = Math.random() * 100 + "vw";
      p.style.background = colors[i % colors.length];
      p.style.animationDuration = 1.5 + Math.random() * 1.4 + "s";
      p.style.animationDelay = Math.random() * 0.25 + "s";
      p.style.transform = `rotate(${Math.random() * 360}deg)`;
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 3400);
    }
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast("Copied to clipboard", "success");
      return true;
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        ta.remove();
        toast(ok ? "Copied to clipboard" : "Could not copy", ok ? "success" : "error");
        return ok;
      } catch {
        toast("Could not copy", "error");
        return false;
      }
    }
  }

  function shareText(text) { return copyText(text); }

  /* ------------------------------------------------------------------ *
   * Global dialogs (settings + overview)
   * ------------------------------------------------------------------ */
  function mountGlobalDialogs() {
    if (!document.getElementById("settingsDialog")) {
      const dlg = document.createElement("dialog");
      dlg.id = "settingsDialog";
      dlg.className = "modal";
      dlg.setAttribute("aria-label", "Settings");
      dlg.innerHTML = `<div class="dialog-inner">
        <div class="dialog-head">
          <div><h2>Settings</h2><p>Preferences are saved on this device.</p></div>
          <button class="x-btn" data-close aria-label="Close">${icon("x")}</button>
        </div>
        <div class="settings-list">
          <label class="setting-row">
            <span><b>Interface sounds</b><small>Short synthesised feedback cues.</small></span>
            <input type="checkbox" class="switch" id="setSound">
          </label>
          <label class="setting-row">
            <span><b>Reduce motion</b><small>Turns off confetti, flips and most transitions.</small></span>
            <input type="checkbox" class="switch" id="setMotion">
          </label>
          <label class="setting-row">
            <span><b>Master volume</b><small>Used by interface sounds. Songle has its own volume slider.</small></span>
            <input type="range" id="setVolume" min="0" max="1" step="0.05">
          </label>
        </div>
        <div class="settings-actions">
          <button class="btn danger-ghost" id="resetAllData">Reset all arcade data</button>
          <span class="tiny-note">Statistics, streaks and daily completion are stored separately for each game.</span>
        </div>
      </div>`;
      document.body.appendChild(dlg);
      const sound = dlg.querySelector("#setSound");
      const motion = dlg.querySelector("#setMotion");
      const volume = dlg.querySelector("#setVolume");
      const sync = () => {
        const s = getSettings();
        sound.checked = !!s.sound;
        motion.checked = !!s.reduceMotion;
        volume.value = s.volume;
      };
      sound.addEventListener("change", () => { saveSettings({ sound: sound.checked }); sfx("click"); });
      motion.addEventListener("change", () => saveSettings({ reduceMotion: motion.checked }));
      volume.addEventListener("input", () => saveSettings({ volume: Number(volume.value) }));
      dlg.querySelector("#resetAllData").addEventListener("click", async () => {
        if (await confirmDialog({ title: "Reset everything?", message: "This deletes all six games' statistics, streaks and daily completions on this device. It cannot be undone.", confirmText: "Delete all data", danger: true })) {
          resetAll();
          location.reload();
        }
      });
      dlg.addEventListener("show", sync);
      dlg.addEventListener("open", sync);
      dlg.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => dlg.close()));
      dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
      new MutationObserver(() => { if (dlg.open) sync(); }).observe(dlg, { attributes: true, attributeFilter: ["open"] });
    }

    if (!document.getElementById("overviewDialog")) {
      const dlg = document.createElement("dialog");
      dlg.id = "overviewDialog";
      dlg.className = "modal";
      dlg.setAttribute("aria-label", "Arcade overview");
      dlg.innerHTML = `<div class="dialog-inner">
        <div class="dialog-head">
          <div><h2>Arcade overview</h2><p>Each game keeps its own score, streak and daily state.</p></div>
          <button class="x-btn" data-close aria-label="Close">${icon("x")}</button>
        </div>
        <div id="overviewBody"></div>
      </div>`;
      document.body.appendChild(dlg);
      dlg.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => dlg.close()));
      dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
    }
  }

  function openSettings() {
    const dlg = document.getElementById("settingsDialog");
    if (dlg) { if (!dlg.open) dlg.showModal(); }
  }
  function openOverview() {
    const dlg = document.getElementById("overviewDialog");
    if (!dlg) return;
    const body = document.getElementById("overviewBody");
    if (!body) return;
    body.innerHTML = Object.entries(GAME_META).map(([id, meta]) => {
      const s = getStats(id);
      const daily = getDaily(id);
      const done = !!daily;
      const won = daily?.won;
      return `<div class="overview-row" style="--game-color:${meta.color}">
        <span class="overview-icon">${icon(meta.icon)}</span>
        <span class="overview-name"><b>${esc(meta.name)}</b><small>${done ? (won ? "Today complete" : "Played today") : "Daily not played"}</small></span>
        <span class="overview-stat"><b>${s.streak || 0}</b><small>streak</small></span>
        <span class="overview-stat"><b>${s.maxStreak || 0}</b><small>best</small></span>
        <a class="overview-link" href="${meta.path}">${done ? "Review" : "Play"} ${icon("chevron")}</a>
      </div>`;
    }).join("");
    if (!dlg.open) dlg.showModal();
  }

  /* ------------------------------------------------------------------ *
   * Header / footer / page setup
   * ------------------------------------------------------------------ */
  function rootPath() {
    return location.pathname.replace(/\\/g, "/").includes("/games/") ? "../" : "";
  }

  function mountHeader(active = "") {
    const host = document.getElementById("siteHeader");
    if (!host) return;
    const root = rootPath();
    const meta = active && GAME_META[active];
    const summary = dailySummary();
    const links = [
      { href: `${root}index.html`, label: "Arcade", key: "home" },
      { href: `${root}index.html#games`, label: "Games", key: "games" },
      { href: `${root}index.html#daily`, label: "Daily", key: "daily" }
    ];
    host.className = "topbar-wrap";
    host.innerHTML = `<div class="topbar">
      <a class="brand" href="${root}index.html" aria-label="GD Arcade home">
        <span class="brand-cube">${icon("grid")}</span>
        <span class="brand-word">GD <b>ARCADE</b></span>
      </a>
      <nav class="main-nav" id="mainNav" aria-label="Main navigation">
        ${links.map((l) => `<a href="${l.href}" class="${active === l.key ? "active" : ""}">${l.label}</a>`).join("")}
        ${meta ? `<a href="${root}index.html#games" class="nav-current" style="--nav-color:${meta.color}">${esc(meta.name)}</a>` : ""}
      </nav>
      <div class="top-actions">
        <button class="daily-chip" type="button" data-open-overview title="Daily challenge progress">
          <span class="daily-dot"></span>
          <span>Daily <b>${summary.count}/${summary.total}</b></span>
        </button>
        <button class="icon-btn" type="button" data-open-overview aria-label="Arcade statistics" title="Statistics">${icon("chart")}</button>
        <button class="icon-btn" type="button" data-open-settings aria-label="Settings" title="Settings">${icon("settings")}</button>
        <button class="icon-btn nav-toggle" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="mainNav">${icon("menu")}</button>
      </div>
    </div>
    <div class="nav-scrim" id="navScrim" hidden></div>`;

    const toggle = host.querySelector(".nav-toggle");
    const nav = host.querySelector("#mainNav");
    const scrim = host.querySelector("#navScrim");
    const setOpen = (open) => {
      nav.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.innerHTML = icon(open ? "x" : "menu");
      scrim.hidden = !open;
      document.body.classList.toggle("nav-open", open);
    };
    toggle.addEventListener("click", () => setOpen(!nav.classList.contains("open")));
    scrim.addEventListener("click", () => setOpen(false));
    nav.addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });
    host.querySelectorAll("[data-open-settings]").forEach((b) => b.addEventListener("click", openSettings));
    host.querySelectorAll("[data-open-overview]").forEach((b) => b.addEventListener("click", openOverview));
  }

  function setupPage({ game = "", title = "" } = {}) {
    mountGlobalDialogs();
    applySettings();
    mountHeader(game);
    document.querySelectorAll("[data-open-settings]").forEach((b) => b.addEventListener("click", openSettings));
    document.querySelectorAll("[data-open-overview]").forEach((b) => b.addEventListener("click", openOverview));
    document.querySelectorAll("dialog [data-close], dialog .x-btn").forEach((b) => {
      if (b.dataset.boundClose) return;
      b.dataset.boundClose = "1";
      b.addEventListener("click", () => b.closest("dialog")?.close());
    });
    document.querySelectorAll("dialog").forEach((dlg) => {
      if (dlg.dataset.boundBackdrop) return;
      dlg.dataset.boundBackdrop = "1";
      dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
    });
    document.querySelectorAll("[data-open-help]").forEach((b) => b.addEventListener("click", () => {
      const dlg = document.getElementById("helpDialog");
      if (dlg && !dlg.open) dlg.showModal();
    }));
    document.querySelectorAll("[data-open-game-stats]").forEach((b) => b.addEventListener("click", () => {
      const dlg = document.getElementById("gameStatsDialog");
      if (dlg && !dlg.open) dlg.showModal();
    }));
    document.querySelectorAll("[data-countdown]").forEach((el) => {
      const tick = () => { el.textContent = fmtDuration(msToMidnight()); };
      tick();
      setInterval(tick, 1000);
    });
    document.querySelectorAll("[data-year]").forEach((el) => { el.textContent = new Date().getFullYear(); });
    if (title) document.title = title;
    bindThumbs(document);
    // Global click cue for buttons, without hijacking real audio controls.
    document.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b || b.disabled || b.classList.contains("no-sfx") || b.closest("audio")) return;
      sfx(b.classList.contains("primary") ? "click" : "tick");
    });
    // Keep homepage cards fresh when returning from a game.
    window.addEventListener("pageshow", (e) => {
      if (e.persisted) location.reload();
    });
  }

  function footerHTML() {
    return `<footer class="site-footer">
      <div class="footer-inner">
        <span class="footer-brand">${icon("grid")} GD <b>ARCADE</b></span>
        <span>Unofficial fan project · Not affiliated with RobTop Games.</span>
        <span>Data: GDBrowser · Pointercrate · thumbnails by levelthumbs.prevter.me · songs via Newgrounds.</span>
        <span>© <span data-year></span> GD Arcade · Built for the community.</span>
      </div>
    </footer>`;
  }

  /* ------------------------------------------------------------------ *
   * Search combobox
   * ------------------------------------------------------------------ */
  function createSearch({ input, list, items, label, meta, onPick, emptyText = "No matches", max = 9 }) {
    let active = -1;
    let results = [];
    const close = () => { list.classList.remove("open"); input.setAttribute("aria-expanded", "false"); input.setAttribute("aria-activedescendant", ""); active = -1; };
    const render = () => {
      if (!results.length) {
        list.innerHTML = `<li class="suggestion-empty">${esc(emptyText)}</li>`;
        list.classList.add("open");
        input.setAttribute("aria-expanded", "true");
        return;
      }
      list.innerHTML = results.map((item, i) => `<li class="suggestion ${i === active ? "active" : ""}" role="option" id="ac-opt-${i}" aria-selected="${i === active}" data-index="${i}">
        <span class="suggestion-main"><span class="s-name">${label(item)}</span><span class="s-meta">${meta ? meta(item) : ""}</span></span>
        <span class="s-arrow">${icon("chevron")}</span>
      </li>`).join("");
      list.classList.add("open");
      input.setAttribute("aria-expanded", "true");
      if (active >= 0) input.setAttribute("aria-activedescendant", `ac-opt-${active}`);
    };
    const search = () => {
      const q = norm(input.value);
      if (!q) { results = []; close(); return; }
      results = items
        .map((item) => {
          const hay = `${label(item)} ${meta ? meta(item).replace(/<[^>]*>/g, " ") : ""}`;
          const n = norm(hay);
          const idx = n.indexOf(q);
          return idx >= 0 ? { item, idx, len: q.length } : null;
        })
        .filter(Boolean)
        .sort((a, b) => a.idx - b.idx || a.item._name?.localeCompare?.(b.item._name) || 0)
        .slice(0, max)
        .map((x) => x.item);
      active = results.length ? 0 : -1;
      render();
    };
    const choose = (i) => {
      const item = results[i];
      if (!item) return;
      close();
      onPick(item);
    };
    input.addEventListener("input", search);
    input.addEventListener("focus", () => { if (input.value.trim() && !results.length) search(); });
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); if (!results.length) search(); active = clamp(active + 1, 0, results.length - 1); render(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); active = clamp(active - 1, 0, results.length - 1); render(); }
      else if (e.key === "Enter") {
        // When the listbox is open, Enter only chooses the highlighted
        // suggestion. A second Enter (with the list closed) is left to the
        // game so it can submit or confirm the guess.
        if (list.classList.contains("open") && active >= 0) {
          e.preventDefault();
          e.stopImmediatePropagation();
          choose(active);
        }
      }
      else if (e.key === "Escape") { close(); }
    });
    list.addEventListener("mousedown", (e) => e.preventDefault());
    list.addEventListener("click", (e) => {
      const row = e.target.closest("[data-index]");
      if (row) choose(Number(row.dataset.index));
    });
    document.addEventListener("click", (e) => { if (!e.target.closest(".search-field")) close(); });
    return { search, close, clear: () => { input.value = ""; results = []; close(); }, input };
  }

  /* ------------------------------------------------------------------ *
   * Misc game helpers
   * ------------------------------------------------------------------ */
  function answerMeter(el, current, max) {
    if (!el) return;
    el.innerHTML = Array.from({ length: max }, (_, i) => `<i class="${i < current ? "used" : ""}"></i>`).join("");
  }

  function categoryClass(tier) {
    return ["tier-1", "tier-2", "tier-3", "tier-4"][clamp(tier - 1, 0, 3)];
  }

  function modeWatch(onChange) {
    const tabs = [...document.querySelectorAll("[data-mode]")];
    tabs.forEach((tab) => tab.addEventListener("click", () => {
      tabs.forEach((t) => t.setAttribute("aria-pressed", String(t === tab)));
      onChange(tab.dataset.mode);
    }));
    return tabs.find((t) => t.getAttribute("aria-pressed") === "true")?.dataset.mode || "daily";
  }

  /* ------------------------------------------------------------------ *
   * Public API
   * ------------------------------------------------------------------ */
  window.GDArcade = {
    DAY_MS, EPOCH, DIFF_RANK, LENGTHS, POP_STEPS, GAME_META,
    levels, byId, byName, dailyPool, rankedDemons, songs, songByLevel, demonlist, connectionsGroups,
    store, dateKey, dayNumber, yesterdayKey, msToMidnight, fmtDuration, fmtDate,
    hashString, mulberry32, rngFor, shuffle, pick, pickN,
    esc, norm, clamp, fmtNum, fmtFull, initials, thumbUrl,
    getSettings, saveSettings, applySettings, sfx,
    getStats, saveStats, getDaily, isDailyDone, getProgress, saveProgress, clearProgress,
    markDaily, markPractice, updateStreak, resetGame, resetAll, dailySummary,
    thumbHTML, bindThumbs, icon, gameIcon,
    toast, confirmDialog, confetti, copyText, shareText,
    openSettings, openOverview, setupPage, footerHTML, createSearch,
    answerMeter, categoryClass, modeWatch
  };
})();
