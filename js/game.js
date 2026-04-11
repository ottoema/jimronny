// ─── GAME LOGIC ───────────────────────────────────────────────────────────────
function totalScore(p) { return p.scores.reduce((a,b)=>a+b,0); }
function totalBuys(p)  { return (p.buys||[]).reduce((a,b)=>a+(b||0),0); }
function getLeader()   { return currentGame ? [...currentGame.players].sort((a,b)=>totalScore(a)-totalScore(b))[0] : null; }

function startGame() {
  if (setupPlayers.length < 2) { notify("Minst 2 spelare krävs!", "warn"); return; }
  const names = new Set(setupPlayers.map(p => p.name.toLowerCase()));
  if (ongoingGames.some(g => {
    const s = new Set(g.players.map(p => p.name.toLowerCase()));
    return s.size === names.size && [...names].every(n => s.has(n));
  })) { notify("En match med dessa spelare pågår redan!", "warn"); return; }
  const game = { id:String(Date.now()), date:new Date().toLocaleDateString("sv-SE"),
    players:setupPlayers.map(p=>({...p,scores:[],buys:[]})), currentRound:1, finished:false };
  setupPlayers.forEach(sp => {
    if (!savedPlayers.find(s=>s.name===sp.name))
      savedPlayers.push({name:sp.name, id:String(sp.id), wins:0, gamesPlayed:0});
  });
  lsave("gin_players", savedPlayers);
  ongoingGames.push(game);
  lsave("gin_ongoing_games", ongoingGames);
  setActiveGame(game.id);
  setupPlayers = []; roundInputs = {}; goesOutIdx = null;
  savePlayersToBackend();
  saveSessionToBackend();
  showView("game");
}

function addBuy(idx) {
  const p = currentGame.players[idx];
  const rb = p.buys[currentGame.currentRound-1]||0;
  if (rb>=MAX_BUYS) { notify(`${p.name} har redan använt alla köp!`, "warn"); return; }
  const nb = [...p.buys]; nb[currentGame.currentRound-1] = rb+1;
  currentGame.players[idx] = {...p, buys:nb};
  lsave("gin_ongoing_games", ongoingGames);
  const el = document.getElementById(`buy-dots-${idx}`);
  if (el) el.outerHTML = buildBuyDotsHtml(idx, rb);
  else renderGame();
}

function removeBuy(idx) {
  const p = currentGame.players[idx];
  const rb = p.buys[currentGame.currentRound-1]||0;
  if (rb<=0) return;
  const nb = [...p.buys]; nb[currentGame.currentRound-1] = rb-1;
  currentGame.players[idx] = {...p, buys:nb};
  lsave("gin_ongoing_games", ongoingGames);
  notify(`Köp ångrad för ${p.name}`, "info");
  const el = document.getElementById(`buy-dots-${idx}`);
  if (el) el.outerHTML = buildBuyDotsHtml(idx);
  else renderGame();
}

function setGoesOut(idx) {
  goesOutIdx = idx;
  renderGame();
}

function adjustScore(idx, delta) {
  const cur = parseInt(roundInputs[idx])||0;
  const newVal = Math.max(5, cur + delta);
  roundInputs[idx] = String(newVal);
  const input = document.getElementById('score-input-'+idx);
  if (input) input.value = newVal;
  updateScoreMinus(idx);
  updateSubmitButton();
}

function updateScoreMinus(idx) {
  const val = parseInt(roundInputs[idx])||0;
  const btn = document.getElementById('score-minus-'+idx);
  if (btn) btn.disabled = val <= 5;
}

function submitBtnHtml(enabled, round) {
  return `<button id="submit-round-btn" class="btn" onclick="submitRound()" ${!enabled?"disabled":""}
    style="margin-top:16px;width:100%;padding:18px;background:${enabled?"#c9622f":"rgba(26,23,20,0.07)"};border:none;color:#fff;font-size:18px;letter-spacing:1px;border-radius:12px;font-weight:600;opacity:${enabled?1:0.4}">
    Registrera omgång ${round} →
  </button>`;
}

function updateSubmitButton() {
  const container = document.getElementById('submit-btn-container');
  if (!container) return;
  const all = goesOutIdx !== null && currentGame.players.every((_,i) =>
    i===goesOutIdx || (roundInputs[i]!==undefined && roundInputs[i]!==""));
  container.innerHTML = submitBtnHtml(all, currentGame.currentRound);
}

