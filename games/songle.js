/* GD Arcade — Songle (Game 6) */
(() => {
  "use strict";
  const A = window.GDArcade;
  if (!A) return;

  const GAME = "songle";
  const MAX = 6;
  const CLIPS = [1, 2, 3, 5, 8, 12];
  const REVEAL_CLIP = 30;
  const HINTS = [
    { label: "Artist", at: 1 },
    { label: "Title shape", at: 2 },
    { label: "Level usage", at: 3 }
  ];

  const SONGS = A.songs.filter((song) => song.audioUrl && song.name);
  const usageBySong = new Map();
  for (const level of A.levels) {
    if (!level.songId) continue;
    const key = String(level.songId);
    if (!usageBySong.has(key)) usageBySong.set(key, []);
    usageBySong.get(key).push(level);
  }

  const $ = (sel) => document.querySelector(sel);
  const input = $("#songInput");
  const playBtn = $("#songPlay");
  const playIcon = $("#songPlayIcon");
  const replayBtn = $("#songReplay");
  const audioEl = $("#songAudio");
  const volumeInput = $("#songVolume");
  const resultEl = $("#songResult");
  const audioError = $("#songAudioError");

  let mode = "daily";
  let status = "playing";
  let answer = null;
  let attempts = [];
  let guessedIds = new Set();
  let selectedSong = null;
  let lastResult = null;

  let totalScore = 0;
  let roundNumber = 1;
  let endlessStreak = 0;
  let bestEndlessStreak = 0;
  let runSongIds = new Set();

  let clipLength = CLIPS[0];
  let clipOrigin = 0;
  let clipEnd = CLIPS[0];
  let hasPlayed = false;

  let volume = Number(A.store.get("songle.volume", 0.6));
  if (!Number.isFinite(volume)) volume = 0.6;
  volume = A.clamp(volume, 0, 1);

  /* ------------------------------------------------------------------ *
   * Audio helpers
   * ------------------------------------------------------------------ */
  function artistProfile(artist) {
    const slug = String(artist || "")
      .replace(/&amp;/g, "and")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "");
    return slug ? `https://${slug}.newgrounds.com/` : "https://www.newgrounds.com/audio";
  }

  function setVolume(value) {
    volume = A.clamp(Number(value) || 0, 0, 1);
    audioEl.volume = volume;
    volumeInput.value = String(Math.round(volume * 100));
    A.store.set("songle.volume", volume);
  }

  function showAudioError() {
    if (!answer) return;
    audioError.hidden = false;
    audioError.innerHTML = `The stream did not start. Your browser, network or an ad blocker may be blocking Newgrounds audio. <a href="${A.esc(answer.pageUrl)}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:underline">Open this track on Newgrounds ↗</a>`;
    $("#songExcerptNote").textContent = "Audio unavailable — the guess controls still work.";
  }

  function clearAudioError() {
    audioError.hidden = true;
    audioError.innerHTML = "";
  }

  function loadSong(song) {
    answer = song;
    hasPlayed = false;
    try { audioEl.pause(); } catch {}
    try { audioEl.currentTime = 0; } catch {}
    audioEl.src = song.audioUrl;
    audioEl.volume = volume;
    clearAudioError();
    $("#songSource").textContent = "Audio streams from Newgrounds’ official CDN. The track and artist links appear when the answer is revealed. Nothing is downloaded or hosted by GD Arcade.";
    configureClip(CLIPS[0]);
    renderAudio();
  }

  function configureClip(length) {
    clipLength = length;
    clipOrigin = 0;
    clipEnd = length;
    $("#songExcerptLength").textContent = `${length}s`;
    $("#songStageChip").textContent = status === "playing" ? `${length}s excerpt` : "Answer revealed";
  }

  function currentClipLength() {
    return status === "playing" ? CLIPS[Math.min(attempts.length, CLIPS.length - 1)] : REVEAL_CLIP;
  }

  function playClip({ restart = false } = {}) {
    if (!answer || !audioEl.src) return;
    const length = currentClipLength();
    if (length !== clipLength) configureClip(length);

    const atEnd = Number(audioEl.currentTime) >= clipEnd - 0.05;
    if (restart || atEnd || !hasPlayed) {
      try { audioEl.currentTime = 0; } catch {}
      clipOrigin = 0;
      clipEnd = clipLength;
    }
    hasPlayed = true;
    try {
      const promise = audioEl.play();
      if (promise && typeof promise.catch === "function") promise.catch(showAudioError);
    } catch {
      showAudioError();
    }
    renderAudio();
  }

  function stopAudio(reset = true) {
    try { audioEl.pause(); } catch {}
    if (reset) { try { audioEl.currentTime = 0; } catch {} }
    renderAudio();
  }

  function renderAudio() {
    const playing = !audioEl.paused && !audioEl.ended;
    $("#songWave").classList.toggle("playing", playing);
    playBtn.classList.toggle("playing", playing);
    playIcon.innerHTML = A.icon(playing ? "pause" : "play");
    playBtn.setAttribute("aria-label", playing ? "Pause audio" : status === "playing" ? `Play ${clipLength} second excerpt` : "Play the answer preview");
    playBtn.disabled = !answer;
    replayBtn.disabled = !answer;
    if (!playing && status === "playing" && !hasPlayed) {
      $("#songExcerptNote").textContent = "Press play to hear it.";
    }
  }

  /* ------------------------------------------------------------------ *
   * Puzzle selection
   * ------------------------------------------------------------------ */
  function dailySong() {
    if (!SONGS.length) return null;
    if (SONGS.length === 1) return SONGS[0];
    const rnd = A.rngFor(GAME, "answer");
    return SONGS[Math.floor(rnd() * SONGS.length)];
  }

  function randomSong(exclude = new Set()) {
    if (!SONGS.length) return null;
    const options = SONGS.filter((song) => !exclude.has(song.id) && song.id !== answer?.id);
    return A.pick(options.length ? options : SONGS);
  }

  function usageFor(song) {
    return usageBySong.get(String(song?.id)) || [];
  }

  function usageText(song) {
    const levels = usageFor(song);
    if (!levels.length) return "Not linked to a level in this snapshot";
    if (levels.length === 1) return `Heard in ${levels[0].name} by ${levels[0].creator}`;
    return `Heard in ${levels.length} GD levels, including ${levels[0].name}`;
  }

  function titleShape(name) {
    return String(name).split(/\s+/).map((word) => {
      const first = word.search(/[A-Za-z0-9]/);
      if (first < 0) return word;
      return word.replace(/[A-Za-z0-9]/g, (ch, offset) => (offset === first ? ch : "•"));
    }).join(" ");
  }

  /* ------------------------------------------------------------------ *
   * Rendering
   * ------------------------------------------------------------------ */
  function renderAttempts() {
    const used = status === "playing" ? attempts.length : status === "won" ? attempts.length + 1 : MAX;
    $("#songAttempts").innerHTML = Array.from({ length: MAX }, (_, i) => {
      const cls = i < attempts.length ? "lost" : status === "won" && i === attempts.length ? "won" : "";
      return `<i class="${cls}"></i>`;
    }).join("");
    $("#songAttempts").setAttribute("aria-label", `${Math.max(0, MAX - used)} attempts remaining`);
    $("#songAttemptChip").textContent = status === "won"
      ? "Solved"
      : status === "lost"
        ? "Out of tries"
        : `${MAX - attempts.length} attempt${MAX - attempts.length === 1 ? "" : "s"} left`;
  }

  function renderHints() {
    const wrong = attempts.length;
    const revealAll = status !== "playing";
    $("#songHints").innerHTML = HINTS.map((hint) => {
      const shown = revealAll || wrong >= hint.at;
      let value = "";
      if (shown) {
        if (hint.label === "Artist") value = answer?.artist || "Not listed";
        else if (hint.label === "Title shape") value = answer ? titleShape(answer.name) : "Not listed";
        else value = answer ? usageText(answer) : "Not listed";
      }
      const remaining = Math.max(0, hint.at - wrong);
      return `<div class="song-hint ${shown ? "revealed" : ""}">
        <span><b>${hint.label}</b> ${shown ? A.esc(value) : `Unlocks after ${remaining} miss${remaining === 1 ? "" : "es"}`}</span>
        <span class="tag">${shown ? `−${75} pts` : "locked"}</span>
      </div>`;
    }).join("");
  }

  function updateToolbar() {
    const stats = A.getStats(GAME);
    $("#songScoreChip").textContent = mode === "endless" ? `${A.fmtNum(totalScore)} pts` : `${A.fmtNum(lastResult?.points || 0)} pts`;
    $("#songStreakChip").textContent = mode === "endless"
      ? `${endlessStreak} streak`
      : mode === "daily"
        ? `${stats.streak || 0} day streak`
        : "Practice";
    $("#songStageChip").textContent = status === "playing" ? `${currentClipLength()}s excerpt` : "Answer revealed";
  }

  function updateKicker() {
    $("#songKicker").textContent = mode === "daily"
      ? `Daily #${A.dayNumber()} · Newgrounds stream`
      : mode === "endless"
        ? `Endless · Round ${roundNumber} · ${endlessStreak} solved`
        : "Practice · Newgrounds stream";
  }

  function updateModeUI() {
    document.querySelectorAll("[data-mode]").forEach((tab) => {
      tab.setAttribute("aria-pressed", String(tab.dataset.mode === mode));
    });
  }

  function updateDailyBadge() {
    const done = A.isDailyDone(GAME);
    const badge = $("#dailyBadge");
    badge.textContent = mode === "daily"
      ? done ? "Daily complete" : `Daily #${A.dayNumber()}`
      : mode === "endless" ? "Endless run" : "Practice mode";
    badge.className = `chip ${mode === "daily" ? done ? "green" : "pink" : "cyan"}`;
  }

  function updateSideStats() {
    const stats = A.getStats(GAME);
    const rate = stats.played ? Math.round(((stats.wins || 0) / stats.played) * 100) : 0;
    const solves = (stats.solveAttempts || []).filter((n) => Number(n) > 0);
    const avg = solves.length ? (solves.reduce((sum, n) => sum + Number(n), 0) / solves.length).toFixed(1) : "0.0";
    $("#songSideStats").innerHTML = `
      <div class="side-stat"><b>${rate}%</b><span>Solve rate</span></div>
      <div class="side-stat"><b>${avg}</b><span>Avg. guesses</span></div>
      <div class="side-stat"><b>${A.fmtNum(stats.bestScore || 0)}</b><span>Best score</span></div>
      <div class="side-stat"><b>${A.fmtNum(stats.bestEndlessScore || 0)}</b><span>Endless best</span></div>`;
  }

  function updateActions() {
    const finished = (status === "won" || status === "lost") && !!lastResult;
    const endlessNext = mode === "endless" && status === "won" && !!lastResult;
    $("#songNext").hidden = !endlessNext;
    $("#songShare").hidden = !finished || endlessNext;
    $("#songNew").hidden = endlessNext;
    $("#songNew").textContent = mode === "daily" ? "Play endless" : mode === "endless" ? "Restart endless" : "New song";
    $("#songGuessBtn").disabled = status !== "playing" || !answer;
    input.disabled = status !== "playing" || !answer;
    if (status !== "playing") {
      $("#songSuggestions").classList.remove("open");
      input.setAttribute("aria-expanded", "false");
    }
  }

  function renderAll() {
    renderAttempts();
    renderHints();
    updateToolbar();
    updateKicker();
    updateModeUI();
    updateDailyBadge();
    updateSideStats();
    updateActions();
    renderAudio();
  }

  function songLinks(song) {
    return `<span class="song-result-links">
      <a href="${A.esc(song.pageUrl)}" target="_blank" rel="noopener noreferrer">Track on Newgrounds ↗</a>
      <a href="${A.esc(artistProfile(song.artist))}" target="_blank" rel="noopener noreferrer">${A.esc(song.artist)} ↗</a>
    </span>`;
  }

  function resultMarkup(result) {
    const solved = result.won;
    const guesses = solved ? result.attempts : MAX;
    const levels = usageFor(answer);
    const heard = levels.length
      ? `Heard in ${levels.slice(0, 3).map((level) => A.esc(level.name)).join(", ")}${levels.length > 3 ? ` +${levels.length - 3} more` : ""}`
      : "No linked level in this snapshot";
    const kicker = result.finalRun
      ? "Endless run over"
      : solved
        ? mode === "endless" ? `Round ${roundNumber} cleared` : `Solved in ${guesses}/${MAX} attempts`
        : `Out of attempts · ${MAX}/${MAX}`;
    const scoreLine = result.finalRun
      ? `Run total ${A.fmtNum(totalScore)} pts over ${roundNumber} round${roundNumber === 1 ? "" : "s"} · best streak ${bestEndlessStreak}`
      : solved
        ? `+${A.fmtNum(result.points)} pts${mode === "endless" ? ` · Run total ${A.fmtNum(totalScore)} pts` : ""}`
        : "0 pts · the answer is revealed";
    return `<div class="result-card ${solved ? "won" : "lost"}">
      <div class="result-thumb song-result-art">${A.icon("music")}<b>${solved ? "✓" : "✕"}</b></div>
      <div class="result-body">
        <p class="result-kicker">${kicker}</p>
        <h3 class="result-name">${A.esc(answer.name)}</h3>
        <p class="result-meta">by ${A.esc(answer.artist)} · ${A.esc(answer.source || "Newgrounds")}</p>
        <p class="result-meta">${heard}</p>
        <p class="result-meta">${scoreLine}</p>
        ${songLinks(answer)}
      </div>
    </div>`;
  }

  function showResult(result) {
    resultEl.hidden = false;
    resultEl.innerHTML = resultMarkup(result);
    $("#songSource").innerHTML = `Track and artist: ${songLinks(answer)}<br>Streamed from Newgrounds’ official CDN. GD Arcade does not download, host or redistribute music.`;
  }

  /* ------------------------------------------------------------------ *
   * Scoring, stats & sharing
   * ------------------------------------------------------------------ */
  function solvePoints() {
    const wrong = attempts.length;
    const hints = Math.min(HINTS.length, wrong);
    return Math.max(100, 1000 - wrong * 150 - hints * 75);
  }

  function saveProgress() {
    if (mode !== "daily" || status !== "playing" || !answer) return;
    A.saveProgress(GAME, {
      date: A.dateKey(),
      songId: answer.id,
      guessed: attempts.map((song) => song.id)
    });
  }

  function recordDaily(result) {
    A.markDaily(GAME, {
      won: result.won,
      score: result.points,
      attempts: result.attempts,
      songId: answer.id,
      songName: answer.name,
      wrongIds: attempts.map((song) => song.id),
      hints: Math.min(HINTS.length, attempts.length)
    }, (stats) => {
      stats.bestScore = Math.max(stats.bestScore || 0, result.points);
      stats.totalScore = (stats.totalScore || 0) + result.points;
      if (result.won) {
        stats.solveAttempts = (stats.solveAttempts || []).concat(result.attempts).slice(-40);
      }
      stats.dailyHistory = (stats.dailyHistory || []).concat({
        date: A.dateKey(),
        songId: answer.id,
        name: answer.name,
        attempts: result.attempts,
        score: result.points,
        won: result.won
      }).slice(-12);
    });
    A.clearProgress(GAME);
  }

  function recordEndlessRun() {
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
      stats.lastEndless = totalScore;
    });
  }

  function finish(won) {
    if (status !== "playing") return;
    status = won ? "won" : "lost";
    const points = won ? solvePoints() : 0;
    const guesses = won ? attempts.length + 1 : MAX;

    if (mode === "endless") {
      if (won) {
        totalScore += points;
        endlessStreak += 1;
        bestEndlessStreak = Math.max(bestEndlessStreak, endlessStreak);
      } else {
        recordEndlessRun();
      }
    }

    lastResult = {
      won,
      points,
      attempts: guesses,
      hintCount: Math.min(HINTS.length, attempts.length),
      finalRun: mode === "endless" && !won,
      restored: false
    };

    if (mode === "daily") recordDaily(lastResult);
    else if (mode === "practice") {
      A.markPractice(GAME, { won, score: points, attempts: guesses }, (stats) => {
        stats.practiceScore = (stats.practiceScore || 0) + points;
      });
    }

    stopAudio();
    configureClip(REVEAL_CLIP);
    renderAll();
    showResult(lastResult);

    if (won) { A.sfx("win"); A.confetti(40); }
    else A.sfx("lose");
    renderStatsDialog();
  }

  function shareResult() {
    if (!lastResult) return;
    const title = mode === "daily"
      ? `GD Arcade · Songle #${A.dayNumber()}`
      : mode === "endless"
        ? "GD Arcade · Songle Endless"
        : "GD Arcade · Songle Practice";
    const used = lastResult.won ? lastResult.attempts : MAX;
    const grid = Array.from({ length: used }, (_, i) => (lastResult.won && i === used - 1 ? "🟩" : "🟪")).join("") + (lastResult.won ? "" : " ❌");
    const line = mode === "endless"
      ? `${A.fmtNum(totalScore)} pts · ${bestEndlessStreak} song streak · round ${roundNumber}`
      : `${lastResult.won ? `Solved in ${used}/${MAX}` : `X/${MAX}`} · ${A.fmtNum(lastResult.points)} pts`;
    A.shareText(`${title}\n${line}\n${grid}\n${location.origin}${location.pathname}`);
  }

  /* ------------------------------------------------------------------ *
   * Round starts & restore
   * ------------------------------------------------------------------ */
  function baseStart(nextMode) {
    mode = nextMode;
    status = "playing";
    attempts = [];
    guessedIds = new Set();
    selectedSong = null;
    lastResult = null;
    input.value = "";
    resultEl.hidden = true;
    resultEl.innerHTML = "";
    clearAudioError();
    input.disabled = false;
    $("#songGuessBtn").disabled = false;
    renderAll();
  }

  function startDaily() {
    baseStart("daily");
    answer = dailySong();
    totalScore = 0;
    roundNumber = 1;
    endlessStreak = 0;
    bestEndlessStreak = 0;
    if (!answer) {
      showEmptyCatalogue();
      return;
    }
    loadSong(answer);
    saveProgress();
    renderAll();
  }

  function startPractice() {
    baseStart("practice");
    answer = randomSong();
    totalScore = 0;
    roundNumber = 1;
    endlessStreak = 0;
    bestEndlessStreak = 0;
    runSongIds = new Set();
    if (!answer) {
      showEmptyCatalogue();
      return;
    }
    loadSong(answer);
    renderAll();
    A.toast("Practice song — this does not affect daily stats.");
  }

  function startEndless() {
    baseStart("endless");
    totalScore = 0;
    roundNumber = 1;
    endlessStreak = 0;
    bestEndlessStreak = 0;
    runSongIds = new Set();
    answer = randomSong(runSongIds);
    if (!answer) {
      showEmptyCatalogue();
      return;
    }
    runSongIds.add(answer.id);
    loadSong(answer);
    renderAll();
    A.toast("Endless run — solve each song to keep going.");
  }

  function nextEndlessRound() {
    if (mode !== "endless" || status !== "won") return;
    roundNumber += 1;
    status = "playing";
    attempts = [];
    guessedIds = new Set();
    selectedSong = null;
    lastResult = null;
    input.value = "";
    resultEl.hidden = true;
    resultEl.innerHTML = "";
    clearAudioError();
    input.disabled = false;
    $("#songGuessBtn").disabled = false;
    answer = randomSong(runSongIds);
    if (!answer) {
      startEndless();
      return;
    }
    runSongIds.add(answer.id);
    loadSong(answer);
    renderAll();
  }

  function showEmptyCatalogue() {
    status = "lost";
    stopAudio();
    configureClip(REVEAL_CLIP);
    audioError.hidden = false;
    audioError.textContent = "The song catalogue could not be loaded. Check that data/songs.js is present and reload the page.";
    input.disabled = true;
    $("#songGuessBtn").disabled = true;
    playBtn.disabled = true;
    replayBtn.disabled = true;
    A.toast("Song catalogue unavailable.", "error");
    renderAll();
  }

  function restoreDaily() {
    mode = "daily";
    const daily = A.getDaily(GAME);
    const progress = A.getProgress(GAME);
    const lookup = (id) => SONGS.find((song) => String(song.id) === String(id)) || null;

    if (daily) {
      answer = lookup(daily.songId) || dailySong();
      if (!answer) {
        showEmptyCatalogue();
        return;
      }
      baseStart("daily");
      status = daily.won ? "won" : "lost";
      attempts = (daily.wrongIds || []).map(lookup).filter(Boolean);
      guessedIds = new Set(attempts.map((song) => song.id));
      totalScore = 0;
      roundNumber = 1;
      endlessStreak = 0;
      bestEndlessStreak = 0;
      lastResult = {
        won: !!daily.won,
        points: Number(daily.score) || 0,
        attempts: Number(daily.attempts) || (daily.won ? attempts.length + 1 : MAX),
        hintCount: Number(daily.hints) || Math.min(HINTS.length, attempts.length),
        finalRun: false,
        restored: true
      };
      loadSong(answer);
      configureClip(REVEAL_CLIP);
      renderAll();
      showResult(lastResult);
      return;
    }

    if (progress && progress.date === A.dateKey()) {
      answer = lookup(progress.songId) || dailySong();
      if (!answer) {
        startDaily();
        return;
      }
      baseStart("daily");
      attempts = (progress.guessed || []).map(lookup).filter(Boolean);
      guessedIds = new Set(attempts.map((song) => song.id));
      if (attempts.length >= MAX) {
        finish(false);
        return;
      }
      loadSong(answer);
      configureClip(CLIPS[Math.min(attempts.length, CLIPS.length - 1)]);
      renderAll();
      return;
    }

    startDaily();
  }

  /* ------------------------------------------------------------------ *
   * Guesses
   * ------------------------------------------------------------------ */
  function submitGuess() {
    if (status !== "playing" || !answer) return;
    const typed = A.norm(input.value);
    if (!typed) {
      A.toast("Search for a song and choose a suggestion first.", "error");
      input.focus();
      return;
    }
    const picked = selectedSong && selectedSong._name === typed
      ? selectedSong
      : SONGS.find((song) => song._name === typed) || null;

    if (!picked) {
      A.toast("Choose a track from the suggestion list.", "error");
      input.focus();
      return;
    }

    if (guessedIds.has(picked.id)) {
      A.toast(`You already tried ${picked.name}.`, "error");
      input.select();
      return;
    }

    if (picked.id === answer.id) {
      input.value = picked.name;
      finish(true);
      return;
    }

    attempts.push(picked);
    guessedIds.add(picked.id);
    selectedSong = null;
    input.value = "";
    input.focus();
    A.sfx("wrong");

    if (attempts.length >= MAX) {
      finish(false);
      return;
    }

    configureClip(CLIPS[attempts.length]);
    saveProgress();
    renderAll();
    A.toast(`Not ${picked.name}. The excerpt is now ${currentClipLength()}s.`, "error");
    if (hasPlayed) playClip({ restart: true });
  }

  /* ------------------------------------------------------------------ *
   * Stats dialog
   * ------------------------------------------------------------------ */
  function renderStatsDialog() {
    const stats = A.getStats(GAME);
    $("#statPlayed").textContent = stats.played || 0;
    $("#statWin").textContent = `${stats.played ? Math.round(((stats.wins || 0) / stats.played) * 100) : 0}%`;
    $("#statStreak").textContent = stats.streak || 0;
    $("#statBestScore").textContent = A.fmtNum(stats.bestScore || 0);

    const dist = Array.from({ length: MAX }, (_, i) => (stats.solveAttempts || []).filter((n) => Number(n) === i + 1).length);
    const max = Math.max(1, ...dist);
    const today = A.getDaily(GAME);
    $("#songDist").innerHTML = dist.map((count, i) => {
      const isToday = today && today.won && Number(today.attempts) === i + 1;
      return `<div class="dist-row ${isToday ? "today" : ""}">
        <span>${i + 1}</span>
        <div class="dist-bar"><div class="dist-fill" style="width:${Math.max(6, (count / max) * 100)}%">${count}</div></div>
      </div>`;
    }).join("");

    const recent = (stats.dailyHistory || []).slice(-8).reverse();
    const maxPoints = Math.max(1, ...recent.map((entry) => Number(entry.score) || 0));
    $("#songHistory").innerHTML = recent.length
      ? recent.map((entry) => `<div class="dist-row ${entry.date === A.dateKey() ? "today" : ""}">
        <span>${entry.won ? "✓" : "✕"}</span>
        <div class="dist-bar"><div class="dist-fill" style="width:${Math.max(10, ((Number(entry.score) || 0) / maxPoints) * 100)}%">${A.esc(entry.name || "Track")} · ${A.fmtNum(entry.score || 0)} pts</div></div>
      </div>`).join("")
      : `<p class="tiny-note">No daily songs yet. Play today’s excerpt to start the history.</p>`;
  }

  /* ------------------------------------------------------------------ *
   * Events
   * ------------------------------------------------------------------ */
  A.createSearch({
    input,
    list: $("#songSuggestions"),
    items: SONGS,
    label: (song) => A.esc(song.name),
    meta: (song) => `${A.esc(song.artist)} · Newgrounds`,
    emptyText: "No songs match that search.",
    max: 9,
    onPick: (song) => {
      selectedSong = song;
      input.value = song.name;
      input.focus();
    }
  });
  input.addEventListener("input", () => { selectedSong = null; });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") { event.preventDefault(); submitGuess(); }
  });
  $("#songGuessBtn").addEventListener("click", submitGuess);

  playBtn.addEventListener("click", () => {
    if (!audioEl.paused) {
      stopAudio(false);
      $("#songExcerptNote").textContent = "Paused — press play to continue this excerpt.";
      return;
    }
    playClip();
  });
  replayBtn.addEventListener("click", () => {
    if (!answer) return;
    clearAudioError();
    playClip({ restart: true });
  });

  document.querySelectorAll("[data-mode]").forEach((tab) => {
    tab.addEventListener("click", () => {
      if (tab.dataset.mode === "daily") restoreDaily();
      else if (tab.dataset.mode === "practice") startPractice();
      else startEndless();
    });
  });

  $("#songNext").addEventListener("click", nextEndlessRound);
  $("#songShare").addEventListener("click", shareResult);
  $("#songNew").addEventListener("click", () => {
    if (mode === "practice") startPractice();
    else startEndless();
  });

  volumeInput.addEventListener("input", () => {
    setVolume(Number(volumeInput.value) / 100);
    A.sfx("tick");
  });
  audioEl.addEventListener("play", () => {
    renderAudio();
    clearAudioError();
    $("#songExcerptNote").textContent = `Playing ${clipLength}s from the start of the excerpt.`;
  });
  audioEl.addEventListener("pause", () => {
    renderAudio();
    if (status !== "playing") {
      $("#songExcerptNote").textContent = "Answer revealed — replay to hear a 30s preview.";
    } else if (Number(audioEl.currentTime) >= clipEnd - 0.1) {
      $("#songExcerptNote").textContent = "Excerpt finished — replay it or make a guess for a longer clip.";
      $("#songProgressFill").style.width = "100%";
    } else if (hasPlayed) {
      $("#songExcerptNote").textContent = "Paused — press play to continue this excerpt.";
    }
  });
  audioEl.addEventListener("timeupdate", () => {
    const pct = A.clamp(((Number(audioEl.currentTime) - clipOrigin) / clipLength) * 100, 0, 100);
    $("#songProgressFill").style.width = `${pct}%`;
    if (!audioEl.paused && audioEl.currentTime >= clipEnd) {
      try { audioEl.pause(); } catch {}
      $("#songProgressFill").style.width = "100%";
    }
  });
  audioEl.addEventListener("ended", () => {
    renderAudio();
    $("#songProgressFill").style.width = "100%";
  });
  audioEl.addEventListener("waiting", () => {
    if (!audioEl.paused) $("#songExcerptNote").textContent = "Buffering the Newgrounds stream…";
  });
  audioEl.addEventListener("error", showAudioError);

  document.querySelectorAll("[data-open-game-stats]").forEach((button) => {
    button.addEventListener("click", () => {
      renderStatsDialog();
      const dialog = $("#gameStatsDialog");
      if (dialog && !dialog.open) dialog.showModal();
    });
  });

  $("#resetSongle").addEventListener("click", async () => {
    const ok = await A.confirmDialog({
      title: "Reset Songle stats?",
      message: "This deletes Songle’s daily solve rate, streak, score history and endless records. Other games are not affected.",
      confirmText: "Reset Songle",
      danger: true
    });
    if (!ok) return;
    A.resetGame(GAME);
    location.reload();
  });

  document.querySelectorAll("[data-icon]").forEach((el) => { el.innerHTML = A.icon(el.dataset.icon); });
  $("#songSearchNote").textContent = `${SONGS.length} tracks with official Newgrounds streams. Search by title or artist, then choose a suggestion.`;
  $("#songWave").innerHTML = Array.from({ length: 26 }, (_, i) => `<i style="height:${8 + ((i * 13) % 30)}px"></i>`).join("");
  setVolume(volume);

  A.setupPage({ game: GAME });
  renderStatsDialog();
  restoreDaily();
})();
