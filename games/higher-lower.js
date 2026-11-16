/* GD Arcade — Higher / Lower (Game 4) */
(() => {
  "use strict";
  const A = window.GDArcade;
  if (!A) return;

  const GAME = "higher-lower";
  const DAILY_ROUNDS = 10;
  const DAILY_TARGET = 8;
  const CAT_KEYS = ["downloads", "likes", "stars", "demon"];

  const CATS = {
    downloads: {
      label: "Downloads", source: "GDBrowser",
      value: (l) => l.downloads, metric: (l) => l.downloads,
      format: (v) => A.fmtNum(v),
      sub: (l) => `${A.fmtFull(l.downloads)} downloads`,
      choiceHigh: "Higher", choiceLow: "Lower"
    },
    likes: {
      label: "Likes", source: "GDBrowser",
      value: (l) => l.likes, metric: (l) => l.likes,
      format: (v) => A.fmtNum(v),
      sub: (l) => `${A.fmtFull(l.likes)} likes`,
      choiceHigh: "Higher", choiceLow: "Lower"
    },
    stars: {
      label: "Stars", source: "GDBrowser",
      value: (l) => l.stars, metric: (l) => l.stars,
      format: (v) => `${v}★`,
      sub: (l) => `${l.stars} star${l.stars === 1 ? "" : "s"}`,
      choiceHigh: "Higher", choiceLow: "Lower"
    },
    demon: {
      label: "Demonlist position", source: "Pointercrate",
      value: (l) => l.demonPosition,
      metric: (l) => (l.demonPosition ? -l.demonPosition : null),
      format: (v) => (v == null ? "Unranked" : `#${v}`),
      sub: (l) => (l.demonPosition ? `Pointercrate #${l.demonPosition}` : "Not on the Demonlist"),
      choiceHigh: "Better rank", choiceLow: "Worse rank"
    }
  };

  const $ = (sel) => document.querySelector(sel);
  const dailyBadge = $("#dailyBadge");
  const leftCard = $("#hlLeftCard");
  const rightCard = $("#hlRightCard");
  const feedback = $("#hlFeedback");
  const nextBtn = $("#hlNext");
  const shareBtn = $("#hlShare");
  const newBtn = $("#hlNew");
  const resultEl = $("#hlResult");
  const questionEl = $("#hlQuestion");
  const choicesEl = $("#hlChoices");
  const arenaEl = $("#hlArena");

  let mode = "daily";
  let status = "playing";
  let round = null;
  let dailyRounds = [];
  let roundIndex = 0;
  let answered = false;
  let chosen = null;
  let score = 0;
  let runStreak = 0;
  let runBest = 0;
  let history = [];
  let practiceCategory = A.store.get("higher-lower.category", "mixed");
  if (practiceCategory !== "mixed" && !CATS[practiceCategory]) practiceCategory = "mixed";

  /* ------------------------------------------------------------------ *
   * Round construction
   * ------------------------------------------------------------------ */
  function dailyCategories() {
    const bag = A.shuffle([...CAT_KEYS, ...CAT_KEYS, ...CAT_KEYS], A.rngFor(GAME, "categories"));
    return bag.slice(0, DAILY_ROUNDS);
  }

  function buildDailyRounds() {
    const categories = dailyCategories();
    return categories.map((cat, i) => {
      const rnd = A.rngFor(GAME, `round-${i}`);
      const pool = cat === "demon" ? A.rankedDemons : (A.dailyPool.length ? A.dailyPool : A.levels);
      const pair = A.pickN(pool, 2, rnd);
      return { cat, left: pair[0], right: pair[1] };
    }).filter((r) => r.left && r.right);
  }

  function makePracticeRound() {
    const cat = practiceCategory === "mixed" ? A.pick(CAT_KEYS) : practiceCategory;
    const pool = cat === "demon" ? A.rankedDemons : (A.dailyPool.length ? A.dailyPool : A.levels);
    let left = null;
    let right = null;
    for (let guard = 0; guard < 14; guard++) {
      const pair = A.pickN(pool, 2);
      left = pair[0];
      right = pair[1];
      if (!left || !right || left.id === right.id) continue;
      if (round && left.id === round.left.id && right.id === round.right.id) continue;
      break;
    }
    if (!left || !right) {
      const pair = A.pickN(A.levels, 2);
      left = pair[0];
      right = pair[1];
      return { cat: "downloads", left, right };
    }
    return { cat, left, right };
  }

  function correctChoice() {
    if (!round) return "tie";
    const cfg = CATS[round.cat];
    const left = cfg.metric(round.left);
    const right = cfg.metric(round.right);
    if (left == null || right == null) return "tie";
    if (right > left) return "higher";
    if (right < left) return "lower";
    return "tie";
  }

  /* ------------------------------------------------------------------ *
   * Rendering
   * ------------------------------------------------------------------ */
  function renderThumbs() {
    $("#hlLeftThumb").innerHTML = round ? A.thumbHTML(round.left, { alt: `${round.left.name} thumbnail`, eager: true }) : "";
    $("#hlRightThumb").innerHTML = round ? A.thumbHTML(round.right, { alt: `${round.right.name} thumbnail`, eager: true }) : "";
    A.bindThumbs($("#hlLeftThumb"));
    A.bindThumbs($("#hlRightThumb"));
  }

  function updateProgress() {
    const roundEl = $("#hlRound");
    const fill = $("#hlProgressFill");
    const scoreEl = $("#hlScore");

    if (status === "done" && mode === "daily") {
      roundEl.textContent = "Daily complete";
      fill.style.width = "100%";
      scoreEl.textContent = `${score}/${DAILY_ROUNDS} correct`;
      return;
    }
    if (status === "done" && mode === "practice") {
      roundEl.textContent = "Run over";
      fill.style.width = `${Math.min(100, score * 10)}%`;
      scoreEl.textContent = `${score} correct`;
      return;
    }

    const completed = Math.min(DAILY_ROUNDS, roundIndex + (answered ? 1 : 0));
    roundEl.textContent = mode === "daily" ? `Round ${Math.min(DAILY_ROUNDS, roundIndex + 1)} / ${DAILY_ROUNDS}` : `Round ${roundIndex + 1}`;
    fill.style.width = mode === "daily" ? `${(completed / DAILY_ROUNDS) * 100}%` : `${Math.min(100, score * 10)}%`;
    scoreEl.textContent = mode === "daily" ? `${score} correct` : `${score} correct · ${runStreak} streak`;
  }

  function syncCategoryButtons() {
    document.querySelectorAll("[data-cat]").forEach((button) => {
      const active = mode === "daily" ? button.dataset.cat === "mixed" : button.dataset.cat === practiceCategory;
      button.setAttribute("aria-pressed", String(active));
      button.disabled = mode === "daily";
    });
    $("#hlCatNote").textContent = mode === "daily"
      ? "Daily mix · fixed"
      : practiceCategory === "mixed"
        ? "Practice · mixed stats"
        : `Practice · ${CATS[practiceCategory].label}`;
  }

  function updateModeUI() {
    document.querySelectorAll("[data-mode]").forEach((tab) => {
      tab.setAttribute("aria-pressed", String(tab.dataset.mode === mode));
    });
  }

  function updateSideStats() {
    const stats = A.getStats(GAME);
    $("#hlSideStats").innerHTML = `
      <div class="side-stat"><b>${stats.bestRun || 0}</b><span>Best run</span></div>
      <div class="side-stat"><b>${stats.bestStreak || 0}</b><span>Best streak</span></div>
      <div class="side-stat"><b>${A.fmtNum(stats.totalCorrect || 0)}</b><span>Correct</span></div>
      <div class="side-stat"><b>${stats.streak || 0}</b><span>Daily streak</span></div>`;

    const done = A.isDailyDone(GAME);
    dailyBadge.textContent = done ? "Daily complete" : mode === "daily" ? `Daily #${A.dayNumber()}` : "Practice mode";
    dailyBadge.className = `chip ${done ? "green" : mode === "daily" ? "orange" : "cyan"}`;
  }

  function renderRound() {
    if (!round) return;
    const cfg = CATS[round.cat];
    arenaEl.hidden = false;
    questionEl.hidden = false;
    choicesEl.hidden = false;
    feedback.hidden = true;
    feedback.innerHTML = "";
    resultEl.hidden = true;
    resultEl.innerHTML = "";
    shareBtn.hidden = true;
    nextBtn.hidden = true;
    newBtn.textContent = mode === "daily" ? "Play practice" : "New run";

    renderThumbs();
    $("#hlLeftName").textContent = round.left.name;
    $("#hlLeftCreator").textContent = `by ${round.left.creator}`;
    $("#hlRightName").textContent = round.right.name;
    $("#hlRightCreator").textContent = `by ${round.right.creator}`;
    $("#hlStatLabel").textContent = cfg.label;
    $("#hlStatLabelRight").textContent = cfg.label;
    $("#hlLeftValue").textContent = cfg.format(cfg.value(round.left));
    $("#hlLeftValue").title = cfg.sub(round.left);
    $("#hlLeftSub").textContent = cfg.sub(round.left);
    $("#hlRightValue").textContent = "?";
    $("#hlRightValue").classList.add("hidden-val");
    $("#hlRightSub").textContent = "Hidden until you answer";

    leftCard.classList.remove("winner", "loser", "tie");
    rightCard.classList.remove("winner", "loser", "tie");
    document.querySelectorAll("[data-choice]").forEach((button) => {
      button.disabled = false;
      button.classList.remove("correct", "wrong");
    });
    $("#hlHigherLabel").textContent = cfg.choiceHigh;
    $("#hlLowerLabel").textContent = cfg.choiceLow;
    $("#hlTieLabel").textContent = "Tie";
    questionEl.innerHTML = round.cat === "demon"
      ? "On the <b>Pointercrate Demonlist</b>, is the right level ranked better, worse, or tied with the left level?"
      : `Is the right level's <b>${A.esc(cfg.label)}</b> higher, lower, or tied with the left level?`;

    updateProgress();
    syncCategoryButtons();
    updateSideStats();
  }

  function revealRound(choice) {
    if (!round) return;
    const cfg = CATS[round.cat];
    const actual = correctChoice();
    const correct = choice === actual;
    const leftText = cfg.format(cfg.value(round.left));
    const rightText = cfg.format(cfg.value(round.right));

    $("#hlRightValue").textContent = rightText;
    $("#hlRightValue").title = cfg.sub(round.right);
    $("#hlRightValue").classList.remove("hidden-val");
    $("#hlRightSub").textContent = cfg.sub(round.right);

    leftCard.classList.remove("winner", "loser", "tie");
    rightCard.classList.remove("winner", "loser", "tie");
    if (actual === "higher") {
      rightCard.classList.add("winner");
      leftCard.classList.add("loser");
    } else if (actual === "lower") {
      leftCard.classList.add("winner");
      rightCard.classList.add("loser");
    } else {
      leftCard.classList.add("tie");
      rightCard.classList.add("tie");
    }

    document.querySelectorAll("[data-choice]").forEach((button) => {
      button.disabled = true;
      button.classList.remove("correct", "wrong");
      if (button.dataset.choice === actual) button.classList.add("correct");
      if (button.dataset.choice === choice && choice !== actual) button.classList.add("wrong");
    });

    feedback.hidden = false;
    feedback.className = `hl-feedback ${correct ? "good" : actual === "tie" ? "tie" : "bad"}`;
    if (actual === "tie") {
      feedback.innerHTML = correct
        ? `Dead level — both values are <b>${A.esc(leftText)}</b>. Ties are real answers.`
        : `Dead level — both values are <b>${A.esc(leftText)}</b>. The correct answer was Tie.`;
    } else if (correct) {
      feedback.innerHTML = `Correct — the right level was <b>${A.esc(rightText)}</b> versus <b>${A.esc(leftText)}</b> on the left.`;
    } else {
      feedback.innerHTML = `Not quite — the right level was <b>${A.esc(rightText)}</b> versus <b>${A.esc(leftText)}</b> on the left.`;
    }
    updateProgress();
  }

  function resultMarkup(won, kind) {
    const kicker = kind === "daily" ? (won ? "Daily cleared" : "Daily run complete") : "Practice run over";
    const title = kind === "daily" ? `${score}/${DAILY_ROUNDS} correct` : `${score} correct in a row`;
    const meta = kind === "daily"
      ? `Target ${DAILY_TARGET}/${DAILY_ROUNDS} · best streak this run ${runBest}`
      : `Best streak this run ${runBest} · practice does not change daily stats`;
    return `<div class="result-card ${won ? "won" : "lost"}">
      <div class="result-body">
        <p class="result-kicker">${kicker}</p>
        <h3 class="result-name">${title}</h3>
        <p class="result-meta">${meta}</p>
        <div class="result-actions">
          <span class="tag">${kind === "daily" ? "Daily" : "Practice"}</span>
          <span class="tag">${A.getStats(GAME).bestStreak || 0} best streak</span>
          <span class="tag">${A.getStats(GAME).totalCorrect || 0} lifetime correct</span>
        </div>
      </div>
    </div>`;
  }

  function showFinal(won, kind) {
    questionEl.hidden = true;
    choicesEl.hidden = true;
    nextBtn.hidden = true;
    resultEl.hidden = false;
    resultEl.innerHTML = resultMarkup(won, kind);
    shareBtn.hidden = false;
    newBtn.textContent = kind === "daily" ? "Play practice" : "New run";
    updateProgress();
    syncCategoryButtons();
    updateSideStats();
    renderStatsDialog();
  }

  function resetFinalUI() {
    arenaEl.hidden = false;
    questionEl.hidden = false;
    choicesEl.hidden = false;
    feedback.hidden = true;
    feedback.innerHTML = "";
    resultEl.hidden = true;
    resultEl.innerHTML = "";
    shareBtn.hidden = true;
    nextBtn.hidden = true;
    newBtn.textContent = mode === "daily" ? "Play practice" : "New run";
  }

  function showNext() {
    nextBtn.hidden = false;
    nextBtn.textContent = mode === "daily" && roundIndex >= DAILY_ROUNDS - 1 ? "See results" : "Next comparison";
  }

  /* ------------------------------------------------------------------ *
   * Run lifecycle
   * ------------------------------------------------------------------ */
  function startDaily() {
    mode = "daily";
    status = "playing";
    dailyRounds = buildDailyRounds();
    roundIndex = 0;
    round = dailyRounds[0];
    answered = false;
    chosen = null;
    score = 0;
    runStreak = 0;
    runBest = 0;
    history = [];
    resetFinalUI();
    renderRound();
    updateModeUI();
    saveProgress();
  }

  function newPractice() {
    mode = "practice";
    status = "playing";
    roundIndex = 0;
    round = makePracticeRound();
    answered = false;
    chosen = null;
    score = 0;
    runStreak = 0;
    runBest = 0;
    history = [];
    resetFinalUI();
    renderRound();
    updateModeUI();
    A.toast("Practice run — it ends on your first miss.");
  }

  function saveProgress() {
    if (mode !== "daily" || status !== "playing") return;
    A.saveProgress(GAME, {
      date: A.dateKey(),
      roundIndex,
      score,
      streak: runStreak,
      best: runBest,
      history,
      answered,
      chosen
    });
  }

  function recordCorrect() {
    const stats = A.getStats(GAME);
    stats.totalCorrect = (stats.totalCorrect || 0) + 1;
    stats.bestStreak = Math.max(stats.bestStreak || 0, runStreak);
    A.saveStats(GAME, stats);
  }

  function answer(choice) {
    if (status !== "playing" || answered || !round) return;
    const actual = correctChoice();
    const correct = choice === actual;
    chosen = choice;
    answered = true;
    history.push({ cat: round.cat, choice, actual, correct });

    if (correct) {
      score += 1;
      runStreak += 1;
      runBest = Math.max(runBest, runStreak);
      recordCorrect();
      A.sfx("correct");
    } else {
      runStreak = 0;
      A.sfx("wrong");
    }

    revealRound(choice);
    A.bindThumbs(resultEl);

    if (mode === "daily") {
      if (roundIndex >= DAILY_ROUNDS - 1) {
        endDaily();
      } else {
        saveProgress();
        showNext();
      }
    } else if (!correct) {
      endPractice();
    } else {
      showNext();
    }
    updateSideStats();
  }

  function endDaily() {
    if (status === "done") return;
    status = "done";
    const won = score >= DAILY_TARGET;
    A.markDaily(GAME, {
      won,
      score,
      rounds: DAILY_ROUNDS,
      bestRun: runBest,
      history: history.map((entry) => ({ cat: entry.cat, choice: entry.choice, actual: entry.actual, correct: entry.correct }))
    }, (stats) => {
      stats.bestRun = Math.max(stats.bestRun || 0, score);
      stats.roundsPlayed = (stats.roundsPlayed || 0) + 1;
      stats.dailyHistory = (stats.dailyHistory || []).concat({ date: A.dateKey(), score }).slice(-14);
    });
    A.clearProgress(GAME);
    showFinal(won, "daily");
    if (won) { A.sfx("win"); A.confetti(46); }
    else A.sfx("lose");
  }

  function endPractice() {
    if (status === "done") return;
    status = "done";
    A.markPractice(GAME, { won: score > 0, score, best: runBest }, (stats) => {
      stats.bestRun = Math.max(stats.bestRun || 0, score);
      stats.roundsPlayed = (stats.roundsPlayed || 0) + 1;
    });
    showFinal(score > 0, "practice");
  }

  function nextRound() {
    if (status !== "playing" || !answered) return;
    if (mode === "daily" && roundIndex >= DAILY_ROUNDS - 1) {
      endDaily();
      return;
    }
    roundIndex += 1;
    answered = false;
    chosen = null;
    round = mode === "daily" ? dailyRounds[roundIndex] : makePracticeRound();
    resetFinalUI();
    renderRound();
    if (mode === "daily") saveProgress();
  }

  /* ------------------------------------------------------------------ *
   * Restore
   * ------------------------------------------------------------------ */
  function restoreDaily() {
    mode = "daily";
    dailyRounds = buildDailyRounds();
    const daily = A.getDaily(GAME);

    if (daily) {
      status = "done";
      roundIndex = DAILY_ROUNDS - 1;
      round = dailyRounds[roundIndex];
      score = daily.score || 0;
      runBest = daily.bestRun || 0;
      history = daily.history || [];
      answered = true;
      chosen = history[history.length - 1]?.choice || null;
      renderRound();
      revealRound(chosen || correctChoice());
      showFinal(!!daily.won, "daily");
      updateModeUI();
      return;
    }

    const progress = A.getProgress(GAME);
    if (progress && progress.date === A.dateKey() && dailyRounds.length) {
      status = "playing";
      roundIndex = A.clamp(progress.roundIndex || 0, 0, dailyRounds.length - 1);
      round = dailyRounds[roundIndex];
      score = progress.score || 0;
      runStreak = progress.streak || 0;
      runBest = progress.best || 0;
      history = progress.history || [];
      answered = !!progress.answered;
      chosen = progress.chosen || null;
      resetFinalUI();
      renderRound();
      if (answered) {
        revealRound(chosen || correctChoice());
        showNext();
      }
      updateModeUI();
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
    $("#statBestRun").textContent = stats.bestRun || 0;
    $("#statBestStreak").textContent = stats.bestStreak || 0;

    const recent = (stats.dailyHistory || []).slice(-10);
    $("#hlHistory").innerHTML = recent.length
      ? recent.map((entry) => {
        const width = Math.max(6, entry.score * 10);
        return `<div class="dist-row ${entry.date === A.dateKey() ? "today" : ""}">
          <span>${entry.score}</span>
          <div class="dist-bar"><div class="dist-fill" style="width:${width}%">${entry.score}/${DAILY_ROUNDS}</div></div>
        </div>`;
      }).join("")
      : `<p class="tiny-note">No daily runs yet. Finish today’s ten comparisons to start the history.</p>`;
  }

  function shareResult() {
    const title = mode === "daily" ? `GD Arcade · Higher / Lower #${A.dayNumber()}` : "GD Arcade · Higher / Lower Practice";
    const scoreLine = mode === "daily" ? `${score}/${DAILY_ROUNDS} correct` : `${score} correct streak`;
    const grid = history.map((entry) => (entry.correct ? "🟩" : "🟥")).join("");
    A.shareText(`${title}\n${scoreLine} · best streak ${runBest}\n${grid}${status === "playing" ? "" : ""}\n${location.origin}${location.pathname}`);
  }

  /* ------------------------------------------------------------------ *
   * Events
   * ------------------------------------------------------------------ */
  document.querySelectorAll("[data-choice]").forEach((button) => {
    button.addEventListener("click", () => answer(button.dataset.choice));
  });
  nextBtn.addEventListener("click", nextRound);
  shareBtn.addEventListener("click", shareResult);
  newBtn.addEventListener("click", newPractice);

  document.querySelectorAll("[data-mode]").forEach((tab) => {
    tab.addEventListener("click", () => {
      if (tab.dataset.mode === "daily") restoreDaily();
      else newPractice();
    });
  });

  document.querySelectorAll("[data-cat]").forEach((button) => {
    button.addEventListener("click", () => {
      if (mode === "daily" || button.dataset.cat === practiceCategory) return;
      practiceCategory = button.dataset.cat;
      A.store.set("higher-lower.category", practiceCategory);
      newPractice();
    });
  });

  document.querySelectorAll("[data-open-game-stats]").forEach((button) => {
    button.addEventListener("click", () => {
      renderStatsDialog();
      const dialog = $("#gameStatsDialog");
      if (dialog && !dialog.open) dialog.showModal();
    });
  });

  $("#resetHL").addEventListener("click", async () => {
    const ok = await A.confirmDialog({
      title: "Reset Higher / Lower stats?",
      message: "This deletes Higher / Lower's daily runs, best run, best streak and today's completion. Other games are not affected.",
      confirmText: "Reset Higher / Lower",
      danger: true
    });
    if (!ok) return;
    A.resetGame(GAME);
    location.reload();
  });

  A.setupPage({ game: GAME });
  restoreDaily();
  renderStatsDialog();
})();
