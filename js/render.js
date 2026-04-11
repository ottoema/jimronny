// ─── RENDER HELPERS ───────────────────────────────────────────────────────────
function setSyncStatus(s) { syncStatus = s; }

function showView(v) {
  if (v === "game") { lastFinishedGame = null; acquireWakeLock(); }
  else if (wakeLockSentinel) { wakeLockSentinel.release().catch(()=>{}); wakeLockSentinel = null; }
  currentView = v;
  document.querySelectorAll(".view").forEach(el => el.classList.remove("active"));
  document.querySelectorAll("nav button").forEach(el => el.classList.remove("active"));
  document.getElementById("view-" + v).classList.add("active");
  document.getElementById("nav-" + v).classList.add("active");
  render();
}

function render() {
  renderAuthBar();
  updateNavState();
  if (currentView==="home")  renderHome();
  if (currentView==="game")  renderGame();
  if (currentView==="stats") renderStats();
}

function updateNavState() {
  const gameBtn = document.getElementById("nav-game");
  gameBtn.disabled = ongoingGames.length === 0;
}

function renderAuthBar() {
  const bar = document.getElementById("auth-bar");
  if (!isAuthenticated) {
    bar.innerHTML = `
      <button class="google-btn" onclick="signIn()">
        <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
        Logga in med Google
      </button>
      <span style="font-size:14px;color:rgba(26,23,20,0.4)">Logga in för att synka</span>`;
  } else {
    const dotColor = syncStatus==="syncing" ? "#d4a843" : syncStatus==="error" ? "#c9622f" : "#3d6b45";
    const syncText = syncStatus==="syncing" ? "Synkar…" : syncStatus==="error" ? "Synkfel" : "Synkad ✓";
    bar.innerHTML = `
      <span class="sync-dot" style="background:${dotColor}"></span>
      <span style="font-size:15px;color:rgba(26,23,20,0.5)">${syncText}</span>
      ${userEmail ? `<span style="font-size:13px;color:rgba(26,23,20,0.35)">${userEmail}</span>` : ""}
      <button class="btn" onclick="loadFromBackend()" style="padding:4px 12px;font-size:14px;color:rgba(26,23,20,0.55)">↻ Hämta</button>
      <button class="btn" onclick="signOut()" style="padding:4px 12px;font-size:14px;color:rgba(26,23,20,0.42)">Logga ut</button>`;
  }
}

