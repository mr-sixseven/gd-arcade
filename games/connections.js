/* GD Arcade — Connections (Game 2) */
(() => {
  "use strict";
  const A = window.GDArcade;
  if (!A) return;

  const GAME = "connections";
  const TIERS = { 1: "#f6c945", 2: "#35dd82", 3: "#3ce0ff", 4: "#a77bff" };
  const TIER_EMOJI = { 1: "🟨", 2: "🟩", 3: "🟦", 4: "🟪" };
  const MAX_MISTAKES = 4;

  let mode = "daily";
  let groups = [];
  let board = [];
  let remaining = [];
  let solved = [];
  let selected = [];
  let mistakes = 0;
  let status = "playing";
  let initialBoardIds = [];

  const $ = (sel) => document.querySelector(sel);

  function compatible(a, b) {
    return !(a.excludes || []).includes(b.id) && !(b.excludes || []).includes(a.id);
  }

  function pickGroups(rnd) {
    for (let attempt = 0; attempt < 240; attempt++) {
      const shuffled = A.shuffle(A.connectionsGroups, rnd);
      const picked = [];
      for (const g of shuffled) {
        if (picked.length === 4) break;
        if (picked.every((p) => compatible(p, g) && !p.levels.some((l) => g.levels.some((x) => x.id === l.id)))) picked.push(g);
      }
      if (picked.length === 4) return picked;
    }
    return A.connectionsGroups.slice(0, 4);
  }

  function makeDailyGroups() {
    const rnd = A.rngFor(GAME, "groups");
    return pickGroups(rnd);
  }

  function makeBoard(gs, rnd) {
    return A.shuffle(gs.flatMap((g) => g.levels), rnd);
  }

  function newPuzzle(isDaily) {
    const rnd = isDaily ? A.rngFor(GAME, "board") : Math.random;
    groups = isDaily ? makeDailyGroups() : pickGroups(Math.random);
    board = makeBoard(groups, rnd);
    remaining = board.slice();
    initialBoardIds = board.map((l) => l.id);
    solved = [];
    selected = [];
    mistakes = 0;
    status = "playing";
    $("#connResult").hidden = true;
    $("#connResult").innerHTML = "";
    renderAll();
    if (!isDaily) A.toast("Practice board — no stats pressure.");
  }

  function parsePuzzleFromSaved(saved) {
    const ids = saved.groupIds || [];
    groups = ids.map((id) => A.connectionsGroups.find((g) => g.id === id)).filter(Boolean);
    if (groups.length !== 4) return false;
    const boardIds = saved.boardIds || groups.flatMap((g) => g.levels.map((l) => l.id));
    board = boardIds.map((id) => A.byId.get(String(id))).filter(Boolean);
    if (board.length !== 16) return false;
    initialBoardIds = board.map((l) => l.id);
    solved = (saved.solved || []).filter((id) => groups.some((g) => g.id === id));
    remaining = (saved.order || board.map((l) => l.id)).map((id) => A.byId.get(String(id))).filter(Boolean);
    // Remove solved levels defensively.
    const solvedIds = new Set(groups.filter((g) => solved.includes(g.id)).flatMap((g) => g.levels.map((l) => l.id)));
    remaining = remaining.filter((l) => !solvedIds.has(l.id));
    mistakes = saved.mistakes || 0;
    status = saved.status || "playing";
    selected = [];
    return true;
  }

  function saveProgress() {
    if (mode !== "daily" || status !== "playing") return;
    A.saveProgress(GAME, {
      date: A.dateKey(),
      groupIds: groups.map((g) => g.id),
      boardIds: initialBoardIds,
      order: remaining.map((l) => l.id),
      solved,
      mistakes,
      status
    });
  }

  function solvedGroupHTML(g) {
    const tier = g.tier || 1;
    const color = TIERS[tier];
    return `<div class="conn-group" style="--tier-color:${color}">
      <div class="conn-group-head">
        <span class="conn-group-label">${A.esc(g.label)}</span>
        <span class="conn-tier" title="Category tier ${tier}">${[1, 2, 3, 4].map((n) => `<i class="${n <= tier ? "on" : ""}"></i>`).join("")}</span>
      </div>
      <div class="conn-group-levels">${g.levels.map((l) => `<span>${A.esc(l.name)}</span>`).join("")}</div>
    </div>`;
  }

  function renderSolved() {
    const container = $("#solvedGroups");
    container.innerHTML = solved.map((id) => groups.find((g) => g.id === id)).filter(Boolean).map(solvedGroupHTML).join("");
    $("#roundChip").textContent = `${4 - solved.length} group${4 - solved.length === 1 ? "" : "s"} left`;
  }

  function renderBoard() {
    const host = $("#connBoard");
    host.innerHTML = remaining.map((l) => `<button type="button" class="conn-tile ${selected.includes(l.id) ? "selected" : ""}" data-id="${A.esc(l.id)}" aria-pressed="${selected.includes(l.id)}"><span class="tile-level-name">${A.esc(l.name)}</span></button>`).join("");
    host.querySelectorAll(".conn-tile").forEach((b) => b.addEventListener("click", () => toggleSelect(b.dataset.id)));
  }

  function renderSelection() {
    const n = selected.length;
    $("#btnSubmit").disabled = n !== 4 || status !== "playing";
    $("#btnClear").disabled = n === 0 || status !== "playing";
    $("#selectionNote").textContent = n === 0 ? "Select four levels" : n === 4 ? "Ready to submit" : `${n}/4 selected`;
    $("#btnSubmit").textContent = n === 4 ? "Submit group" : `Submit group (${n}/4)`;
  }

  function renderMistakes() {
    $("#mistakeDots").innerHTML = Array.from({ length: MAX_MISTAKES }, (_, i) => `<span class="${i < mistakes ? "lost" : ""}"></span>`).join("");
    $("#mistakeDots").setAttribute("aria-label", `${MAX_MISTAKES - mistakes} mistakes remaining`);
  }

  function renderAll() {
    renderSolved();
    renderBoard();
    renderSelection();
    renderMistakes();
    updateSideStats();
    $("#dailyBadge").textContent = A.isDailyDone(GAME) ? "Daily complete" : mode === "daily" ? `Daily #${A.dayNumber()}` : "Practice mode";
    $("#dailyBadge").className = `chip ${A.isDailyDone(GAME) ? "green" : mode === "daily" ? "green" : ""}`;
    document.querySelectorAll("[data-mode]").forEach((t) => t.setAttribute("aria-pressed", String(t.dataset.mode === mode)));
  }

  function toggleSelect(id) {
    if (status !== "playing") return;
    if (selected.includes(id)) selected = selected.filter((x) => x !== id);
    else if (selected.length >= 4) { A.toast("Four levels only — deselect one first"); return; }
    else selected.push(id);
    renderBoard();
    renderSelection();
    A.sfx("tick");
  }

  function shuffleRemaining() {
    remaining = A.shuffle(remaining);
    selected = [];
    renderBoard();
    renderSelection();
    saveProgress();
  }

  function submit() {
    if (status !== "playing" || selected.length !== 4) return;
    const chosen = new Set(selected);
    const hit = groups.find((g) => !solved.includes(g.id) && g.levels.length === 4 && g.levels.every((l) => chosen.has(l.id)));
    if (hit) {
      solved.push(hit.id);
      const ids = new Set(hit.levels.map((l) => l.id));
      remaining = remaining.filter((l) => !ids.has(l.id));
      selected = [];
      renderAll();
      A.sfx("correct");
      A.toast(`Correct — ${hit.label}`, "success");
      if (solved.length === 4) endGame(true);
      else saveProgress();
    } else {
      mistakes += 1;
      selected = [];
      const host = $("#connBoard");
      host.classList.add("shake");
      setTimeout(() => host.classList.remove("shake"), 380);
      A.sfx("wrong");
      if (mistakes >= MAX_MISTAKES) {
        endGame(false);
      } else {
        remaining = A.shuffle(remaining);
        renderBoard();
        renderSelection();
        A.toast(`Not quite — ${MAX_MISTAKES - mistakes} mistake${MAX_MISTAKES - mistakes === 1 ? "" : "s"} left`);
        saveProgress();
      }
    }
    renderMistakes();
  }

  function resultMarkup(won) {
    const all = groups.map((g) => `<div class="conn-group" style="--tier-color:${TIERS[g.tier || 1]}">
      <div class="conn-group-head"><span class="conn-group-label">${A.esc(g.label)}</span><span class="conn-tier">${[1,2,3,4].map((n) => `<i class="${n <= (g.tier || 1) ? "on" : ""}"></i>`).join("")}</span></div>
      <div class="conn-group-levels">${g.levels.map((l) => `<span>${A.esc(l.name)}</span>`).join("")}</div>
    </div>`).join("");
    return `<div class="result-card ${won ? "won" : "lost"}">
      <div class="result-body">
        <p class="result-kicker">${won ? "All four groups found" : "Out of mistakes"}</p>
        <h3 class="result-name">${won ? "Board solved" : `${solved.length}/4 groups found`}</h3>
        <p class="result-meta">${mistakes} mistake${mistakes === 1 ? "" : "s"} used · ${solved.length}/4 groups · daily board</p>
      </div>
    </div>
    <div class="conn-solution">${all}</div>`;
  }

  function endGame(won) {
    status = won ? "won" : "lost";
    if (mode === "daily") {
      A.markDaily(GAME, {
        won, mistakes, solved: solved.slice(),
        groupIds: groups.map((g) => g.id)
      }, (s) => {
        s.mistakesTotal = (s.mistakesTotal || 0) + mistakes;
        s.rounds = (s.rounds || 0) + 1;
        s.history = (s.history || []).concat({ date: A.dateKey(), mistakes, won }).slice(-14);
      });
      A.clearProgress(GAME);
    }
    const host = $("#connResult");
    host.hidden = false;
    host.innerHTML = resultMarkup(won);
    $("#btnSubmit").disabled = true;
    $("#btnClear").disabled = true;
    $("#rndAfter")?.remove();
    const actions = document.createElement("div");
    actions.className = "actions";
    actions.id = "rndAfter";
    actions.innerHTML = `<button class="btn primary" id="btnShareConn" type="button">Share result</button><button class="btn" id="btnPracticeConn" type="button">${mode === "daily" ? "Play practice board" : "New practice board"}</button>`;
    host.appendChild(actions);
    $("#btnShareConn").addEventListener("click", shareResult);
    $("#btnPracticeConn").addEventListener("click", () => { mode = "practice"; newPuzzle(false); });
    if (won) { A.sfx("win"); A.confetti(42); } else A.sfx("lose");
    renderAll();
    updateSideStats();
    renderStatsDialog();
  }

  function shareResult() {
    const emojis = solved.map((id) => {
      const g = groups.find((x) => x.id === id);
      return TIER_EMOJI[g?.tier || 1] || "🟩";
    });
    const title = mode === "daily" ? `GD Arcade · Connections #${A.dayNumber()}` : "GD Arcade · Connections Practice";
    const score = status === "won" ? `4/4 groups` : `${solved.length}/4 groups`;
    A.shareText(`${title}\n${score} · ${mistakes} mistake${mistakes === 1 ? "" : "s"}\n${emojis.join("")}${status === "won" ? "" : " ❌"}\n${location.origin}${location.pathname}`);
  }

  function updateSideStats() {
    const s = A.getStats(GAME);
    const rate = s.played ? Math.round((s.wins / s.played) * 100) : 0;
    const avg = s.rounds ? (s.mistakesTotal / s.rounds).toFixed(1) : "0.0";
    $("#connSideStats").innerHTML = `
      <div class="side-stat"><b>${rate}%</b><span>Completion</span></div>
      <div class="side-stat"><b>${avg}</b><span>Avg. mistakes</span></div>
      <div class="side-stat"><b>${s.streak || 0}</b><span>Streak</span></div>
      <div class="side-stat"><b>${s.maxStreak || 0}</b><span>Best streak</span></div>`;
  }

  function renderStatsDialog() {
    const s = A.getStats(GAME);
    $("#statPlayed").textContent = s.played || 0;
    $("#statWin").textContent = `${s.played ? Math.round((s.wins / s.played) * 100) : 0}%`;
    $("#statStreak").textContent = s.streak || 0;
    $("#statAvg").textContent = s.rounds ? (s.mistakesTotal / s.rounds).toFixed(1) : "0.0";
    const hist = (s.history || []).slice(-10);
    $("#connHistory").innerHTML = hist.length ? hist.map((h) => {
      const w = h.won ? 100 : Math.max(8, ((4 - h.mistakes) / 4) * 100);
      return `<div class="dist-row ${h.date === A.dateKey() ? "today" : ""}"><span>${h.won ? "✓" : "✕"}</span><div class="dist-bar"><div class="dist-fill" style="width:${w}%">${h.mistakes} miss</div></div></div>`;
    }).join("") : `<p class="tiny-note">No daily results yet. Solve today’s board to start the history.</p>`;
  }

  function restoreDaily() {
    const daily = A.getDaily(GAME);
    mode = "daily";
    if (daily) {
      parsePuzzleFromSaved({ ...daily, order: [] });
      // Rebuild a completed state from the stored record.
      if (!groups.length) {
        groups = (daily.groupIds || []).map((id) => A.connectionsGroups.find((g) => g.id === id)).filter(Boolean);
        board = groups.flatMap((g) => g.levels);
        initialBoardIds = board.map((l) => l.id);
      }
      solved = (daily.solved || []).slice();
      mistakes = daily.mistakes || 0;
      remaining = [];
      status = daily.won ? "won" : "lost";
      renderAll();
      const host = $("#connResult");
      host.hidden = false;
      host.innerHTML = resultMarkup(!!daily.won);
      const actions = document.createElement("div");
      actions.className = "actions";
      actions.innerHTML = `<button class="btn primary" id="btnShareConn" type="button">Share result</button><button class="btn" id="btnPracticeConn" type="button">Play practice board</button>`;
      host.appendChild(actions);
      $("#btnShareConn").addEventListener("click", shareResult);
      $("#btnPracticeConn").addEventListener("click", () => { mode = "practice"; newPuzzle(false); });
      document.querySelectorAll("[data-mode]").forEach((t) => t.setAttribute("aria-pressed", String(t.dataset.mode === mode)));
      return;
    }
    const progress = A.getProgress(GAME);
    if (progress && progress.date === A.dateKey() && parsePuzzleFromSaved(progress)) {
      renderAll();
      return;
    }
    newPuzzle(true);
  }

  // Events
  $("#btnSubmit").addEventListener("click", submit);
  $("#btnClear").addEventListener("click", () => { selected = []; renderBoard(); renderSelection(); });
  $("#btnShuffle").addEventListener("click", () => { if (status === "playing") shuffleRemaining(); });
  document.querySelectorAll("[data-mode]").forEach((tab) => tab.addEventListener("click", () => {
    if (tab.dataset.mode === "daily") restoreDaily();
    else { mode = "practice"; newPuzzle(false); }
  }));
  document.querySelectorAll("[data-open-game-stats]").forEach((b) => b.addEventListener("click", () => { renderStatsDialog(); $("#gameStatsDialog").showModal(); }));
  $("#resetConnections").addEventListener("click", async () => {
    if (await A.confirmDialog({ title: "Reset Connections stats?", message: "This deletes Connections' daily stats, streak and history. Other games are unaffected.", confirmText: "Reset Connections", danger: true })) {
      A.resetGame(GAME);
      location.reload();
    }
  });

  A.setupPage({ game: GAME });
  restoreDaily();
  updateSideStats();
  renderStatsDialog();
})();
