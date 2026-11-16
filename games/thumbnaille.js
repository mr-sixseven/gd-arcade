/* GD Arcade — Thumbnaille (Game 3) */
(() => {
  "use strict";
  const A = window.GDArcade;
  if (!A) return;

  const GAME = "thumbnaille";
  const MAX = 6;
  const DIFFS = {
    easy:   { label: "Easy",   steps: [8, 6, 4, 3, 2, 1, 0] },
    normal: { label: "Normal", steps: [16, 12, 8, 5, 3, 1, 0] },
    hard:   { label: "Hard",   steps: [26, 20, 14, 9, 5, 2, 0] }
  };
  const HINTS = [
    { label: "Creator", at: 2, value: (l) => l.creator },
    { label: "Difficulty", at: 3, value: (l) => l.difficulty },
    { label: "Song", at: 4, value: (l) => l.song + (l.songAuthor ? ` · ${l.songAuthor}` : "") }
  ];

  const $ = (sel) => document.querySelector(sel);
  const stage = $("#thumbStage");
  const stageImage = $("#stageImage");
  const input = $("#thumbInput");
  const resultEl = $("#thumbResult");

  let mode = "daily";
  let difficulty = DIFFS[A.store.get("thumbnaille.difficulty", "normal")] ? A.store.get("thumbnaille.difficulty", "normal") : "normal";
  let answer = null;
  let attempts = [];
  let tryCount = 0;
  let status = "playing";
  let selectedLevel = null;
  let lastPracticeId = null;

  /* ------------------------------------------------------------------ *
   * Puzzle selection
   * ------------------------------------------------------------------ */
  function pool() {
    return A.dailyPool.length ? A.dailyPool : A.levels;
  }

  function dailyAnswer() {
    const list = pool();
    const rnd = A.rngFor(GAME, "answer");
    return list[Math.floor(rnd() * list.length)];
  }

  function randomAnswer() {
    const list = pool();
    const options = list.filter((l) => l.id !== answer?.id && l.id !== lastPracticeId);
    return A.pick(options.length ? options : list);
  }

  /* ------------------------------------------------------------------ *
   * Rendering
   * ------------------------------------------------------------------ */
  function renderStage() {
    stageImage.innerHTML = answer
      ? A.thumbHTML(answer, { alt: "Mystery level thumbnail", eager: true })
      : "";
    A.bindThumbs(stageImage);

    stage.classList.remove("thumb-error");
    stage.classList.add("loading");
    const img = stageImage.querySelector("img");
    if (img) {
      const loaded = () => stage.classList.remove("loading");
      img.addEventListener("load", loaded, { once: true });
      img.addEventListener("error", () => {
        stage.classList.remove("loading");
        stage.classList.add("thumb-error");
        A.toast("Thumbnail unavailable — the hints still work.", "error");
      }, { once: true });
      if (img.complete) loaded();
    } else {
      stage.classList.remove("loading");
    }

    $("#thumbBadge").textContent = mode === "daily" ? `Daily #${A.dayNumber()}` : "Practice";
  }

  function blurSteps() {
    return DIFFS[difficulty].steps;
  }

  function applyReveal() {
    const steps = blurSteps();
    const finished = status !== "playing";
    const index = Math.min(tryCount, steps.length - 1);
    const blur = finished ? 0 : steps[index];
    const start = steps[0] || 1;

    stage.style.setProperty("--blur", `${blur}px`);
    stage.classList.toggle("revealed", finished || blur === 0);
    const pct = finished ? 100 : Math.round(((start - blur) / start) * 100);
    $("#revealFill").style.width = `${pct}%`;
    $("#revealLabel").textContent = finished ? "Image revealed" : blur === 0 ? "Fully revealed" : `${blur}px blur`;
    $("#thumbDifficulty").textContent = DIFFS[difficulty].label;
  }

  function renderAttempts() {
    const used = Math.min(tryCount, MAX);
    $("#thumbAttempts").innerHTML = Array.from({ length: MAX }, (_, i) => {
      const cls = i < used ? (status === "won" && i === used - 1 ? "won" : "lost") : "";
      return `<i class="${cls}"></i>`;
    }).join("");
    $("#thumbAttempts").setAttribute("aria-label", `${Math.max(0, MAX - used)} attempts remaining`);
    $("#attemptChip").textContent = status === "won" ? "Solved" : status === "lost" ? "Out of tries" : `${MAX - used} attempt${MAX - used === 1 ? "" : "s"} left`;
  }

  function renderHints() {
    const wrong = Math.max(0, tryCount - (status === "won" ? 1 : 0));
    const force = status !== "playing";
    $("#thumbHints").innerHTML = HINTS.map((hint) => {
      const shown = force || wrong >= hint.at;
      let value = "";
      if (shown) {
        try { value = hint.value(answer) || "Not listed"; } catch { value = "Not listed"; }
      }
      const locked = `${hint.at - wrong} miss${hint.at - wrong === 1 ? "" : "es"} to unlock`;
      return `<span class="hint-chip ${shown ? "revealed" : ""}"><b>${hint.label}</b> ${shown ? A.esc(value) : `<span>${locked}</span>`}</span>`;
    }).join("");
  }

  function syncDifficultyButtons() {
    const locked = status !== "playing" || tryCount > 0;
    document.querySelectorAll("[data-diff]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.diff === difficulty));
      button.disabled = locked;
      button.title = locked ? "Difficulty is locked after the first guess" : `Start with ${DIFFS[button.dataset.diff].steps[0]}px blur`;
    });
  }

  function setDifficulty(next, persist = true) {
    if (!DIFFS[next]) return;
    difficulty = next;
    if (persist) A.store.set("thumbnaille.difficulty", next);
    syncDifficultyButtons();
    applyReveal();
  }

  function updateModeUI() {
    document.querySelectorAll("[data-mode]").forEach((tab) => {
      tab.setAttribute("aria-pressed", String(tab.dataset.mode === mode));
    });
  }

  function updateSideStats() {
    const stats = A.getStats(GAME);
    const rate = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;
    const avg = stats.wins ? ((stats.winAttempts || 0) / stats.wins).toFixed(1) : "0.0";
    $("#thumbSideStats").innerHTML = `
      <div class="side-stat"><b>${rate}%</b><span>Win rate</span></div>
      <div class="side-stat"><b>${avg}</b><span>Avg. attempts</span></div>
      <div class="side-stat"><b>${stats.streak || 0}</b><span>Streak</span></div>
      <div class="side-stat"><b>${stats.maxStreak || 0}</b><span>Best streak</span></div>`;

    const badge = $("#dailyBadge");
    const done = A.isDailyDone(GAME);
    badge.textContent = done ? "Daily complete" : mode === "daily" ? `Daily #${A.dayNumber()}` : "Practice mode";
    badge.className = `chip ${done ? "green" : mode === "daily" ? "purple" : "cyan"}`;
  }

  function refresh() {
    renderAttempts();
    renderHints();
    applyReveal();
    syncDifficultyButtons();
    updateModeUI();
    updateSideStats();
  }

  function resultMarkup(won) {
    const tries = tryCount || (won ? 1 : MAX);
    return `<div class="result-card ${won ? "won" : "lost"}">
      <div class="result-thumb">${A.thumbHTML(answer, { alt: `${answer.name} thumbnail`, eager: true })}</div>
      <div class="result-body">
        <p class="result-kicker">${won ? `Solved in ${tries}/${MAX} attempts` : `Out of attempts · ${tries}/${MAX}`}</p>
        <h3 class="result-name">${A.esc(answer.name)}</h3>
        <p class="result-meta">by ${A.esc(answer.creator)} · ${A.esc(answer.difficulty)} · ${A.esc(answer.song)} · ${A.fmtNum(answer.downloads)} downloads</p>
        <div class="result-actions">
          <a href="https://gdbrowser.com/${encodeURIComponent(answer.id)}" target="_blank" rel="noopener">Open in GDBrowser</a>
          <span class="tag">${A.esc(answer.length)}</span>
          <span class="tag">v${A.esc(answer.version)}</span>
          <span class="tag">${answer.demonPosition ? `Demonlist #${answer.demonPosition}` : `${answer.stars || 0} stars`}</span>
        </div>
      </div>
    </div>`;
  }

  function showResult(won) {
    resultEl.hidden = false;
    resultEl.innerHTML = resultMarkup(won);
    A.bindThumbs(resultEl);
  }

  /* ------------------------------------------------------------------ *
   * Round lifecycle
   * ------------------------------------------------------------------ */
  function resetRoundUI() {
    selectedLevel = null;
    input.value = "";
    input.disabled = false;
    $("#thumbGuessBtn").disabled = false;
    resultEl.hidden = true;
    resultEl.innerHTML = "";
    $("#thumbShare").hidden = true;
    $("#thumbNew").textContent = mode === "daily" ? "Play practice" : "New thumbnail";
  }

  function newDaily() {
    mode = "daily";
    answer = dailyAnswer();
    attempts = [];
    tryCount = 0;
    status = "playing";
    A.clearProgress(GAME);
    resetRoundUI();
    renderStage();
    refresh();
  }

  function newPractice() {
    mode = "practice";
    lastPracticeId = answer?.id || null;
    answer = randomAnswer();
    attempts = [];
    tryCount = 0;
    status = "playing";
    resetRoundUI();
    renderStage();
    refresh();
    A.toast("Practice thumbnail — no stats pressure.");
  }

  function saveProgress() {
    if (mode !== "daily" || status !== "playing" || !answer) return;
    A.saveProgress(GAME, {
      date: A.dateKey(),
      answerId: answer.id,
      attemptIds: attempts.map((level) => level.id),
      attempts: tryCount,
      difficulty,
      status
    });
  }

  function submitGuess() {
    if (status !== "playing" || !answer) return;
    const level = selectedLevel || A.byName.get(A.norm(input.value));
    if (!level) {
      A.toast("Pick a level from the suggestion list", "error");
      $(".thumb-guess").classList.add("shake");
      setTimeout(() => $(".thumb-guess")?.classList.remove("shake"), 380);
      input.focus();
      return;
    }
    if (attempts.some((guess) => guess.id === level.id)) {
      A.toast("You already tried that level", "error");
      return;
    }

    attempts.push(level);
    tryCount = attempts.length;
    selectedLevel = null;
    input.value = "";

    if (level.id === answer.id) {
      endGame(true);
      return;
    }

    A.sfx("wrong");
    stage.classList.add("shake");
    setTimeout(() => stage.classList.remove("shake"), 380);

    if (attempts.length >= MAX) {
      endGame(false);
      return;
    }

    saveProgress();
    refresh();
    const left = MAX - attempts.length;
    A.toast(`Not it — the image sharpened. ${left} attempt${left === 1 ? "" : "s"} left.`);
    input.focus();
  }

  function endGame(won) {
    if (status !== "playing") return;
    status = won ? "won" : "lost";
    tryCount = attempts.length || tryCount;

    input.disabled = true;
    $("#thumbGuessBtn").disabled = true;
    $("#thumbShare").hidden = false;
    $("#thumbNew").textContent = mode === "daily" ? "Play practice" : "New thumbnail";
    refresh();
    showResult(won);

    if (mode === "daily") {
      A.markDaily(GAME, {
        won,
        attempts: tryCount,
        answerId: answer.id,
        attemptIds: attempts.map((level) => level.id),
        difficulty
      }, (stats) => {
        stats.totalAttempts = (stats.totalAttempts || 0) + tryCount;
        if (won) {
          stats.winAttempts = (stats.winAttempts || 0) + tryCount;
          stats.distribution ||= [0, 0, 0, 0, 0, 0];
          const slot = Math.min(MAX, tryCount) - 1;
          stats.distribution[slot] = (stats.distribution[slot] || 0) + 1;
        }
        stats.lastAnswer = answer.name;
      });
      A.clearProgress(GAME);
    } else {
      A.markPractice(GAME, { won, attempts: tryCount }, (stats) => {
        if (won) stats.practiceWinAttempts = (stats.practiceWinAttempts || 0) + tryCount;
      });
    }

    updateSideStats();
    renderStatsDialog();
    if (won) { A.sfx("win"); A.confetti(44); }
    else A.sfx("lose");
  }

  function restoreDaily() {
    mode = "daily";
    const daily = A.getDaily(GAME);

    if (daily) {
      answer = A.byId.get(String(daily.answerId)) || dailyAnswer();
      attempts = (daily.attemptIds || []).map((id) => A.byId.get(String(id))).filter(Boolean);
      tryCount = daily.attempts || attempts.length || (daily.won ? 1 : MAX);
      status = daily.won ? "won" : "lost";
      if (DIFFS[daily.difficulty]) difficulty = daily.difficulty;

      resetRoundUI();
      input.disabled = true;
      $("#thumbGuessBtn").disabled = true;
      $("#thumbShare").hidden = false;
      $("#thumbNew").textContent = "Play practice";
      renderStage();
      refresh();
      showResult(!!daily.won);
      return;
    }

    const progress = A.getProgress(GAME);
    if (progress && progress.date === A.dateKey()) {
      answer = A.byId.get(String(progress.answerId)) || dailyAnswer();
      attempts = (progress.attemptIds || []).map((id) => A.byId.get(String(id))).filter(Boolean);
      tryCount = progress.attempts ?? attempts.length;
      status = "playing";
      if (DIFFS[progress.difficulty]) difficulty = progress.difficulty;

      resetRoundUI();
      renderStage();
      refresh();
      return;
    }

    newDaily();
  }

  /* ------------------------------------------------------------------ *
   * Stats, sharing, reset
   * ------------------------------------------------------------------ */
  function renderStatsDialog() {
    const stats = A.getStats(GAME);
    $("#statPlayed").textContent = stats.played || 0;
    $("#statWin").textContent = `${stats.played ? Math.round((stats.wins / stats.played) * 100) : 0}%`;
    $("#statStreak").textContent = stats.streak || 0;
    $("#statAvg").textContent = stats.wins ? ((stats.winAttempts || 0) / stats.wins).toFixed(1) : "0.0";

    const dist = Array.isArray(stats.distribution) ? stats.distribution : [0, 0, 0, 0, 0, 0];
    const max = Math.max(1, ...dist.map((n) => Number(n) || 0));
    const today = A.getDaily(GAME);
    $("#thumbDist").innerHTML = dist.map((count, i) => {
      const isToday = today && today.won && Number(today.attempts) === i + 1;
      return `<div class="dist-row ${isToday ? "today" : ""}">
        <span>${i + 1}</span>
        <div class="dist-bar"><div class="dist-fill" style="width:${Math.max(6, ((Number(count) || 0) / max) * 100)}%">${count || 0}</div></div>
      </div>`;
    }).join("");
  }

  function shareResult() {
    const title = mode === "daily" ? `GD Arcade · Thumbnaille #${A.dayNumber()}` : "GD Arcade · Thumbnaille Practice";
    const score = status === "won" ? `${tryCount}/${MAX}` : `X/${MAX}`;
    const row = Array.from({ length: Math.min(tryCount, MAX) }, (_, i) =>
      status === "won" && i === tryCount - 1 ? "🟩" : "🟪"
    ).join("");
    A.shareText(`${title}\n${score} · ${DIFFS[difficulty].label}\n${row}${status === "lost" ? " ❌" : ""}\n${location.origin}${location.pathname}`);
  }

  /* ------------------------------------------------------------------ *
   * Events
   * ------------------------------------------------------------------ */
  A.createSearch({
    input,
    list: $("#thumbSuggestions"),
    items: A.levels,
    label: (level) => A.esc(level.name),
    meta: (level) => `${A.esc(level.creator)} · ${A.esc(level.difficulty)}`,
    onPick: (level) => {
      selectedLevel = level;
      input.value = level.name;
      input.focus();
    }
  });
  input.addEventListener("input", () => { selectedLevel = null; });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") { event.preventDefault(); submitGuess(); }
  });

  $("#thumbGuessBtn").addEventListener("click", submitGuess);
  $("#thumbShare").addEventListener("click", shareResult);
  $("#thumbNew").addEventListener("click", newPractice);

  document.querySelectorAll("[data-diff]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.disabled) return;
      setDifficulty(button.dataset.diff);
      A.toast(`${DIFFS[button.dataset.diff].label} starts at ${DIFFS[button.dataset.diff].steps[0]}px blur.`);
    });
  });

  document.querySelectorAll("[data-mode]").forEach((tab) => {
    tab.addEventListener("click", () => {
      if (tab.dataset.mode === "daily") restoreDaily();
      else newPractice();
    });
  });

  document.querySelectorAll("[data-open-game-stats]").forEach((button) => {
    button.addEventListener("click", () => {
      renderStatsDialog();
      const dialog = $("#gameStatsDialog");
      if (dialog && !dialog.open) dialog.showModal();
    });
  });

  $("#resetThumb").addEventListener("click", async () => {
    const ok = await A.confirmDialog({
      title: "Reset Thumbnaille stats?",
      message: "This deletes Thumbnaille's daily stats, streak, attempt distribution and today's completion. Other games are not affected.",
      confirmText: "Reset Thumbnaille",
      danger: true
    });
    if (!ok) return;
    A.resetGame(GAME);
    location.reload();
  });

  // Icons inside static markup.
  document.querySelectorAll("[data-icon]").forEach((el) => { el.innerHTML = A.icon(el.dataset.icon); });

  A.setupPage({ game: GAME });
  restoreDaily();
  renderStatsDialog();
})();