function submitRound() {
  if (goesOutIdx===null) { notify("Välj vem som gick ut!", "warn"); return; }
  const allFilled = currentGame.players.every((_,i) =>
    i===goesOutIdx || (roundInputs[i]!==undefined && roundInputs[i]!==""));
  if (!allFilled) { notify("Fyll i poäng för alla spelare!", "warn"); return; }
  for (let i = 0; i < currentGame.players.length; i++) {
    if (i === goesOutIdx) continue;
    const val = parseInt(roundInputs[i]);
    if (!val || val === 0) { notify(`${currentGame.players[i].name}: 0 är inte tillåtet!`, "warn"); return; }
    if (val % 5 !== 0) { notify(`${currentGame.players[i].name}: Poäng måste vara delbart med 5!`, "warn"); return; }
  }

  currentGame.players = currentGame.players.map((p,i) => ({
    ...p, scores:[...p.scores, i===goesOutIdx ? 0 : parseInt(roundInputs[i])]
  }));
  if (!currentGame.roundWinners) currentGame.roundWinners = [];
  currentGame.roundWinners.push(goesOutIdx);

  if (currentGame.currentRound >= TOTAL_ROUNDS) {
    currentGame.finished = true;
    const winner = [...currentGame.players].sort((a,b)=>totalScore(a)-totalScore(b))[0];
    savedPlayers = savedPlayers.map(sp => {
      const played = currentGame.players.find(p=>p.name===sp.name);
      return played ? {...sp, wins:sp.wins+(sp.name===winner.name?1:0), gamesPlayed:sp.gamesPlayed+1} : sp;
    });
    lsave("gin_players", savedPlayers);
    allGames.push({...currentGame});
    lsave("gin_all_games", allGames);
    notify(`Spelet slut! ${winner.name} vinner! 🏆`, "success");
    currentGame.finishedDate = new Date().toLocaleDateString("sv-SE");
    lastFinishedGame = {...currentGame};
    ongoingGames = ongoingGames.filter(g => g.id !== currentGame.id);
    lsave("gin_ongoing_games", ongoingGames);
    setActiveGame(ongoingGames.length > 0 ? ongoingGames[0].id : null);
    saveGameToBackend(lastFinishedGame, savedPlayers);
  } else {
    currentGame.currentRound++;
    lsave("gin_ongoing_games", ongoingGames);
    saveSessionToBackend();
  }

  roundInputs = {}; goesOutIdx = null;
  if (lastFinishedGame) {
    render();
  } else {
    openStandingsSheet(true);
  }
}

// ─── DEV TOOLS (localhost only) ───────────────────────────────────────────────
// These functions are gated by isLocalhost() so they are inert on production
// even if called directly from the browser console.

// Removes the most recently completed round from the active game.
function devClearLatestRound() {
  if (!isLocalhost()) return;
  if (!currentGame) return;
  const completed = currentGame.players[0]?.scores.length || 0;
  if (completed === 0) { notify("Inga omgångar att ångra", "warn"); return; }
  currentGame.players = currentGame.players.map(p => ({
    ...p, scores: p.scores.slice(0, -1), buys: p.buys.slice(0, -1),
  }));
  if (currentGame.roundWinners) currentGame.roundWinners = currentGame.roundWinners.slice(0, -1);
  currentGame.currentRound--;
  lsave("gin_ongoing_games", ongoingGames);
  roundInputs = {}; goesOutIdx = null;
  notify(`[Dev] Omgång ${completed} ångrad`, "info");
  render();
}

// Wipes all completed rounds from the active game, resetting it to round 1.
function devClearAllRounds() {
  if (!isLocalhost()) return;
  if (!currentGame) return;
  const completed = currentGame.players[0]?.scores.length || 0;
  if (completed === 0) { notify("Inga omgångar att nollställa", "warn"); return; }
  if (!confirm(`Nollställ alla ${completed} avklarade omgångar? Detta går inte att ångra.`)) return;
  currentGame.players = currentGame.players.map(p => ({ ...p, scores: [], buys: [] }));
  currentGame.roundWinners = [];
  currentGame.currentRound = 1;
  lsave("gin_ongoing_games", ongoingGames);
  roundInputs = {}; goesOutIdx = null;
  notify("[Dev] Alla omgångar nollställda", "info");
  render();
}

function getStats() {
  return savedPlayers.map(p => {
    const pg = allGames.filter(g=>g.players.find(gp=>gp.name===p.name));
    return { ...p,
      totalBuys: pg.reduce((s,g)=>{ const gp=g.players.find(gp=>gp.name===p.name); return s+(gp?totalBuys(gp):0); }, 0),
      avgScore:  pg.length===0 ? 0 : Math.round(pg.reduce((s,g)=>{ const gp=g.players.find(gp=>gp.name===p.name); return s+(gp?totalScore(gp):0); },0)/pg.length)
    };
  }).sort((a,b)=>b.wins-a.wins);
}

function saveGameNote(note) {
  const game = lastFinishedGame || currentGame;
  if (!game) return;
  game.note = note.trim();
  if (!lastFinishedGame) lsave("gin_ongoing_games", ongoingGames);
  const idx = allGames.findIndex(g => g.id === game.id);
  if (idx >= 0) { allGames[idx].note = game.note; lsave("gin_all_games", allGames); }
  updateGameNoteInBackend(game.id, game.note);
  notify("Notat sparat ✓", "success");
}

function deletePlayer(name) {
  if (!confirm(`Ta bort ${name}?`)) return;
  savedPlayers = savedPlayers.filter(p=>p.name!==name);
  lsave("gin_players", savedPlayers);
  renderPlayers();
}
