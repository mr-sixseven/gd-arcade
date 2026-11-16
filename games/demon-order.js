/* GD Arcade — Demon Order (Game 5) */
(() => {
  "use strict";
  const A = window.GDArcade;
  if (!A) return;

  const GAME = "demon-order";
  const TIER_WEIGHT = {
    "Easy Demon": 1,
    "Medium Demon": 2,
    "Hard Demon": 3,
    "Insane Demon": 4,
    "Extreme Demon": 5
  };
  const DEMON_TIERS = ["Extreme Demon", "Insane Demon", "Hard Demon", "Medium Demon", "Easy Demon"];
  const DIFF_MODES = {
    easy: { label: "Easy", items: 5, multiplier: 1 },
    normal: { label: "Normal", items: 6, multiplier: 1.5 },
    hard: { label: "Hard", items: 7, multiplier: 2 }
  };

  const pointerPositions = new Map(A.demonlist.map((entry) => [A.norm(entry.name), entry.position]));
  function rankFor(level) {
    return level.demonPosition || pointerPositions.get(level._name) || null;
  }
  const RANKED_LEVELS = A.levels
    .filter((level) => rankFor(level) != null)
    .sort((a, b) => rankFor(a) - rankFor(b));
  const BY_TIER = new Map(DEMON_TIERS.map((tier) => [tier, A.levels.filter((level) => level.difficulty === tier)]));

  const $ = (sel) => document.querySelector(sel);
  const board = $("#orderBoard");
  const resultEl = $("#orderResult");
  const checkBtn = $("#orderCheck");
  const shuffleBtn = $("#orderShuffle");
  const nextBtn = $("#orderNext");
  const shareBtn = $("#orderShare");
  const newBtn = $("#orderNew");
  const dailyBadge = $("#dailyBadge");

  let mode = "daily";
  let state = "playing";
  let items = [];
  let correct = [];
  let activeSource = "pointercrate";
  let activeDifficulty = "normal";
  let lastResult = null;
  let totalScore = 0;
  let roundNumber = 1;
  let endlessStreak = 0;
  let bestEndlessStreak = 0;
  let focusIndex = null;
  let dragFrom = null;

  let difficultySetting = A.store.get("demon-order.difficulty", "normal");
  if (!DIFF_MODES[difficultySetting]) difficultySetting = "normal";
  let sourceSetting = A.store.get("demon-order.source", "pointercrate");
  if (!["pointercrate", "tiers"].includes(sourceSetting)) sourceSetting = "pointercrate";

  /* ------------------------------------------------------------------ *
   * Round construction
   * ------------------------------------------------------------------ */
  function shuffleDifferent(correctOrder, rnd) {
    const shuffled = A.shuffle(correctOrder, rnd);
    if (shuffled.length > 1 && shuffled.every((level, i) => level.id === correctOrder[i].id)) {
      [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
    }
    return shuffled;
  }

  function makePointercrateRound(count, rnd) {
    const picked = A.pickN(RANKED_LEVELS, Math.min(count, RANKED_LEVELS.length), rnd);
    const correctOrder = picked.slice().sort((a, b) => rankFor(a) - rankFor(b));
    return { items: shuffleDifferent(correctOrder, rnd), correct: correctOrder, source: "pointercrate" };
  }

  function makeTierRound(rnd) {
    const picked = DEMON_TIERS.map((tier) => A.pick(BY_TIER.get(tier) || [], rnd)).filter(Boolean);
    const correctOrder = picked.slice().sort((a, b) => (TIER_WEIGHT[b.difficulty] || 0) - (TIER_WEIGHT[a.difficulty] || 0));
    return { items: shuffleDifferent(correctOrder, rnd), correct: correctOrder, source: "tiers" };
  }

  function makeRound(source, difficulty, rnd = Math.random) {
    if (source === "tiers") return makeTierRound(rnd);
    return makePointercrateRound(DIFF_MODES[difficulty].items, rnd);
  }

  function buildDailyRound() {
    const picked = A.pickN(RANKED_LEVELS, 6, A.rngFor(GAME, "daily-set"));
    const correctOrder = picked.slice().sort((a, b) => rankFor(a) - rankFor(b));
    return { items: shuffleDifferent(correctOrder, A.rngFor(GAME, "daily-order")), correct: correctOrder };
  }

  /* ------------------------------------------------------------------ *
   * Rendering
   * ------------------------------------------------------------------ */
  function sourceLabel(short = false) {
    if (activeSource === "tiers") return short ? "In-game tiers" : "In-game demon tiers";
    return short ? "Pointercrate" : "Pointercrate positions";
  }

  function renderBoard() {
    const locked = state !== "playing";
    board.innerHTML = items.map((level, i) => {
      const checked = locked;
      const ok = checked && level.id === correct[i]?.id;
      const cls = checked ? (ok ? "correct" : "incorrect") : "";
      const meta = checked
        ? `${A.esc(level.creator)} · ${activeSource === "pointercrate" ? `Pointercrate #${rankFor(level)}` : A.esc(level.difficulty)}`
        : `by ${A.esc(level.creator)}`;
      return `<div class="order-item ${cls}" data-index="${i}" tabindex="0" draggable="${!locked}"
        role="listitem" aria-label="${A.esc(level.name)}, position ${i + 1} of ${items.length}.${locked ? "" : " Use the up and down arrow keys to move it."}">
        <span class="order-pos">${i + 1}</span>
        <span class="order-handle" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="order-thumb">${A.thumbHTML(level, { alt: `${level.name} thumbnail`, eager: true, wrapClass: "order-thumb-wrap" })}</span>
        <div class="order-info">
          <p class="order-name">${A.esc(level.name)}</p>
          <p class="order-meta">${meta}</p>
        </div>
        <div class="order-arrows">
          <button class="up" type="button" aria-label="Move ${A.esc(level.name)} up" ${locked || i === 0 ? "disabled" : ""}>${A.icon("chevron")}</button>
          <button class="down" type="button" aria-label="Move ${A.esc(level.name)} down" ${locked || i === items.length - 1 ? "disabled" : ""}>${A.icon("chevron")}</button>
        </div>
      </div>`;
    }).join("");
    A.bindThumbs(board);
    board.setAttribute("role", "list");

    if (focusIndex != null) {
      const target = board.querySelector(`[data-index="${focusIndex}"]`);
      focusIndex = null;
      setTimeout(() => target?.focus(), 0);
    }
  }

  function updateHeader() {
    const count = items.length;
    $("#orderSourceChip").textContent = `Source: ${sourceLabel()}`;
    $("#orderSourceChip").className = `chip ${activeSource === "pointercrate" ? "pink" : "orange"}`;
    $("#orderRoundInfo").textContent = mode === "daily"
      ? `Daily · ${count} levels`
      : mode === "practice"
        ? `Practice · ${count} levels`
        : `Round ${roundNumber} · ${count} levels`;
    $("#orderScoreInfo").textContent = mode === "endless"
      ? `${totalScore} pts · ${endlessStreak} streak`
      : `${lastResult?.points || 0} pts`;

    $("#orderModeNote").textContent = activeSource === "pointercrate"
      ? "Pointercrate positions are exact and unique. Position #1 is the hardest. Scores: 20 × demon tier, plus a 100-point perfect bonus, times the round multiplier."
      : "Official in-game demon tiers: Extreme, Insane, Hard, Medium, Easy. One level per tier, so there are no ties in the ladder.";
  }

  function updateSideStats() {
    const stats = A.getStats(GAME);
    $("#orderSideStats").innerHTML = `
      <div class="side-stat"><b>${A.fmtNum(stats.bestScore || 0)}</b><span>Best score</span></div>
      <div class="side-stat"><b>${stats.completed || 0}</b><span>Perfect ladders</span></div>
      <div class="side-stat"><b>${A.fmtNum(stats.bestEndlessScore || 0)}</b><span>Endless best</span></div>
      <div class="side-stat"><b>${stats.bestEndlessStreak || 0}</b><span>Endless streak</span></div>`;

    const done = A.isDailyDone(GAME);
    dailyBadge.textContent = done ? "Daily complete" : mode === "daily" ? `Daily #${A.dayNumber()}` : mode === "endless" ? "Endless run" : "Practice mode";
    dailyBadge.className = `chip ${done ? "green" : mode === "daily" ? "pink" : "cyan"}`;
  }

  function updateModeUI() {
    document.querySelectorAll("[data-mode]").forEach((tab) => {
      tab.setAttribute("aria-pressed", String(tab.dataset.mode === mode));
    });
  }

  function syncSettings() {
    const daily = mode === "daily";
    document.querySelectorAll("[data-diff]").forEach((button) => {
      const active = button.dataset.diff === (daily ? "normal" : difficultySetting);
      button.setAttribute("aria-pressed", String(active));
      button.disabled = daily;
      button.title = daily ? "Daily uses the Normal multiplier" : `${DIFF_MODES[button.dataset.diff].items} levels · ${DIFF_MODES[button.dataset.diff].multiplier}× points`;
    });
    document.querySelectorAll("[data-source]").forEach((button) => {
      const active = button.dataset.source === (daily ? "pointercrate" : sourceSetting);
      button.setAttribute("aria-pressed", String(active));
      button.disabled = daily;
      button.title = daily ? "Daily always uses Pointercrate positions" : "Choose the ranking source for practice and endless";
    });
  }

  function resetActions() {
    resultEl.hidden = true;
    resultEl.innerHTML = "";
    checkBtn.hidden = false;
    shuffleBtn.hidden = false;
    nextBtn.hidden = true;
    shareBtn.hidden = true;
    newBtn.hidden = false;
    newBtn.textContent = mode === "daily" ? "Play practice" : mode === "endless" ? "Restart endless" : "New round";
  }

  function actionsAfterCheck(result) {
    checkBtn.hidden = true;
    shuffleBtn.hidden = true;
    const endlessNext = mode === "endless" && result.allCorrect;
    nextBtn.hidden = !endlessNext;
    nextBtn.textContent = "Next round";
    shareBtn.hidden = endlessNext;
    newBtn.hidden = false;
    newBtn.textContent = mode === "daily" ? "Play practice" : mode === "endless" ? "Restart endless" : "New round";
  }

  function correctRowHTML(level, i) {
    const meta = activeSource === "pointercrate" ? `Pointercrate #${rankFor(level)}` : level.difficulty;
    return `<div class="order-correct-row">
      <b>${i + 1}</b>
      <span class="mini-thumb">${A.thumbHTML(level, { alt: "", eager: true })}</span>
      <span>${A.esc(level.name)}</span>
      <em>${A.esc(meta)}</em>
    </div>`;
  }

  function showResult(result, opts = {}) {
    const finalRun = !!opts.finalRun;
    const pointsShown = finalRun ? totalScore : result.points;
    const breakdown = result.restored
      ? `${result.correctCount}/${items.length} positions correct · ${result.multiplier}× round`
      : `Base ${result.base} × ${result.multiplier}${result.bonus ? ` + ${result.bonus} perfect bonus` : ""} = ${result.points} pts`;
    resultEl.hidden = false;
    resultEl.innerHTML = `
      <p class="result-kicker" style="color:${result.allCorrect ? "var(--green)" : "var(--pink)"}">${finalRun ? "Endless run over" : result.allCorrect ? "Perfect order" : "Order checked"}</p>
      <div class="order-score">
        <b>${pointsShown} pts</b>
        <span>${result.correctCount}/${items.length} correct · ${result.multiplier}× · ${sourceLabel(true)}</span>
      </div>
      <div class="order-mode-note">
        ${breakdown}${finalRun ? ` · Endless total ${totalScore} pts over ${roundNumber} round${roundNumber === 1 ? "" : "s"}` : ""}
      </div>
      <p class="dist-title" style="margin-top:12px">Correct order — hardest to easiest</p>
      <div class="order-correct">${correct.map((level, i) => correctRowHTML(level, i)).join("")}</div>`;
    A.bindThumbs(resultEl);
  }

  /* ------------------------------------------------------------------ *
   * Gameplay
   * ------------------------------------------------------------------ */
  function saveProgress() {
    if (mode !== "daily" || state !== "playing") return;
    A.saveProgress(GAME, {
      date: A.dateKey(),
      itemIds: correct.map((level) => level.id),
      orderIds: items.map((level) => level.id)
    });
  }

  function moveItem(from, to) {
    if (state !== "playing" || to < 0 || to >= items.length || from === to) return;
    const [moved] = items.splice(from, 1);
    items.splice(to, 0, moved);
    focusIndex = to;
    renderBoard();
    saveProgress();
  }

  function shuffleItems() {
    if (state !== "playing" || items.length < 2) return;
    items = A.shuffle(items);
    focusIndex = 0;
    renderBoard();
    saveProgress();
    A.sfx("tick");
  }

  function scoreRound() {
    const multiplier = DIFF_MODES[activeDifficulty].multiplier;
    let correctCount = 0;
    let base = 0;
    items.forEach((level, i) => {
      if (level.id !== correct[i]?.id) return;
      correctCount += 1;
      base += 20 * (TIER_WEIGHT[level.difficulty] || 1);
    });
    const allCorrect = correctCount === items.length;
    const bonus = allCorrect ? 100 : 0;
    return {
      correctCount,
      allCorrect,
      base,
      bonus,
      multiplier,
      points: Math.round((base + bonus) * multiplier),
      total: items.length
    };
  }

  function updateBestScore(points) {
    const stats = A.getStats(GAME);
    stats.bestScore = Math.max(stats.bestScore || 0, points);
    A.saveStats(GAME, stats);
  }

  function markEndless(finalResult) {
    A.markPractice(GAME, {
      won: bestEndlessStreak > 0,
      score: totalScore,
      rounds: roundNumber,
      streak: bestEndlessStreak
    }, (stats) => {
      stats.bestScore = Math.max(stats.bestScore || 0, totalScore);
      stats.bestEndlessScore = Math.max(stats.bestEndlessScore || 0, totalScore);
      stats.bestEndlessStreak = Math.max(stats.bestEndlessStreak || 0, bestEndlessStreak);
      stats.endlessRuns = (stats.endlessRuns || 0) + 1;
      stats.lastEndless = finalResult.points;
    });
  }

  function checkOrder() {
    if (state !== "playing" || !items.length) return;
    state = "checked";
    const result = scoreRound();
    lastResult = result;
    updateBestScore(result.points);
    renderBoard();

    if (mode === "daily") {
      A.markDaily(GAME, {
        won: result.allCorrect,
        score: result.points,
        correctCount: result.correctCount,
        total: items.length,
        source: activeSource,
        itemIds: correct.map((level) => level.id),
        orderIds: items.map((level) => level.id)
      }, (stats) => {
        stats.bestScore = Math.max(stats.bestScore || 0, result.points);
        stats.totalScore = (stats.totalScore || 0) + result.points;
        stats.completed = (stats.completed || 0) + (result.allCorrect ? 1 : 0);
        stats.dailyHistory = (stats.dailyHistory || []).concat({
          date: A.dateKey(),
          score: result.points,
          correct: result.correctCount
        }).slice(-14);
      });
      A.clearProgress(GAME);
      showResult(result);
      actionsAfterCheck(result);
      if (result.allCorrect) { A.sfx("win"); A.confetti(46); }
      else A.sfx("wrong");
    } else if (mode === "practice") {
      A.markPractice(GAME, { won: result.allCorrect, score: result.points, correctCount: result.correctCount }, (stats) => {
        stats.bestScore = Math.max(stats.bestScore || 0, result.points);
        stats.totalScore = (stats.totalScore || 0) + result.points;
      });
      showResult(result);
      actionsAfterCheck(result);
      A.sfx(result.allCorrect ? "correct" : "wrong");
    } else {
      totalScore += result.points;
      if (result.allCorrect) {
        endlessStreak += 1;
        bestEndlessStreak = Math.max(bestEndlessStreak, endlessStreak);
        state = "checked";
        showResult(result);
        actionsAfterCheck(result);
        A.sfx("correct");
      } else {
        state = "done";
        markEndless(result);
        showResult(result, { finalRun: true });
        actionsAfterCheck(result);
        A.sfx("lose");
      }
    }

    syncSettings();
    updateHeader();
    updateSideStats();
    renderStatsDialog();
  }

  /* ------------------------------------------------------------------ *
   * Mode starts and restore
   * ------------------------------------------------------------------ */
  function startDaily() {
    mode = "daily";
    state = "playing";
    activeSource = "pointercrate";
    activeDifficulty = "normal";
    const round = buildDailyRound();
    items = round.items;
    correct = round.correct;
    lastResult = null;
    totalScore = 0;
    roundNumber = 1;
    endlessStreak = 0;
    bestEndlessStreak = 0;
    resetActions();
    renderBoard();
    syncSettings();
    updateModeUI();
    updateHeader();
    updateSideStats();
    saveProgress();
  }

  function startPractice() {
    mode = "practice";
    state = "playing";
    activeSource = sourceSetting;
    activeDifficulty = difficultySetting;
    const round = makeRound(activeSource, activeDifficulty);
    items = round.items;
    correct = round.correct;
    lastResult = null;
    totalScore = 0;
    roundNumber = 1;
    endlessStreak = 0;
    bestEndlessStreak = 0;
    resetActions();
    renderBoard();
    syncSettings();
    updateModeUI();
    updateHeader();
    updateSideStats();
    A.toast("Practice ladder — no daily stats.");
  }

  function startEndlessRound() {
    state = "playing";
    activeSource = sourceSetting;
    activeDifficulty = difficultySetting;
    const round = makeRound(activeSource, activeDifficulty);
    items = round.items;
    correct = round.correct;
    lastResult = null;
    resetActions();
    renderBoard();
    syncSettings();
    updateModeUI();
    updateHeader();
    updateSideStats();
  }

  function startEndless() {
    mode = "endless";
    totalScore = 0;
    roundNumber = 1;
    endlessStreak = 0;
    bestEndlessStreak = 0;
    startEndlessRound();
    A.toast("Endless run — a perfect ladder keeps it alive.");
  }

  function nextRound() {
    if (mode !== "endless" || state !== "checked" || !lastResult?.allCorrect) return;
    roundNumber += 1;
    startEndlessRound();
  }

  function restoreDaily() {
    mode = "daily";
    activeSource = "pointercrate";
    activeDifficulty = "normal";
    const daily = A.getDaily(GAME);

    if (daily) {
      const setIds = daily.itemIds || daily.orderIds || [];
      const orderIds = daily.orderIds || setIds;
      let set = setIds.map((id) => A.byId.get(String(id))).filter(Boolean);
      let ordered = orderIds.map((id) => A.byId.get(String(id))).filter(Boolean);
      if (!set.length || !ordered.length || set.length !== ordered.length) {
        const fallback = buildDailyRound();
        set = fallback.correct;
        ordered = fallback.items;
      }
      correct = set.slice().sort((a, b) => rankFor(a) - rankFor(b));
      items = ordered;
      state = "checked";
      lastResult = {
        points: daily.score || 0,
        correctCount: daily.correctCount ?? 0,
        allCorrect: !!daily.won,
        base: 0,
        bonus: 0,
        multiplier: DIFF_MODES.normal.multiplier,
        total: items.length,
        restored: true
      };
      resetActions();
      renderBoard();
      showResult(lastResult);
      actionsAfterCheck(lastResult);
      syncSettings();
      updateModeUI();
      updateHeader();
      updateSideStats();
      return;
    }

    const progress = A.getProgress(GAME);
    if (progress && progress.date === A.dateKey()) {
      const setIds = progress.itemIds || [];
      const orderIds = progress.orderIds || setIds;
      let set = setIds.map((id) => A.byId.get(String(id))).filter(Boolean);
      let ordered = orderIds.map((id) => A.byId.get(String(id))).filter(Boolean);
      if (!set.length || !ordered.length || set.length !== ordered.length) {
        const fallback = buildDailyRound();
        set = fallback.correct;
        ordered = fallback.items;
      }
      correct = set.slice().sort((a, b) => rankFor(a) - rankFor(b));
      items = ordered;
      state = "playing";
      lastResult = null;
      resetActions();
      renderBoard();
      syncSettings();
      updateModeUI();
      updateHeader();
      updateSideStats();
      return;
    }

    startDaily();
  }

  /* ------------------------------------------------------------------ *
   * Stats & sharing
   * ------------------------------------------------------------------ */
  function renderStatsDialog() {
    const stats = A.getStats(GAME);
    $("#statPlayed").textContent = stats.played || 0;
    $("#statWin").textContent = `${stats.played ? Math.round((stats.wins / stats.played) * 100) : 0}%`;
    $("#statBestScore").textContent = A.fmtNum(stats.bestScore || 0);
    $("#statCompleted").textContent = stats.completed || 0;

    const recent = (stats.dailyHistory || []).slice(-10);
    const max = Math.max(1, ...recent.map((entry) => Number(entry.score) || 0));
    $("#orderHistory").innerHTML = recent.length
      ? recent.map((entry) => `<div class="dist-row ${entry.date === A.dateKey() ? "today" : ""}">
        <span>${entry.correct ?? "?"}</span>
        <div class="dist-bar"><div class="dist-fill" style="width:${Math.max(6, (entry.score / max) * 100)}%">${A.fmtNum(entry.score)} pts</div></div>
      </div>`).join("")
      : `<p class="tiny-note">No daily ladders yet. Check today’s six-demon order to start the history.</p>`;
  }

  function shareResult() {
    if (!lastResult) return;
    const title = mode === "daily"
      ? `GD Arcade · Demon Order #${A.dayNumber()}`
      : mode === "endless"
        ? "GD Arcade · Demon Order Endless"
        : "GD Arcade · Demon Order Practice";
    const grid = items.map((level, i) => (level.id === correct[i]?.id ? "🟩" : "🟥")).join("");
    const line = mode === "endless"
      ? `${totalScore} pts · ${roundNumber} round${roundNumber === 1 ? "" : "s"} · best streak ${bestEndlessStreak}`
      : `${lastResult.correctCount}/${items.length} correct · ${lastResult.points} pts`;
    A.shareText(`${title}\n${line}\n${grid}\nSource: ${sourceLabel(true)}\n${location.origin}${location.pathname}`);
  }

  /* ------------------------------------------------------------------ *
   * Events
   * ------------------------------------------------------------------ */
  board.addEventListener("click", (event) => {
    const button = event.target.closest(".order-arrows button");
    if (!button) return;
    const item = button.closest(".order-item");
    if (!item) return;
    const index = Number(item.dataset.index);
    moveItem(index, button.classList.contains("up") ? index - 1 : index + 1);
  });

  board.addEventListener("keydown", (event) => {
    if (event.target.closest("button")) return;
    const item = event.target.closest(".order-item");
    if (!item) return;
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    const index = Number(item.dataset.index);
    moveItem(index, index + (event.key === "ArrowUp" ? -1 : 1));
  });

  board.addEventListener("dragstart", (event) => {
    const item = event.target.closest(".order-item");
    if (!item || state !== "playing") { event.preventDefault(); return; }
    dragFrom = Number(item.dataset.index);
    item.classList.add("dragging");
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(dragFrom));
    }
  });
  board.addEventListener("dragover", (event) => {
    const item = event.target.closest(".order-item");
    if (!item || dragFrom == null) return;
    event.preventDefault();
    item.classList.add("drag-over");
  });
  board.addEventListener("dragleave", (event) => {
    event.target.closest(".order-item")?.classList.remove("drag-over");
  });
  board.addEventListener("drop", (event) => {
    const item = event.target.closest(".order-item");
    if (!item || dragFrom == null) return;
    event.preventDefault();
    moveItem(dragFrom, Number(item.dataset.index));
  });
  board.addEventListener("dragend", () => {
    dragFrom = null;
    board.querySelectorAll(".dragging, .drag-over").forEach((el) => el.classList.remove("dragging", "drag-over"));
  });

  checkBtn.addEventListener("click", checkOrder);
  shuffleBtn.addEventListener("click", shuffleItems);
  nextBtn.addEventListener("click", nextRound);
  shareBtn.addEventListener("click", shareResult);
  newBtn.addEventListener("click", () => {
    if (mode === "endless") startEndless();
    else startPractice();
  });

  document.querySelectorAll("[data-mode]").forEach((tab) => {
    tab.addEventListener("click", () => {
      if (tab.dataset.mode === "daily") restoreDaily();
      else if (tab.dataset.mode === "practice") startPractice();
      else startEndless();
    });
  });

  document.querySelectorAll("[data-diff]").forEach((button) => {
    button.addEventListener("click", () => {
      if (mode === "daily" || button.dataset.diff === difficultySetting) return;
      difficultySetting = button.dataset.diff;
      A.store.set("demon-order.difficulty", difficultySetting);
      if (mode === "endless") startEndless();
      else startPractice();
    });
  });

  document.querySelectorAll("[data-source]").forEach((button) => {
    button.addEventListener("click", () => {
      if (mode === "daily" || button.dataset.source === sourceSetting) return;
      sourceSetting = button.dataset.source;
      A.store.set("demon-order.source", sourceSetting);
      if (mode === "endless") startEndless();
      else startPractice();
    });
  });

  document.querySelectorAll("[data-open-game-stats]").forEach((button) => {
    button.addEventListener("click", () => {
      renderStatsDialog();
      const dialog = $("#gameStatsDialog");
      if (dialog && !dialog.open) dialog.showModal();
    });
  });

  $("#resetOrder").addEventListener("click", async () => {
    const ok = await A.confirmDialog({
      title: "Reset Demon Order stats?",
      message: "This deletes Demon Order's daily stats, score history, perfect ladders and endless records. Other games are not affected.",
      confirmText: "Reset Demon Order",
      danger: true
    });
    if (!ok) return;
    A.resetGame(GAME);
    location.reload();
  });

  document.querySelectorAll("[data-icon]").forEach((el) => { el.innerHTML = A.icon(el.dataset.icon); });

  A.setupPage({ game: GAME });
  restoreDaily();
  renderStatsDialog();
})();