// ─── HOME ─────────────────────────────────────────────────────────────────────
function renderHome() {
  let html = "";

  ongoingGames.forEach(g => {
    const isActive = g.id === activeGameId;
    const gLeader = [...g.players].sort((a,b)=>totalScore(a)-totalScore(b))[0];
    const li = g.players.findIndex(p=>p.name===gLeader?.name);
    html += `<div style="border-top:1px solid var(--divider);padding:24px 0">
      <div style="font-size:12px;letter-spacing:3px;color:#c9622f;margin-bottom:10px">PÅGÅENDE MATCH${isActive&&ongoingGames.length>1?" · AKTIV":""}</div>
      <div style="font-family:Georgia,serif;font-size:32px;line-height:1;margin-bottom:6px">Omgång ${g.currentRound} <span style="font-size:18px;color:var(--muted)">/ ${TOTAL_ROUNDS}</span></div>
      <div style="font-size:15px;color:var(--muted);margin-bottom:4px">${g.players.map(p=>p.name).join(", ")}</div>
      ${gLeader ? `<div style="font-size:15px;color:var(--muted);margin-bottom:2px">Leder: <span style="color:${PLAYER_COLORS[li]}">${gLeader.name}</span> · ${totalScore(gLeader)} p</div>` : ""}
      <div style="font-size:13px;color:var(--dim);margin-bottom:16px">${g.date}</div>
      <button class="btn" onclick="switchToGame('${g.id}')" style="width:100%;padding:16px;background:#c9622f;border:none;color:#fff;font-size:18px;font-weight:600;border-radius:10px">Fortsätt →</button>
    </div>`;
  });

  const lastSrc = allGames.length > 0
    ? allGames[allGames.length - 1]
    : (ongoingGames.length > 0 ? ongoingGames[0] : null);
  const newGameHeading = ongoingGames.length > 0
    ? `<div style="font-size:12px;letter-spacing:2px;color:var(--muted);margin-bottom:20px">NY MATCH</div>`
    : `<h2 style="font-size:20px;font-weight:normal;letter-spacing:0.5px;margin-bottom:24px">Starta ny match</h2>`;
  html += `<div style="padding-top:${ongoingGames.length>0?"8px":"0"}">
    <div style="border-top:1px solid var(--divider);padding:28px 0 20px">
      ${newGameHeading}`;

  const lastSrcNames = new Set(lastSrc?.players.map(p => p.name.toLowerCase()) || []);
  const lastSrcHasOngoing = lastSrc && ongoingGames.some(g => {
    const s = new Set(g.players.map(p => p.name.toLowerCase()));
    return s.size === lastSrcNames.size && [...lastSrcNames].every(n => s.has(n));
  });
  if (lastSrc && setupPlayers.length === 0 && !lastSrcHasOngoing) {
    const names = lastSrc.players.map(p => p.name).join(", ");
    html += `<button class="btn" onclick="loadLastGamePlayers()"
      style="width:100%;padding:14px;margin-bottom:20px;border-color:rgba(26,23,20,0.18);font-size:16px;text-align:left;border-radius:10px">
      ↩ Samma spelare som senast
      <div style="font-size:13px;color:var(--muted);margin-top:3px;font-weight:normal">${names}</div>
    </button>`;
  }

  html += `<div style="margin-bottom:24px">
      <div style="font-size:12px;letter-spacing:2px;color:var(--muted);margin-bottom:14px">LÄGG TILL SPELARE</div>
      <div style="display:flex;gap:10px;align-items:flex-end">
        <input type="text" id="new-player-input" placeholder="Namn…" style="flex:1" onkeydown="if(event.key==='Enter')addPlayerFromInput()">
        <button class="btn" onclick="addPlayerFromInput()" style="padding:8px 18px;white-space:nowrap;border-color:rgba(26,23,20,0.22);margin-bottom:1px">+ Lägg till</button>
      </div>
    </div>`;

  if (savedPlayers.length > 0) {
    html += `<div style="margin-bottom:24px">
      <div style="font-size:12px;letter-spacing:2px;color:var(--muted);margin-bottom:12px">SPARADE SPELARE</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">`;
    savedPlayers.forEach(sp => {
      const already = setupPlayers.find(p=>p.name===sp.name);
      html += `<button class="chip" onclick="addSavedPlayer('${sp.name}')"
        style="color:${already?"#3d6b45":"rgba(26,23,20,0.68)"};border-color:${already?"rgba(61,107,69,0.45)":"rgba(26,23,20,0.12)"};background:${already?"rgba(61,107,69,0.1)":"transparent"}">
        ${already?"✓ ":""}${sp.name}${sp.wins>0?`<span style="opacity:0.45;font-size:13px;margin-left:2px">${sp.wins}🏆</span>`:""}
      </button>`;
    });
    html += `</div></div>`;
  }

  if (setupPlayers.length > 0) {
    let orderRows = "";
    setupPlayers.forEach((p,i) => {
      const color = PLAYER_COLORS[i];
      const isFirst = i === 0, isLast = i === setupPlayers.length - 1;
      orderRows += `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--divider)">
        <div style="font-size:14px;color:var(--muted);width:20px;flex-shrink:0">${i+1}.</div>
        <div style="flex:1;color:${color}">${p.name}${i===0?`<span style="font-size:12px;color:${color};opacity:0.55;margin-left:8px">blandar först</span>`:""}</div>
        <div style="display:flex;gap:4px">
          <button class="btn" onclick="moveSetupPlayerUp('${p.name}')" ${isFirst?"disabled":""} style="padding:4px 10px;font-size:16px;min-height:36px">↑</button>
          <button class="btn" onclick="moveSetupPlayerDown('${p.name}')" ${isLast?"disabled":""} style="padding:4px 10px;font-size:16px;min-height:36px">↓</button>
          <button class="btn" onclick="removeSetupPlayer('${p.name}')" style="padding:4px 10px;font-size:15px;min-height:36px;color:var(--muted)">✕</button>
        </div>
      </div>`;
    });
    html += `<div style="margin-bottom:24px">
      <div style="font-size:12px;letter-spacing:2px;color:var(--muted);margin-bottom:4px">SPELORDNING</div>
      <div>${orderRows}</div>
    </div>`;
  }

  const setupNames = new Set(setupPlayers.map(p => p.name.toLowerCase()));
  const isDuplicate = setupPlayers.length >= 2 && ongoingGames.some(g => {
    const s = new Set(g.players.map(p => p.name.toLowerCase()));
    return s.size === setupNames.size && [...setupNames].every(n => s.has(n));
  });
  if (isDuplicate) {
    html += `<div style="padding:10px 14px;background:rgba(212,168,67,0.08);border:1px solid rgba(212,168,67,0.3);border-radius:6px;color:#9e7820;font-size:15px;margin-bottom:16px">⚠️ En match med dessa spelare pågår redan!</div>`;
  }
  html += `<button class="btn" onclick="startGame()" ${isDuplicate||setupPlayers.length<2?"disabled":""}
    style="padding:15px;background:${setupPlayers.length>=2&&!isDuplicate?"#c9622f":"rgba(26,23,20,0.07)"};border:none;color:#fff;font-size:17px;font-weight:600;width:100%;border-radius:10px">
    Starta match
  </button></div></div>`;

  const lastMod = new Date(document.lastModified);
  if (!isNaN(lastMod.getTime())) {
    const deployStr = lastMod.toLocaleString('sv-SE', {year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
    html += `<div style="text-align:center;padding:24px 0 4px;font-size:12px;color:var(--dim)">Publicerad ${deployStr}</div>`;
  }

  document.getElementById("view-home").innerHTML = html;
}

function addPlayerFromInput() {
  const input = document.getElementById("new-player-input");
  const name = input?.value?.trim();
  if (!name) return;
  if (setupPlayers.find(p=>p.name.toLowerCase()===name.toLowerCase())) { notify("Spelaren finns redan!", "warn"); return; }
  setupPlayers.push({ name, id: String(Date.now()+Math.random()) });
  if (input) input.value = "";
  renderHome();
}

function addSavedPlayer(name) {
  if (setupPlayers.find(p=>p.name===name)) return;
  const sp = savedPlayers.find(p=>p.name===name);
  if (sp) setupPlayers.push({ name:sp.name, id:sp.id });
  renderHome();
}

function removeSetupPlayer(name) {
  setupPlayers = setupPlayers.filter(p=>p.name!==name);
  renderHome();
}

function moveSetupPlayerUp(name) {
  const i = setupPlayers.findIndex(p=>p.name===name);
  if (i <= 0) return;
  [setupPlayers[i-1], setupPlayers[i]] = [setupPlayers[i], setupPlayers[i-1]];
  renderHome();
}

function moveSetupPlayerDown(name) {
  const i = setupPlayers.findIndex(p=>p.name===name);
  if (i < 0 || i >= setupPlayers.length-1) return;
  [setupPlayers[i], setupPlayers[i+1]] = [setupPlayers[i+1], setupPlayers[i]];
  renderHome();
}

function switchToGame(id) {
  setActiveGame(id);
  showView("game");
}

function loadLastGamePlayers() {
  const src = allGames.length > 0
    ? allGames[allGames.length - 1]
    : (ongoingGames.length > 0 ? ongoingGames[0] : null);
  if (!src) return;
  setupPlayers = src.players.map(p => ({
    name: p.name,
    id: p.id || String(Date.now() + Math.random())
  }));
  renderHome();
}

// ─── GAME VIEW ────────────────────────────────────────────────────────────────
function renderTurnGoal(round) {
  const goal = TURN_GOALS[round - 1];
  if (!goal) return "";
  const diffColor = round <= 4 ? "#2c5f8a" : round <= 8 ? "#9e7820" : round <= 12 ? "#c9622f" : "#8b3a6b";

  function miniCard(value, suit) {
    const isJoker = suit === "★";
    const isRed   = suit === "♥" || suit === "♦";
    const fgColor  = isJoker ? "#7b2fff" : isRed ? "#cc2233" : "#0d0d20";
    return `<div style="width:24px;height:34px;background:#fff;border-radius:3px;display:inline-flex;flex-direction:column;justify-content:space-between;padding:2px 2px 3px;box-shadow:0 1px 4px rgba(0,0,0,0.45);vertical-align:middle">
      <div style="font-size:10px;line-height:1;color:${fgColor};font-weight:bold;font-family:monospace">${value}</div>
      <div style="font-size:13px;line-height:1;color:${fgColor};text-align:center">${suit}</div>
    </div>`;
  }

  let handsHtml = `<div style="display:flex;flex-wrap:wrap;align-items:flex-start;gap:10px;justify-content:center;margin-top:10px">`;
  goal.hands.forEach((hand, hi) => {
    const note = goal.extra && goal.extra[hi];
    handsHtml += `<div style="display:flex;flex-direction:column;align-items:center;gap:4px">`;
    handsHtml += `<div style="display:flex;gap:3px;align-items:center">`;
    hand.forEach(([value, suit]) => { handsHtml += miniCard(value, suit); });
    handsHtml += `</div>`;
    if (note) handsHtml += `<div style="font-size:12px;color:rgba(26,23,20,0.5);letter-spacing:1px">${note}</div>`;
    handsHtml += `</div>`;
    if (hi < goal.hands.length - 1)
      handsHtml += `<div style="font-size:20px;color:rgba(26,23,20,0.42);align-self:center;line-height:1">+</div>`;
  });
  handsHtml += `</div>`;

  const footerHtml = goal.footer
    ? `<div style="margin-top:12px;font-size:13px;color:#c9622f;letter-spacing:2px;font-weight:bold">${goal.footer}</div>`
    : "";

  return `<div class="panel" style="padding:16px 20px;margin-bottom:4px;text-align:center;border-color:${diffColor}33;background:${diffColor}09">
    <div style="margin-bottom:2px"><span style="font-size:15px;color:rgba(26,23,20,0.5);font-style:italic">${TURN_DESCRIPTIONS[round-1]}</span></div>
    ${handsHtml}
    ${footerHtml}
  </div>`;
}

function buildBuyDotsHtml(idx, animateSlot = -1) {
  const p = currentGame.players[idx];
  const rb = p.buys[currentGame.currentRound - 1] || 0;
  const winnerChosen = goesOutIdx !== null;
  let dots = "";
  for (let b = 0; b < MAX_BUYS; b++) {
    const filled = b < rb;
    const action = filled ? `removeBuy(${idx})` : `addBuy(${idx})`;
    const disabled = winnerChosen || (!filled && rb >= MAX_BUYS);
    const anim = (filled && b === animateSlot) ? ";animation:dotPop 0.3s ease" : "";
    dots += `<button onclick="${action}" ${disabled ? "disabled" : ""} style="width:40px;height:40px;border-radius:50%;border:none;padding:0;display:flex;align-items:center;justify-content:center;background:transparent;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;flex-shrink:0">
      <div style="width:16px;height:16px;border-radius:50%;background:${filled ? PLAYER_COLORS[idx] : "rgba(26,23,20,0.14)"}${anim}"></div>
    </button>`;
  }
  return `<div id="buy-dots-${idx}" style="display:flex;gap:0;align-items:center;width:144px;justify-content:flex-end">${dots}</div>`;
}

function renderGame() {
  if (lastFinishedGame || !currentGame || currentGame.finished) {
    renderFinished(); return;
  }
  const el = document.getElementById("view-game");

  // Mini standings for header
  const miniStandings = [...currentGame.players]
    .map((p, i) => ({ p, i, t: totalScore(p) }))
    .sort((a, b) => a.t - b.t)
    .map(({ p, i, t }) =>
      `<div style="display:flex;align-items:baseline;gap:6px;justify-content:flex-end">
        <span style="font-size:13px;color:${PLAYER_COLORS[i]};font-weight:600">${p.name}</span>
        <span style="font-family:Georgia,serif;font-size:17px;color:${PLAYER_COLORS[i]}">${t}</span>
      </div>`
    ).join("");

  const winnerChosen = goesOutIdx !== null;
  const allScoresFilled = winnerChosen && currentGame.players.every((_,i) =>
    i===goesOutIdx || (roundInputs[i]!==undefined && roundInputs[i]!==""));

  const dealerIdx = (currentGame.currentRound - 1) % currentGame.players.length;

  // Player rows — always two-line structure (no layout shift when winner changes)
  let playerRows = "";
  currentGame.players.forEach((p,i) => {
    const rb = p.buys[currentGame.currentRound-1]||0;
    const isOut = goesOutIdx===i;
    const curScore = parseInt(roundInputs[i])||0;
    const buyBtns = buildBuyDotsHtml(i);
    const dealerArrow = i === dealerIdx
      ? `<span style="font-size:14px;color:${PLAYER_COLORS[i]};opacity:0.55;margin-left:6px;flex-shrink:0">←</span>`
      : "";

    let rightSide;
    if (!winnerChosen) {
      rightSide = buyBtns;
    } else if (isOut) {
      rightSide = `<div style="color:#3d6b45;font-size:14px;font-weight:600;flex-shrink:0;width:144px;text-align:right;padding-right:4px">✓ 0 p</div>`;
    } else {
      rightSide = `<div style="display:flex;align-items:center;gap:6px;flex-shrink:0;width:144px;animation:scoreIn 0.18s ease">
        <button class="btn" id="score-minus-${i}" onclick="adjustScore(${i},-5)" ${curScore<=5?"disabled":""}
          style="padding:0;font-size:22px;width:40px;height:40px">−</button>
        <input type="tel" inputmode="numeric" placeholder="—" value="${roundInputs[i]??""}"
          oninput="roundInputs[${i}]=this.value;updateScoreMinus(${i});updateSubmitButton()"
          id="score-input-${i}"
          style="font-family:Georgia,serif;font-size:22px;text-align:center;width:52px;padding:4px 2px;border-bottom:2px solid ${PLAYER_COLORS[i]}">
        <button class="btn" onclick="adjustScore(${i},5)"
          style="padding:0;font-size:22px;width:40px;height:40px">+</button>
      </div>`;
    }

    const buyCountHtml = rb > 0 ? `<div style="font-size:12px;color:var(--muted);margin-top:2px">${rb} köp</div>` : "";
    playerRows += `<div style="padding:14px 0;border-bottom:1px solid var(--divider)">
      <div style="display:flex;align-items:center;gap:8px">
        <button onclick="setGoesOut(${isOut ? "null" : i})"
          style="flex:1;min-width:0;text-align:left;background:transparent;border:none;padding:0;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation">
          <div style="display:flex;align-items:baseline;gap:0;overflow:hidden">
            ${isOut ? `<span style="font-size:14px;color:#3d6b45;margin-right:6px;flex-shrink:0">✓</span>` : ""}
            <div style="font-size:20px;font-weight:600;color:${PLAYER_COLORS[i]};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</div>
            ${dealerArrow}
          </div>
          ${buyCountHtml}
        </button>
        ${rightSide}
      </div>
    </div>`;
  });

  let switcherHtml = "";
  if (ongoingGames.length > 1) {
    let switchBtns = "";
    ongoingGames.forEach(g => {
      const isA = g.id === activeGameId;
      switchBtns += `<button class="btn" onclick="switchToGame('${g.id}')" style="padding:6px 14px;font-size:14px;color:${isA?"#c9622f":"rgba(26,23,20,0.55)"};border-color:${isA?"rgba(201,98,47,0.4)":"rgba(26,23,20,0.12)"}">${g.players.map(p=>p.name).join(" & ")}</button>`;
    });
    switcherHtml = `<div style="padding:14px 0;border-bottom:1px solid var(--divider);margin-bottom:28px"><div style="font-size:12px;letter-spacing:2px;color:var(--muted);margin-bottom:10px">BYT MATCH</div><div style="display:flex;flex-wrap:wrap;gap:8px">${switchBtns}</div></div>`;
  }

  el.innerHTML = `${switcherHtml}
    <div id="round-header" style="display:flex;align-items:center;justify-content:space-between;padding:20px 0 16px;border-bottom:1px solid var(--divider)">
      <div>
        <div style="font-size:12px;letter-spacing:3px;color:var(--muted)">OMGÅNG</div>
        <div style="font-family:Georgia,serif;font-size:46px;line-height:1;margin:2px 0">${currentGame.currentRound} <span style="font-size:20px;color:var(--muted)">/ ${TOTAL_ROUNDS}</span></div>
      </div>
      <div onclick="openStandingsSheet()" style="display:flex;flex-direction:column;gap:4px;align-items:flex-end;cursor:pointer">
        ${miniStandings}
        <div style="font-size:11px;color:var(--dim);margin-top:6px;letter-spacing:1px">STÄLLNING ›</div>
      </div>
    </div>
    ${renderTurnGoal(currentGame.currentRound)}
    <div style="padding:4px 0 0">
      <div>${playerRows}</div>
      <div id="submit-btn-container">${submitBtnHtml(allScoresFilled, currentGame.currentRound)}</div>
    </div>
    ${(() => {
      if (!isLocalhost()) return "";
      const completed = currentGame.players[0]?.scores.length || 0;
      return `<div style="margin-top:48px;padding:12px 14px;border:1px dashed rgba(26,23,20,0.13);border-radius:8px">
        <div style="font-size:10px;letter-spacing:3px;color:rgba(26,23,20,0.3);margin-bottom:10px">DEV</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          <button class="btn" onclick="devClearLatestRound()" ${completed===0?"disabled":""}
            style="padding:7px 14px;font-size:13px;color:rgba(26,23,20,0.5)">
            ↩ Ångra omgång ${completed || "—"}
          </button>
          <button class="btn" onclick="devClearAllRounds()" ${completed===0?"disabled":""}
            style="padding:7px 14px;font-size:13px;color:rgba(26,23,20,0.5)">
            ✕ Nollställ alla omgångar
          </button>
        </div>
      </div>`;
    })()}`;
}

function renderFinished() {
  const game = lastFinishedGame || (currentGame?.finished ? currentGame : null);
  if (!game) { showView("home"); return; }
  const sorted = [...game.players].sort((a,b)=>totalScore(a)-totalScore(b));
  const winner = sorted[0];
  const winnerIdx = game.players.findIndex(x=>x.name===winner.name);
  const winnerColor = PLAYER_COLORS[winnerIdx];
  const margin = sorted[1] ? totalScore(sorted[1]) - totalScore(winner) : 0;
  let rows = "";
  sorted.forEach((p,rank) => {
    const i = game.players.findIndex(x=>x.name===p.name);
    rows += `<div style="display:flex;align-items:center;padding:12px 0;border-bottom:1px solid var(--divider)">
      <div style="width:24px;font-size:15px;flex-shrink:0;color:var(--muted)">${rank+1}.</div>
      <div style="flex:1;color:${PLAYER_COLORS[i]};font-size:18px">${p.name}</div>
      <div style="text-align:right">
        <div style="font-family:Georgia,serif;font-size:24px;color:${PLAYER_COLORS[i]}">${totalScore(p)}</div>
        <div style="font-size:12px;color:var(--muted)">${totalBuys(p)} köp</div>
      </div>
    </div>`;
  });
  document.getElementById("view-game").innerHTML = `
    <div style="animation:fadeIn 0.3s ease">
      <div style="text-align:center;padding:48px 0 28px;border-bottom:1px solid var(--divider)">
        <div style="font-size:48px;margin-bottom:14px">🏆</div>
        <div style="font-family:Georgia,serif;font-size:34px;color:${winnerColor};margin-bottom:6px">${winner.name}</div>
        <div style="font-size:14px;color:var(--muted)">${game.date}${margin>0?` · vann med ${margin} p`:""}</div>
      </div>
      <div>${rows}</div>
      <div style="padding:24px 0;border-bottom:1px solid var(--divider)">
        <textarea id="game-note-input" placeholder="Skriv ett notat om matchen…"
          style="width:100%;min-height:72px;background:transparent;border:none;border-bottom:1px solid rgba(26,23,20,0.2);
                 color:var(--fg);font-family:inherit;padding:8px 0;font-size:16px;outline:none;resize:vertical">${game.note||""}</textarea>
        <button class="btn" onclick="saveGameNote(document.getElementById('game-note-input').value)"
          style="margin-top:12px;padding:10px 20px;border-color:rgba(61,107,69,0.35);color:#3d6b45;font-size:15px;border-radius:8px">
          Spara notat
        </button>
      </div>
      <div style="padding:24px 0">
        <button class="btn" onclick="lastFinishedGame=null;showView('home')"
          style="width:100%;padding:16px;background:#c9622f;border:none;color:#fff;font-size:17px;font-weight:600;border-radius:10px">
          Ny match
        </button>
      </div>
    </div>`;
}

// ─── STATS VIEW ───────────────────────────────────────────────────────────────
function renderStats() {
  const stats = getStats().filter(s=>s.gamesPlayed>0);
  let html = `<div style="padding:28px 0 0;font-size:12px;letter-spacing:4px;color:var(--muted)">STATISTIK</div>`;
  html += renderRoundBreakdownChart();

  if (allGames.length===0) {
    html += `<div style="text-align:center;color:var(--muted);padding:60px 20px">Inga avslutade matcher ännu</div>`;
  } else {

    // ── Per-player extra stats ──────────────────────────────────────────────
    const extraStats = {};
    savedPlayers.forEach(p => {
      const pg = allGames.filter(g => g.players.find(gp => gp.name === p.name));
      const allScores = pg.flatMap(g => { const gp = g.players.find(x => x.name === p.name); return gp ? gp.scores : []; });
      const nonZero = allScores.filter(s => s > 0);
      const gameTotals = pg.map(g => { const gp = g.players.find(x => x.name === p.name); return gp ? totalScore(gp) : 0; });
      extraStats[p.name] = {
        highestRound: nonZero.length ? Math.max(...nonZero) : 0,
        highestTotal: gameTotals.length ? Math.max(...gameTotals) : 0,
        zeroRounds:   allScores.filter(s => s === 0).length,
      };
    });

    // ── All-time leaderboard ────────────────────────────────────────────────
    let lbRows = "";
    stats.forEach((s,i) => {
      const idx = savedPlayers.findIndex(p=>p.name===s.name);
      const color = PLAYER_COLORS[idx%PLAYER_COLORS.length];
      const medal = i===0?"👑":i===1?"🥈":i===2?"🥉":`${i+1}.`;
      const wr = Math.round(s.wins/s.gamesPlayed*100);
      const ex = extraStats[s.name]||{};
      lbRows += `<div style="padding:16px 0;border-bottom:1px solid var(--divider)">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="font-size:17px;width:22px;flex-shrink:0;text-align:center">${medal}</div>
          <div style="flex:1">
            <div style="color:${color};margin-bottom:3px">${s.name}</div>
            <div style="font-size:14px;color:var(--muted)">${s.gamesPlayed} matcher · ${wr}% vinster · ${s.totalBuys} köp</div>
          </div>
          <div style="text-align:right">
            <div style="font-family:Georgia,serif;font-size:24px;color:${color}">${s.wins}</div>
            <div style="font-size:13px;color:var(--muted)">⌀ ${s.avgScore} p</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:10px;margin-left:34px">
          <div style="font-size:13px;color:var(--muted)"><div style="font-family:Georgia,serif;font-size:17px;color:var(--fg);margin-bottom:2px">${ex.zeroRounds||0}</div>utgångar</div>
          <div style="font-size:13px;color:var(--muted)"><div style="font-family:Georgia,serif;font-size:17px;color:var(--fg);margin-bottom:2px">${ex.highestRound||'—'}</div>värsta omg.</div>
          <div style="font-size:13px;color:var(--muted)"><div style="font-family:Georgia,serif;font-size:17px;color:var(--fg);margin-bottom:2px">${ex.highestTotal||'—'}</div>värsta match</div>
        </div>
      </div>`;
    });
    html += `<div style="border-top:1px solid var(--divider);padding:28px 0 8px">
      <div style="font-size:12px;letter-spacing:3px;color:var(--muted);margin-bottom:4px">ALLA TIDER</div>
      <div>${lbRows}</div>
    </div>`;

    // ── Top 5 single rounds ─────────────────────────────────────────────────
    const roundEntries = [];
    allGames.forEach(g => {
      g.players.forEach((p,pi) => {
        p.scores.forEach((s,ri) => {
          if (s > 0) roundEntries.push({ name:p.name, score:s, round:ri+1, date:g.date, pi });
        });
      });
    });
    roundEntries.sort((a,b) => b.score - a.score);
    const top5 = roundEntries.slice(0,5);
    if (top5.length > 0) {
      let top5Rows = top5.map((e,i) => {
        const idx = savedPlayers.findIndex(p => p.name === e.name);
        const color = PLAYER_COLORS[(idx>=0?idx:e.pi)%PLAYER_COLORS.length];
        return `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--divider)">
          <div style="width:18px;font-size:13px;color:var(--muted);flex-shrink:0">${i+1}.</div>
          <div style="flex:1;color:${color}">${e.name}</div>
          <div style="font-size:13px;color:var(--muted);margin-right:10px">omg. ${e.round} · ${e.date}</div>
          <div style="font-family:Georgia,serif;font-size:22px;color:${color}">${e.score}</div>
        </div>`;
      }).join("");
      html += `<div style="border-top:1px solid var(--divider);padding:28px 0 8px">
        <div style="font-size:12px;letter-spacing:3px;color:var(--muted);margin-bottom:4px">HÖGST POÄNG I EN OMGÅNG (TOPP 5)</div>
        <div>${top5Rows}</div>
      </div>`;
    }

    // ── Most 0p rounds (going out) ──────────────────────────────────────────
    const zeroRank = stats.map(s => ({
      name: s.name,
      idx: savedPlayers.findIndex(p=>p.name===s.name),
      count: extraStats[s.name]?.zeroRounds||0,
    })).sort((a,b) => b.count - a.count);
    const maxZero = zeroRank[0]?.count||1;
    let zeroRows = zeroRank.map((z,i) => {
      const color = PLAYER_COLORS[(z.idx>=0?z.idx:i)%PLAYER_COLORS.length];
      const barPct = Math.round(z.count/maxZero*100);
      return `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--divider)">
        <div style="flex:1">
          <div style="font-size:16px;color:${color};margin-bottom:5px">${z.name}</div>
          <div style="height:2px;background:var(--divider);border-radius:1px"><div style="height:2px;width:${barPct}%;background:${color};border-radius:1px"></div></div>
        </div>
        <div style="text-align:right;min-width:48px">
          <div style="font-family:Georgia,serif;font-size:22px;color:${color}">${z.count}</div>
          <div style="font-size:12px;color:var(--muted)">utgångar</div>
        </div>
      </div>`;
    }).join("");
    html += `<div style="border-top:1px solid var(--divider);padding:28px 0 8px">
      <div style="font-size:12px;letter-spacing:3px;color:var(--muted);margin-bottom:4px">FLEST UTGÅNGAR</div>
      <div>${zeroRows}</div>
    </div>`;

    // ── Stats by player group ───────────────────────────────────────────────
    const groups = {};
    allGames.forEach(g => {
      const key = [...g.players].map(p=>p.name).sort().join("|");
      if (!groups[key]) groups[key] = [];
      groups[key].push(g);
    });
    let groupHtml = Object.entries(groups)
      .sort((a,b) => b[1].length - a[1].length)
      .map(([key, games]) => {
        const names = key.split("|");
        const groupStats = names.map(name => {
          const wins = games.filter(g => [...g.players].sort((a,b)=>totalScore(a)-totalScore(b))[0].name===name).length;
          const scores = games.map(g => { const gp=g.players.find(p=>p.name===name); return gp?totalScore(gp):null; }).filter(s=>s!==null);
          const avg = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : 0;
          const idx = savedPlayers.findIndex(p=>p.name===name);
          return { name, wins, avg, idx };
        }).sort((a,b)=>b.wins-a.wins);
        const rows = groupStats.map(gs => {
          const color = PLAYER_COLORS[(gs.idx>=0?gs.idx:0)%PLAYER_COLORS.length];
          return `<div style="display:flex;align-items:center;padding:8px 0;border-bottom:1px solid var(--divider)">
            <div style="flex:1;font-size:16px;color:${color}">${gs.name}</div>
            <div style="font-size:14px;color:var(--muted);margin-right:16px">⌀ ${gs.avg} p</div>
            <div style="font-family:Georgia,serif;font-size:20px;color:${color}">${gs.wins} <span style="font-size:13px;font-family:inherit;color:var(--muted)">vinster</span></div>
          </div>`;
        }).join("");
        return `<div style="padding:20px 0;border-bottom:1px solid var(--divider)">
          <div style="font-size:16px;color:var(--fg);margin-bottom:2px">${names.join(" & ")}</div>
          <div style="font-size:13px;color:var(--muted);margin-bottom:12px">${games.length} matcher</div>
          <div>${rows}</div>
        </div>`;
      }).join("");
    html += `<div style="border-top:1px solid var(--divider);padding:28px 0 8px">
      <div style="font-size:12px;letter-spacing:3px;color:var(--muted);margin-bottom:4px">PER SPELARSÄLLSKAP</div>
      <div>${groupHtml}</div>
    </div>`;

    // ── Play dates ──────────────────────────────────────────────────────────
    const dateCounts = {};
    allGames.forEach(g => { if (g.date) dateCounts[g.date] = (dateCounts[g.date]||0)+1; });
    const sortedDates = Object.keys(dateCounts).sort();
    let dateChips = sortedDates.map(d => {
      const count = dateCounts[d];
      const dots = Array(count).fill(`<div style="width:9px;height:9px;border-radius:50%;background:#2c5f8a;opacity:0.85"></div>`).join("");
      return `<div style="display:flex;flex-direction:column;align-items:center;gap:5px">
        <div style="display:flex;gap:3px">${dots}</div>
        <div style="font-size:13px;color:var(--muted);white-space:nowrap">${d}</div>
      </div>`;
    }).join("");
    html += `<div style="border-top:1px solid var(--divider);padding:28px 0">
      <div style="font-size:12px;letter-spacing:3px;color:var(--muted);margin-bottom:16px">SPELDATUM</div>
      <div style="display:flex;flex-wrap:wrap;gap:16px;align-items:flex-end">${dateChips}</div>
    </div>`;

    // ── Weekday distribution ─────────────────────────────────────────────────
    const sweDay = ["Söndag","Måndag","Tisdag","Onsdag","Torsdag","Fredag","Lördag"];
    const dayOrder = [1,2,3,4,5,6,0];
    const startedByDay = Array(7).fill(0), finishedByDay = Array(7).fill(0);
    allGames.forEach(g => {
      if (g.date) startedByDay[new Date(g.date+"T12:00:00").getDay()]++;
      const fd = g.finishedDate || g.date;
      if (fd) finishedByDay[new Date(fd+"T12:00:00").getDay()]++;
    });
    const maxS = Math.max(...startedByDay, 1), maxF = Math.max(...finishedByDay, 1);
    const wdRows = dayOrder.map(d => {
      const s = startedByDay[d], f = finishedByDay[d];
      return `<div style="display:grid;grid-template-columns:36px 1fr 1fr;gap:4px 12px;align-items:center;padding:4px 0">
        <div style="font-size:13px;color:var(--muted)">${sweDay[d].substring(0,3)}</div>
        <div style="position:relative;height:8px;background:var(--divider);border-radius:4px">
          <div style="position:absolute;inset:0;width:${Math.round(s/maxS*100)}%;background:#2c5f8a;border-radius:4px"></div>
          ${s>0?`<span style="position:absolute;left:calc(${Math.round(s/maxS*100)}% + 4px);top:-2px;font-size:11px;color:#2c5f8a;white-space:nowrap">${s}</span>`:""}
        </div>
        <div style="position:relative;height:8px;background:var(--divider);border-radius:4px">
          <div style="position:absolute;inset:0;width:${Math.round(f/maxF*100)}%;background:#3d6b45;border-radius:4px"></div>
          ${f>0?`<span style="position:absolute;left:calc(${Math.round(f/maxF*100)}% + 4px);top:-2px;font-size:11px;color:#3d6b45;white-space:nowrap">${f}</span>`:""}
        </div>
      </div>`;
    }).join("");
    html += `<div style="border-top:1px solid var(--divider);padding:28px 0">
      <div style="font-size:12px;letter-spacing:3px;color:var(--muted);margin-bottom:14px">SPELVECKODAG</div>
      <div style="display:flex;gap:20px;margin-bottom:12px">
        <div style="font-size:12px;color:var(--muted);display:flex;align-items:center;gap:6px"><div style="width:14px;height:8px;background:#2c5f8a;border-radius:2px"></div>Startad</div>
        <div style="font-size:12px;color:var(--muted);display:flex;align-items:center;gap:6px"><div style="width:14px;height:8px;background:#3d6b45;border-radius:2px"></div>Avslutad</div>
      </div>
      <div style="padding-right:32px">${wdRows}</div>
    </div>`;

    // ── Match history ───────────────────────────────────────────────────────
    const reversedGames = [...allGames].reverse();
    const HIST_PREVIEW = 5;
    const mkGameRow = g => {
      const sorted = [...g.players].sort((a,b)=>totalScore(a)-totalScore(b));
      const wi = g.players.findIndex(x=>x.name===sorted[0].name);
      const wc = PLAYER_COLORS[wi%PLAYER_COLORS.length];
      const scores = sorted.map(p => {
        const idx = g.players.findIndex(x=>x.name===p.name);
        return `<span style="color:${PLAYER_COLORS[idx%PLAYER_COLORS.length]}">${p.name} ${totalScore(p)}</span>`;
      }).join(`<span style="color:var(--divider);margin:0 5px">·</span>`);
      return `<div style="padding:14px 0;border-bottom:1px solid var(--divider)">
        <div style="font-size:20px;color:${wc};margin-bottom:3px">👑 ${sorted[0].name}</div>
        <div style="font-size:13px;color:var(--muted)">${g.date}</div>
        ${g.note?`<div style="font-size:15px;color:var(--fg);font-style:italic;padding:5px 0">📝 ${g.note}</div>`:""}
        ${g.playlist?`<a href="${g.playlist}" target="_blank" rel="noopener" style="font-size:13px;color:#1DB954;display:inline-block;margin-bottom:4px">♪ Spellista</a>`:""}
        <div style="font-size:13px;color:var(--muted);margin-top:3px">${scores}</div>
      </div>`;
    };
    let gameRows = "";
    if (historyExpanded) {
      const ymGroups = {};
      reversedGames.forEach(g => {
        const ym = (g.date||"").substring(0,7) || "?";
        if (!ymGroups[ym]) ymGroups[ym] = [];
        ymGroups[ym].push(g);
      });
      Object.entries(ymGroups).forEach(([ym, gs]) => {
        const label = ym.length===7
          ? new Date(ym+"-15").toLocaleString("sv-SE",{year:"numeric",month:"long"})
          : "Okänt datum";
        gameRows += `<div style="font-size:11px;letter-spacing:2px;color:var(--muted);padding:16px 0 2px;text-transform:uppercase">${label}</div>`;
        gs.forEach(g => { gameRows += mkGameRow(g); });
      });
    } else {
      reversedGames.slice(0, HIST_PREVIEW).forEach(g => { gameRows += mkGameRow(g); });
    }
    const expandBtn = allGames.length > HIST_PREVIEW
      ? historyExpanded
        ? `<button class="btn" onclick="historyExpanded=false;renderStats()" style="width:100%;padding:12px;margin-top:6px;font-size:15px;color:var(--muted)">Visa färre ▴</button>`
        : `<button class="btn" onclick="historyExpanded=true;renderStats()" style="width:100%;padding:12px;margin-top:6px;font-size:15px;color:var(--muted)">Visa alla ${allGames.length} matcher ▾</button>`
      : "";
    html += `<div style="border-top:1px solid var(--divider);padding:28px 0 0">
      <div style="font-size:12px;letter-spacing:3px;color:var(--muted);margin-bottom:4px">MATCHHISTORIK</div>
      <div>${gameRows}</div>
      ${expandBtn}
    </div>`;
  }
  html += `<div style="border-top:2px solid var(--divider);margin-top:32px;padding-top:4px">`;
  html += renderPlayersHtml();
  html += `</div>`;
  html += `<div style="border-top:2px solid var(--divider);margin-top:32px;padding-top:4px">`;
  html += renderRoundsHtml();
  html += `</div>`;
  document.getElementById("view-stats").innerHTML = html;
}

function renderPlayersHtml() {
  const stats = getStats();
  let html = `<div style="padding:28px 0 0;font-size:12px;letter-spacing:4px;color:var(--muted)">SPELARE</div>`;
  if (savedPlayers.length===0) {
    html += `<div style="text-align:center;color:var(--muted);padding:60px 20px">Inga sparade spelare ännu</div>`;
  } else {
    savedPlayers.forEach((p,i) => {
      const color = PLAYER_COLORS[i%PLAYER_COLORS.length];
      const s = stats.find(x=>x.name===p.name)||{};
      const wr = p.gamesPlayed>0 ? Math.round(p.wins/p.gamesPlayed*100) : 0;
      html += `<div style="display:flex;align-items:center;gap:16px;padding:16px 0;border-bottom:1px solid var(--divider)">
        <div style="flex:1">
          <div style="font-size:19px;color:${color};margin-bottom:4px">${p.name}</div>
          <div style="font-size:14px;color:var(--muted)">${p.gamesPlayed} matcher · ${p.wins} vinster · ${wr}% wins${s.avgScore!==undefined?` · ⌀ ${s.avgScore} p`:""}</div>
        </div>
      </div>`;
    });
  }
  return html;
}

function renderPlayers() { renderStats(); }

function renderRoundsHtml() {
  const game = currentGame && !currentGame.finished ? currentGame : null;
  const completedRounds = game ? (game.roundWinners || []) : [];
  const currentRound = game ? game.currentRound : null;

  function miniCard(value, suit) {
    const isJoker = suit === "★";
    const isRed   = suit === "♥" || suit === "♦";
    const fgColor  = isJoker ? "#7b2fff" : isRed ? "#cc2233" : "#0d0d20";
    return `<div style="width:20px;height:29px;background:#fff;border-radius:2px;display:inline-flex;flex-direction:column;justify-content:space-between;padding:2px 2px 2px;box-shadow:0 1px 3px rgba(0,0,0,0.4);vertical-align:middle;flex-shrink:0">
      <div style="font-size:9px;line-height:1;color:${fgColor};font-weight:bold;font-family:monospace">${value}</div>
      <div style="font-size:11px;line-height:1;color:${fgColor};text-align:center">${suit}</div>
    </div>`;
  }

  let html = `<div style="padding:28px 0 0;font-size:12px;letter-spacing:4px;color:var(--muted)">OMGÅNGAR</div>`;
  if (game) {
    html += `<div style="font-size:15px;color:var(--muted);padding:8px 0 20px">Omgång ${currentRound} av ${TOTAL_ROUNDS}</div>`;
  } else {
    html += `<div style="font-size:15px;color:var(--muted);padding:8px 0 20px">Alla ${TOTAL_ROUNDS} omgångar</div>`;
  }

  html += `<div style="display:flex;flex-direction:column;gap:10px">`;

  TURN_GOALS.forEach((goal, idx) => {
    const roundNum = idx + 1;
    const isCurrent = currentRound === roundNum;
    const isCompleted = completedRounds.length >= roundNum;
    const isFuture = !isCurrent && !isCompleted;

    const diffColor = roundNum <= 4 ? "#2c5f8a" : roundNum <= 8 ? "#9e7820" : roundNum <= 12 ? "#c9622f" : "#8b3a6b";

    let statusBadge = "";
    if (isCurrent) {
      statusBadge = `<div style="font-size:12px;letter-spacing:2px;color:#c9622f;background:rgba(201,98,47,0.15);border:1px solid rgba(201,98,47,0.35);padding:2px 8px;border-radius:3px;white-space:nowrap">NUVARANDE</div>`;
    } else if (isCompleted) {
      const winnerIdx = completedRounds[idx];
      const winnerName = game && game.players[winnerIdx] ? game.players[winnerIdx].name : null;
      const winnerColor = game && winnerIdx !== undefined ? PLAYER_COLORS[winnerIdx] : "#3d6b45";
      const winnerLabel = winnerName
        ? `<span style="color:${winnerColor}">${winnerName}</span>`
        : `<span style="color:#3d6b45">✓</span>`;
      statusBadge = `<div style="font-size:13px;color:rgba(26,23,20,0.5)">Vinnare: ${winnerLabel}</div>`;
    }

    // Build compact hands display
    let handsHtml = `<div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px">`;
    goal.hands.forEach((hand, hi) => {
      const note = goal.extra && goal.extra[hi];
      handsHtml += `<div style="display:flex;flex-direction:column;align-items:center;gap:2px">`;
      handsHtml += `<div style="display:flex;gap:2px;align-items:center">`;
      hand.forEach(([value, suit]) => { handsHtml += miniCard(value, suit); });
      handsHtml += `</div>`;
      if (note) handsHtml += `<div style="font-size:11px;color:rgba(26,23,20,0.45)">${note}</div>`;
      handsHtml += `</div>`;
      if (hi < goal.hands.length - 1)
        handsHtml += `<div style="font-size:16px;color:rgba(26,23,20,0.38);line-height:1">+</div>`;
    });
    handsHtml += `</div>`;
    handsHtml += `<div style="margin-top:6px;font-size:14px;color:rgba(26,23,20,0.55)">${TURN_DESCRIPTIONS[idx]}</div>`;
    if (goal.footer)
      handsHtml += `<div style="margin-top:4px;font-size:12px;color:#c9622f;letter-spacing:1px">${goal.footer}</div>`;

    const opacity = isFuture && game ? "opacity:0.45;" : "";
    const borderColor = isCurrent ? "#c9622f88" : isCompleted ? "#3d6b4544" : `${diffColor}33`;
    const bgColor = isCurrent ? "rgba(201,98,47,0.07)" : isCompleted ? "rgba(61,107,69,0.06)" : `${diffColor}08`;

    html += `<div class="panel" style="padding:14px 18px;${opacity}border-color:${borderColor};background:${bgColor}">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:8px;min-width:90px">
          <div style="font-size:13px;color:${diffColor};letter-spacing:2px;white-space:nowrap">OMG ${roundNum}</div>
          <div style="font-size:18px;line-height:1">${goal.emoji}</div>
        </div>
        <div style="flex:1;min-width:0">${handsHtml}</div>
        <div style="text-align:right">${statusBadge}</div>
      </div>
    </div>`;
  });

  html += `</div>`;
  return html;
}
