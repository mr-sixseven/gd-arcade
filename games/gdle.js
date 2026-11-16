/* GD Arcade — GD-le (Game 1) */
(() => {
  "use strict";
  const A = window.GDArcade;
  if (!A) return;

  const MAX = 6;
  const GAME = "gdle";
  const $ = (sel, root = document) => root.querySelector(sel);
  const input = $("#levelInput");
  const suggestions = $("#suggestions");
  const rowsEl = $("#rows");
  const boardHead = $("#boardHead");
  const emptyState = $("#emptyState");
  const resultEl = $("#result");
  const hint = $("#hint");
  const hintThumb = $("#hintThumb");

  const HEAD = ["Level", "Difficulty", "Creator", "Song", "Length", "Version", "Downloads", "Likes", "Stars", "Demon rank"];
  const MODE_LABEL = { daily: "Daily puzzle", practice: "Practice round" };

  let mode = "daily";
  let answer = null;
  let guesses = [];
  let status = "playing";
  let selectedLevel = null;

  boardHead.innerHTML = HEAD.map((h, i) => `<div class="head-cell ${i === 0 ? "sticky" : ""}">${h}</div>`).join("");
  A.answerMeter($("#attemptDots"), 0, MAX);
  document.querySelectorAll("[data-icon]").forEach((el) => { el.innerHTML = A.icon(el.dataset.icon); });

  function dailyAnswer() {
    const pool = A.dailyPool.length ? A.dailyPool : A.levels;
    const rnd = A.rngFor(GAME, "answer");
    return pool[Math.floor(rnd() * pool.length)];
  }

  function randomAnswer() {
    let candidate = A.pick(A.levels);
    if (A.levels.length > 1 && candidate === answer) candidate = A.pick(A.levels);
    return candidate;
  }

  function arrow(answerValue, guessValue) {
    if (answerValue > guessValue) return "↑";
    if (answerValue < guessValue) return "↓";
    return "";
  }

  function cell(cls, value, sub, mark, arrowText, index = 0) {
    return `<div class="cell ${cls}" style="--i:${index}" title="${A.esc(sub || value)}">
      <span class="mark">${mark}${arrowText ? " " + arrowText : ""}</span>
      <span class="val">${value}</span>
      ${sub ? `<span class="sub">${sub}</span>` : ""}
    </div>`;
  }

  function compare(guess, target) {
    const out = [];

    // Difficulty
    const diffArrow = arrow(target._diff, guess._diff);
    out.push({ key: "difficulty", cls: target.difficulty === guess.difficulty ? "exact" : Math.abs(target._diff - guess._diff) === 1 ? "close" : "miss", value: A.esc(guess.difficulty), sub: "", mark: target.difficulty === guess.difficulty ? "✓" : diffArrow || "✕", arrow: diffArrow });

    // Creator
    out.push({ key: "creator", cls: A.norm(target.creator) === A.norm(guess.creator) ? "exact" : "miss", value: A.esc(guess.creator), sub: "", mark: A.norm(target.creator) === A.norm(guess.creator) ? "✓" : "✕", arrow: "" });

    // Song
    const songExact = A.norm(target.song) === A.norm(guess.song);
    const artistSame = A.norm(target.songAuthor) === A.norm(guess.songAuthor);
    out.push({ key: "song", cls: songExact ? "exact" : artistSame ? "close" : "miss", value: A.esc(guess.song), sub: A.esc(guess.songAuthor), mark: songExact ? "✓" : artistSame ? "≈" : "✕", arrow: "" });

    // Length
    const lenArrow = arrow(target._len, guess._len);
    out.push({ key: "length", cls: target._len === guess._len ? "exact" : Math.abs(target._len - guess._len) === 1 ? "close" : "miss", value: A.esc(guess.length), sub: "", mark: target._len === guess._len ? "✓" : lenArrow || "✕", arrow: lenArrow });

    // Version
    const verArrow = arrow(target._ver, guess._ver);
    out.push({ key: "version", cls: target._ver === guess._ver ? "exact" : Math.abs(target._ver - guess._ver) <= 1 ? "close" : "miss", value: A.esc(guess.version), sub: "", mark: target._ver === guess._ver ? "✓" : verArrow || "✕", arrow: verArrow });

    // Downloads (bucket)
    const popArrow = arrow(target._pop, guess._pop);
    out.push({ key: "downloads", cls: target._pop === guess._pop ? "exact" : Math.abs(target._pop - guess._pop) <= 1 ? "close" : "miss", value: A.fmtNum(guess.downloads), sub: A.fmtFull(guess.downloads), mark: target._pop === guess._pop ? "✓" : popArrow || "✕", arrow: popArrow });

    // Likes
    const likeArrow = arrow(target.likes, guess.likes);
    const likeDiff = Math.abs((target.likes || 0) - (guess.likes || 0));
    const likeClose = likeDiff <= Math.max(2000, Math.max(target.likes, guess.likes) * 0.2);
    out.push({ key: "likes", cls: target.likes === guess.likes ? "exact" : likeClose ? "close" : "miss", value: A.fmtNum(guess.likes), sub: A.fmtFull(guess.likes), mark: target.likes === guess.likes ? "✓" : likeArrow || "✕", arrow: likeArrow });

    // Stars
    const starArrow = arrow(target.stars, guess.stars);
    out.push({ key: "stars", cls: target.stars === guess.stars ? "exact" : Math.abs(target.stars - guess.stars) <= 1 ? "close" : "miss", value: String(guess.stars), sub: guess.stars ? "stars" : "no stars", mark: target.stars === guess.stars ? "✓" : starArrow || "✕", arrow: starArrow });

    // Demon rank (Pointercrate)
    const gr = guess.demonPosition;
    const tr = target.demonPosition;
    let dCls = "miss", dMark = "✕", dArrow = "", dSub = "Not ranked";
    if (!gr && !tr) { dCls = "exact"; dMark = "✓"; dSub = "Unranked"; }
    else if (gr && tr) {
      dCls = gr === tr ? "exact" : Math.abs(gr - tr) <= 10 ? "close" : "miss";
      dMark = gr === tr ? "✓" : "≈";
      dArrow = tr < gr ? "↑" : tr > gr ? "↓" : "";
      dSub = "Pointercrate";
    }
    out.push({ key: "demon", cls: dCls, value: gr ? `#${gr}` : "—", sub: dSub, mark: dMark, arrow: dArrow });

    return out;
  }

  function renderRow(level, animate = true) {
    emptyState.hidden = true;
    const row = document.createElement("div");
    row.className = "row" + (animate ? " reveal" : "");
    const cells = compare(level, answer);
    row.innerHTML = `<div class="cell name-cell ${cells.every((c) => c.cls === "exact") ? "exact" : ""}">
        <span class="val">${A.esc(level.name)}</span>
        <span class="sub">${A.esc(level.creator)}</span>
      </div>` + cells.map((c, i) => cell(c.cls, c.value, c.sub, c.mark, c.arrow, i + 1)).join("");
    rowsEl.appendChild(row);
    A.bindThumbs(row);
  }

  function rebuildBoard(ids) {
    rowsEl.innerHTML = "";
    for (const id of ids) {
      const level = A.byId.get(String(id));
      if (level) renderRow(level, false);
    }
    if (!ids.length) emptyState.hidden = false;
  }

  function updateAttempts() {
    const left = MAX - guesses.length;
    $("#attemptsLabel").textContent = left === 0 ? "No guesses left" : left === 1 ? "1 guess left" : `${left} guesses left`;
    A.answerMeter($("#attemptDots"), guesses.length, MAX);
    const dots = $("#attemptDots").children;
    if (dots.length) {
      dots[dots.length - 1]?.classList.remove("won");
      if (status === "won") [...dots].forEach((d) => d.classList.add("used"));
      if (status === "won" && guesses.length) dots[guesses.length - 1].classList.add("won");
    }
  }

  function updateSideStats() {
    const s = A.getStats(GAME);
    const rate = s.played ? Math.round((s.wins / s.played) * 100) : 0;
    $("#sideStats").innerHTML = `
      <div class="side-stat"><b>${s.played}</b><span>Played</span></div>
      <div class="side-stat"><b>${rate}%</b><span>Win rate</span></div>
      <div class="side-stat"><b>${s.streak || 0}</b><span>Streak</span></div>
      <div class="side-stat"><b>${s.maxStreak || 0}</b><span>Best</span></div>`;
    const badge = $("#dailyBadge");
    if (A.isDailyDone(GAME)) badge.textContent = "Daily complete";
    else badge.textContent = mode === "daily" ? `Daily #${A.dayNumber()}` : "Practice mode";
    badge.className = `chip ${A.isDailyDone(GAME) ? "green" : mode === "daily" ? "cyan" : ""}`;
  }

  function showHint() {
    if (!answer) return;
    hint.hidden = false;
    hintThumb.innerHTML = A.thumbHTML(answer, { alt: "Thumbnail hint", eager: true, wrapClass: "hint-wrap" });
    A.bindThumbs(hint);
  }

  function resultMarkup(won) {
    const rate = A.getStats(GAME);
    return `<div class="result-card ${won ? "won" : "lost"}">
      <div class="result-thumb">${A.thumbHTML(answer, { alt: answer.name + " thumbnail", eager: true })}</div>
      <div class="result-body">
        <p class="result-kicker">${won ? `Solved in ${guesses.length}/6` : "Out of guesses"}</p>
        <h3 class="result-name">${A.esc(answer.name)}</h3>
        <p class="result-meta">by ${A.esc(answer.creator)} · ${A.esc(answer.difficulty)} · ${A.esc(answer.song)} · ${A.fmtNum(answer.downloads)} downloads</p>
        <div class="result-actions">
          <a href="https://gdbrowser.com/${encodeURIComponent(answer.id)}" target="_blank" rel="noopener">Open in GDBrowser</a>
          <span class="tag">${answer.demonPosition ? `Demonlist #${answer.demonPosition}` : "Not demon-ranked"}</span>
          <span class="tag">${A.esc(answer.length)}</span>
          <span class="tag">v${A.esc(answer.version)}</span>
        </div>
      </div>
    </div>`;
  }

  function endGame(won) {
    status = won ? "won" : "lost";
    updateAttempts();
    if (mode === "daily") {
      const grid = guesses.map((g) => compare(g, answer).map((c) => c.cls === "exact" ? "🟩" : c.cls === "close" ? "🟨" : "⬛").join(""));
      A.markDaily(GAME, {
        won, guesses: guesses.length, answerId: answer.id,
        guessIds: guesses.map((g) => g.id), grid
      }, (s) => {
        if (won) {
          s.distribution ||= [0, 0, 0, 0, 0, 0];
          s.distribution[Math.min(MAX, guesses.length) - 1] = (s.distribution[Math.min(MAX, guesses.length) - 1] || 0) + 1;
        }
        s.totalGuesses = (s.totalGuesses || 0) + guesses.length;
        s.lastAnswer = answer.name;
      });
      A.clearProgress(GAME);
    }
    const wonNow = won;
    resultEl.hidden = false;
    resultEl.innerHTML = resultMarkup(wonNow);
    A.bindThumbs(resultEl);
    $("#btnShare").hidden = false;
    $("#btnRandom").textContent = mode === "daily" ? "Play practice round" : "New level";
    input.disabled = true;
    $("#btnGuess").disabled = true;
    if (wonNow) { A.sfx("win"); A.confetti(42); }
    else A.sfx("lose");
    updateSideStats();
    renderStatsDialog();
  }

  function resetBoard() {
    guesses = [];
    status = "playing";
    resultEl.hidden = true;
    resultEl.innerHTML = "";
    hint.hidden = true;
    hintThumb.innerHTML = "";
    rowsEl.innerHTML = "";
    emptyState.hidden = false;
    input.disabled = false;
    input.value = "";
    $("#btnGuess").disabled = false;
    $("#btnShare").hidden = true;
    $("#btnRandom").textContent = mode === "daily" ? "New level" : "New level";
    selectedLevel = null;
    updateAttempts();
    updateSideStats();
  }

  function startDaily() {
    mode = "daily";
    answer = dailyAnswer();
    resetBoard();
    const progress = A.getProgress(GAME);
    if (progress && progress.date === A.dateKey() && progress.answerId === answer.id && Array.isArray(progress.guessIds)) {
      rebuildBoard(progress.guessIds);
      guesses = progress.guessIds.map((id) => A.byId.get(String(id))).filter(Boolean);
      updateAttempts();
      if (guesses.length === MAX - 1) showHint();
    }
    setModeUI();
    updateSideStats();
  }

  function startPractice() {
    mode = "practice";
    answer = randomAnswer();
    resetBoard();
    setModeUI();
    updateSideStats();
    A.toast("Practice round — no stats, no waiting.");
  }

  function setModeUI() {
    document.querySelectorAll("[data-mode]").forEach((t) => t.setAttribute("aria-pressed", String(t.dataset.mode === mode)));
  }

  function restoreDaily() {
    const saved = A.getDaily(GAME);
    if (!saved) { startDaily(); return; }
    mode = "daily";
    answer = A.byId.get(String(saved.answerId)) || dailyAnswer();
    resetBoard();
    rebuildBoard(saved.guessIds || []);
    guesses = (saved.guessIds || []).map((id) => A.byId.get(String(id))).filter(Boolean);
    status = saved.won ? "won" : "lost";
    updateAttempts();
    resultEl.hidden = false;
    resultEl.innerHTML = resultMarkup(!!saved.won);
    A.bindThumbs(resultEl);
    $("#btnShare").hidden = false;
    $("#btnRandom").textContent = "Play practice round";
    input.disabled = true;
    $("#btnGuess").disabled = true;
    setModeUI();
    updateSideStats();
    renderStatsDialog();
  }

  function submitGuess() {
    if (status !== "playing") return;
    const level = selectedLevel || A.byName.get(A.norm(input.value));
    if (!level) {
      A.toast("Pick a level from the list", "error");
      $(".search-row").classList.add("shake");
      setTimeout(() => $(".search-row").classList.remove("shake"), 380);
      return;
    }
    if (guesses.some((g) => g.id === level.id)) {
      A.toast("You already guessed that level", "error");
      return;
    }
    guesses.push(level);
    renderRow(level);
    input.value = "";
    selectedLevel = null;
    updateAttempts();
    if (mode === "daily") A.saveProgress(GAME, { date: A.dateKey(), answerId: answer.id, guessIds: guesses.map((g) => g.id) });

    if (level.id === answer.id) {
      endGame(true);
      return;
    }
    if (guesses.length >= MAX) {
      endGame(false);
      return;
    }
    if (guesses.length === MAX - 1) showHint();
  }

  function renderStatsDialog() {
    const s = A.getStats(GAME);
    $("#statPlayed").textContent = s.played || 0;
    $("#statWin").textContent = `${s.played ? Math.round((s.wins / s.played) * 100) : 0}%`;
    $("#statStreak").textContent = s.streak || 0;
    $("#statMax").textContent = s.maxStreak || 0;
    const dist = Array.isArray(s.distribution) ? s.distribution : [0, 0, 0, 0, 0, 0];
    const max = Math.max(1, ...dist.map((n) => Number(n) || 0));
    const today = A.getDaily(GAME);
    $("#dist").innerHTML = dist.map((n, i) => {
      const isToday = today && today.won && Number(today.guesses) === i + 1;
      return `<div class="dist-row ${isToday ? "today" : ""}"><span>${i + 1}</span><div class="dist-bar"><div class="dist-fill" style="width:${Math.max(6, ((Number(n) || 0) / max) * 100)}%">${n || 0}</div></div></div>`;
    }).join("");
  }

  function shareResult() {
    const saved = A.getDaily(GAME);
    const grid = mode === "daily" && saved?.grid ? saved.grid : guesses.map((g) => compare(g, answer).map((c) => c.cls === "exact" ? "🟩" : c.cls === "close" ? "🟨" : "⬛").join(""));
    const title = mode === "daily" ? `GD Arcade · GD-le #${A.dayNumber()}` : "GD Arcade · GD-le Practice";
    const score = status === "won" ? `${guesses.length}/6` : "X/6";
    A.shareText(`${title}\n${score}\n${grid.join("\n")}\n${location.origin}${location.pathname}`);
  }

  // Search
  A.createSearch({
    input,
    list: suggestions,
    items: A.levels,
    label: (l) => A.esc(l.name),
    meta: (l) => `${A.esc(l.creator)} · ${A.esc(l.difficulty)}`,
    onPick: (level) => {
      selectedLevel = level;
      input.value = level.name;
      input.focus();
    }
  });
  input.addEventListener("input", () => { selectedLevel = null; });

  $("#btnGuess").addEventListener("click", submitGuess);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submitGuess(); } });
  $("#btnShare").addEventListener("click", shareResult);
  $("#btnRandom").addEventListener("click", () => {
    if (mode === "daily") startPractice();
    else startPractice();
  });
  document.querySelectorAll("[data-mode]").forEach((tab) => tab.addEventListener("click", () => {
    if (tab.dataset.mode === "daily") restoreDaily();
    else startPractice();
  }));
  document.querySelectorAll("[data-open-game-stats]").forEach((b) => b.addEventListener("click", () => { renderStatsDialog(); $("#gameStatsDialog").showModal(); }));
  $("#resetGdle").addEventListener("click", async () => {
    if (await A.confirmDialog({ title: "Reset GD-le stats?", message: "This deletes GD-le's daily stats, streak, distribution and today's completion. Other games are not affected.", confirmText: "Reset GD-le", danger: true })) {
      A.resetGame(GAME);
      location.reload();
    }
  });

  A.setupPage({ game: GAME });
  document.querySelectorAll("[data-icon]").forEach((el) => { el.innerHTML = A.icon(el.dataset.icon); });
  restoreDaily();
  updateSideStats();
  renderStatsDialog();
})();
