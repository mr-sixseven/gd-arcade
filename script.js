/* GD Arcade — homepage controller */
(() => {
  "use strict";
  const A = window.GDArcade;
  if (!A) return;

  const GAMES = [
    {
      id: "gdle",
      cls: "tile-gdle",
      title: "GD-le",
      desc: "Guess the daily Geometry Dash level in six tries. Green, yellow and arrows point the way — the thumbnail appears when it matters.",
      features: "6 guesses · 9 clues · thumbnail hint",
      preview: "gdle"
    },
    {
      id: "connections",
      cls: "tile-connections",
      title: "Connections",
      desc: "Sixteen levels, four hidden groups. Find the creators, songs, themes and odd details that bind four levels together.",
      features: "16 levels · 4 groups · 4 mistakes",
      preview: "connections"
    },
    {
      id: "thumbnaille",
      cls: "tile-thumbnaille",
      title: "Thumbnaille",
      desc: "A level thumbnail is hiding under layers of blur. Every miss reveals more. Three difficulty settings, one daily image.",
      features: "Real thumbnails · 3 difficulties",
      preview: "thumb"
    },
    {
      id: "higher-lower",
      cls: "tile-higher-lower",
      title: "Higher / Lower",
      desc: "Two levels, one stat. Is the next number higher, lower or dead level? Ties count too. Build the longest run you can.",
      features: "4 stats · ties handled · endless",
      preview: "hl"
    },
    {
      id: "demon-order",
      cls: "tile-demon-order",
      title: "Demon Order",
      desc: "Drag demons into difficulty order. Tier ladders use the in-game demon tiers; the demonlist challenge uses Pointercrate positions.",
      features: "Drag & drop · Pointercrate",
      preview: "order"
    },
    {
      id: "songle",
      cls: "tile-songle",
      title: "Songle",
      desc: "One second of audio, then two, then three. Identify the Geometry Dash song from authorised Newgrounds streams.",
      features: "6 excerpts · audio controls",
      preview: "songle"
    }
  ];

  const PREVIEW_LEVELS = {
    bloodbath: A.byName.get("bloodbath"),
    tidal: A.byName.get("tidal wave"),
    acheron: A.byName.get("acheron"),
    kenos: A.byName.get("kenos")
  };

  function previewMarkup(kind) {
    if (kind === "gdle") {
      const cells = ["g", "y", "d", "t", "d", "g", "d", "y", "t", "g", "d", "d"];
      return `<div class="preview-gdle" aria-hidden="true">${cells.map((c) => `<i class="${c}"></i>`).join("")}</div>`;
    }
    if (kind === "connections") {
      const cells = ["g1", "", "g2", "", "", "g2", "", "g1", "g3", "", "g4", "", "", "g4", "g3", ""];
      return `<div class="preview-connections" aria-hidden="true">${cells.map((c) => `<i class="${c}"></i>`).join("")}</div>`;
    }
    if (kind === "thumb") {
      return `<div class="preview-thumb" aria-hidden="true">
        <div class="mini-thumb">${A.thumbHTML(PREVIEW_LEVELS.bloodbath, { alt: "", eager: true })}</div>
        <div class="mini-thumb">${A.thumbHTML(PREVIEW_LEVELS.acheron, { alt: "", eager: true })}</div>
      </div>`;
    }
    if (kind === "hl") {
      return `<div class="preview-hl" aria-hidden="true">
        <div class="mini-card">
          <div class="mini-thumb">${A.thumbHTML(PREVIEW_LEVELS.tidal, { alt: "", eager: true })}</div>
          <div class="mini-lines"><i></i><i></i><i></i></div>
        </div>
        <span class="vs">VS</span>
        <div class="mini-card">
          <div class="mini-thumb">${A.thumbHTML(PREVIEW_LEVELS.kenos, { alt: "", eager: true })}</div>
          <div class="mini-lines"><i></i><i></i><i></i></div>
        </div>
      </div>`;
    }
    if (kind === "order") {
      return `<div class="preview-order" aria-hidden="true">
        ${[1, 2, 3, 4].map(() => `<div class="mini-row"><i></i><span></span></div>`).join("")}
      </div>`;
    }
    return `<div class="preview-songle" aria-hidden="true">
      <div class="preview-wave">${Array.from({ length: 17 }, (_, i) => `<i style="height:${8 + ((i * 13) % 34)}px"></i>`).join("")}</div>
      <span class="play-dot">${A.icon("play")}</span>
    </div>`;
  }

  function statsFor(id) {
    const s = A.getStats(id);
    const daily = A.getDaily(id);
    return { s, daily, done: !!daily, won: daily?.won };
  }

  function subtitleFor(id) {
    const { s, daily, done, won } = statsFor(id);
    switch (id) {
      case "gdle":
        return { meta: `<span class="tile-streak">${A.icon("fire")} ${s.streak || 0} streak</span><span class="tile-stat">Best ${s.maxStreak || 0}</span>`, status: done ? (won ? "Solved today" : "Played today") : "Daily unsolved" };
      case "connections":
        return { meta: `<span class="tile-streak">${A.icon("fire")} ${s.streak || 0} streak</span><span class="tile-stat">${s.played ? Math.round((s.wins / s.played) * 100) : 0}% solved</span>`, status: done ? (won ? "Groups found" : "Played today") : "Daily unsolved" };
      case "thumbnaille":
        return { meta: `<span class="tile-streak">${A.icon("fire")} ${s.streak || 0} streak</span><span class="tile-stat">${s.played ? Math.round((s.wins / s.played) * 100) : 0}% wins</span>`, status: done ? (won ? "Identified today" : "Played today") : "Daily unsolved" };
      case "higher-lower":
        return { meta: `<span class="tile-streak">${A.icon("fire")} Best run ${s.bestStreak || 0}</span><span class="tile-stat">${s.totalCorrect || 0} correct</span>`, status: done ? (won ? "Run complete" : "Played today") : "Daily unsolved" };
      case "demon-order":
        return { meta: `<span class="tile-streak">${A.icon("trophy")} Best ${A.fmtNum(s.bestScore || 0)}</span><span class="tile-stat">${s.completed || 0} sorted</span>`, status: done ? "Challenge sorted" : "Daily unsolved" };
      case "songle":
        return { meta: `<span class="tile-streak">${A.icon("fire")} ${s.streak || 0} streak</span><span class="tile-stat">${s.played ? Math.round((s.wins / s.played) * 100) : 0}% wins</span>`, status: done ? (won ? "Song guessed" : "Played today") : "Daily unsolved" };
      default:
        return { meta: "", status: "Daily unsolved" };
    }
  }

  function cardHTML(game) {
    const meta = A.GAME_META[game.id];
    const info = subtitleFor(game.id);
    const done = !!A.getDaily(game.id);
    return `<a class="game-tile ${game.cls}" href="${meta.path}" aria-label="Play ${A.esc(game.title)}">
      <div class="tile-preview">${previewMarkup(game.preview)}</div>
      <div class="tile-top">
        <span class="tile-icon" style="color:${meta.color}">${A.gameIcon(game.id)}</span>
        <span class="tile-badge ${done ? "done" : ""}">${done ? "✓ Today" : "Daily"}</span>
      </div>
      <div class="tile-body">
        <h3 class="tile-title">${A.esc(game.title)}</h3>
        <p class="tile-desc">${A.esc(game.desc)}</p>
        <div class="tile-meta">${info.meta}<span class="tile-stat">${A.esc(game.features)}</span></div>
        <div class="tile-bottom">
          <span class="tile-status ${done ? "done" : ""}"><span class="dot"></span>${info.status}</span>
          <span class="tile-play">Play ${A.icon("play")}</span>
        </div>
      </div>
    </a>`;
  }

  function renderHome() {
    document.getElementById("footerHost").innerHTML = A.footerHTML();
    document.getElementById("gamesGrid").innerHTML = GAMES.map(cardHTML).join("");
    A.bindThumbs(document);

    const summary = A.dailySummary();
    const ring = document.getElementById("dailyRing");
    ring.style.setProperty("--p", String(Math.round((summary.count / summary.total) * 100)));
    document.getElementById("dailyCount").textContent = summary.count;
    document.getElementById("dailyList").innerHTML = GAMES.map((g) => {
      const done = A.isDailyDone(g.id);
      return `<span class="daily-item ${done ? "done" : ""}"><span class="dot"></span>${A.esc(g.title)}</span>`;
    }).join("");

    const today = new Date();
    document.getElementById("todayLabel").textContent = today.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });

    let wins = 0, practice = 0, best = 0, correct = 0;
    for (const g of GAMES) {
      const s = A.getStats(g.id);
      wins += s.wins || 0;
      practice += s.practice || 0;
      best = Math.max(best, s.maxStreak || 0);
      correct += s.totalCorrect || 0;
    }
    document.getElementById("overallWins").textContent = A.fmtNum(wins);
    const longest = GAMES.map((g) => ({ name: g.title, s: A.getStats(g.id) })).sort((a, b) => (b.s.maxStreak || 0) - (a.s.maxStreak || 0))[0];
    document.getElementById("overallList").innerHTML = `
      <div class="overall-row-mini"><span>Best streak in a single game</span><b>${best}${longest && best ? ` · ${A.esc(longest.name)}` : ""}</b></div>
      <div class="overall-row-mini"><span>Practice rounds played</span><b>${A.fmtNum(practice)}</b></div>
      <div class="overall-row-mini"><span>Correct comparisons</span><b>${A.fmtNum(correct)}</b></div>
      <div class="overall-row-mini"><span>Levels in the shared database</span><b>${A.levels.length}</b></div>`;

    document.getElementById("heroStats").innerHTML = `
      <span class="stat-pill">${A.icon("grid")} <b>6</b> games</span>
      <span class="stat-pill">${A.icon("chart")} <b>${A.levels.length}</b> levels</span>
      <span class="stat-pill">${A.icon("trophy")} <b>${A.demonlist.length}</b> ranked demons</span>
      <span class="stat-pill">${A.icon("music")} <b>${A.songs.length}</b> playable songs</span>`;
    document.querySelector(".overall-title [data-icon]").innerHTML = A.icon("trophy");
  }

  A.setupPage({});
  // Homepage help button is not a game help dialog; wire it explicitly.
  document.querySelectorAll("[data-open-help]").forEach((b) => b.addEventListener("click", () => document.getElementById("helpDialog")?.showModal()));
  renderHome();
})();
