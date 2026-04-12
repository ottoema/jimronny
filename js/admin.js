// ─── ADMIN VIEW ───────────────────────────────────────────────────────────────
// Lists all games and players with delete controls.
// Only reachable when authenticated (nav button is hidden otherwise).
//
// Rules enforced here:
//  - Finished games can only be deleted in their entirety (no per-round delete).
//  - Ongoing games allow round deletion, but only the last round (descending order).
//  - A player cannot be deleted while they have any game (finished or ongoing).

let adminExpandedGame = null; // game id whose rounds are shown

function renderAdmin() {
  const el = document.getElementById("view-admin");
  if (!isAuthenticated) {
    el.innerHTML = `<div style="padding:40px 0;text-align:center;color:var(--muted)">Logga in för att öppna admin.</div>`;
    return;
  }

  let html = `<div style="padding:28px 0 0;font-size:12px;letter-spacing:4px;color:var(--muted)">ADMIN</div>`;

  // ── Finished games ─────────────────────────────────────────────────────────
  html += `<div style="border-top:1px solid var(--divider);margin-top:16px;padding:20px 0 8px">
    <div style="font-size:12px;letter-spacing:3px;color:var(--muted);margin-bottom:12px">AVSLUTADE MATCHER (${allGames.length})</div>`;

  if (allGames.length === 0) {
    html += `<div style="color:var(--muted);font-size:15px;padding-bottom:8px">Inga avslutade matcher.</div>`;
  } else {
    [...allGames].reverse().forEach(game => {
      const playerNames = game.players.map(p => p.name).join(", ");
      const winner = [...game.players].sort((a,b) =>
        a.scores.reduce((s,x)=>s+x,0) - b.scores.reduce((s,x)=>s+x,0)
      )[0];
      const numRounds = game.players[0]?.scores?.length ?? 0;

      html += `<div style="border-bottom:1px solid var(--divider);padding:14px 0">
        <div style="display:flex;align-items:flex-start;gap:10px">
          <div style="flex:1">
            <div style="font-size:15px;margin-bottom:2px">${playerNames}</div>
            <div style="font-size:13px;color:var(--muted)">${game.date}${winner ? ` · Vinnare: ${winner.name}` : ""} · ${numRounds} omg.</div>
            ${game.note ? `<div style="font-size:13px;color:var(--dim);margin-top:2px">${game.note}</div>` : ""}
          </div>
          <button class="btn" onclick="adminDeleteGame('${game.id}')"
            style="padding:4px 10px;font-size:13px;color:#c9622f;border-color:rgba(201,98,47,0.3);flex-shrink:0;margin-top:2px">
            Ta bort
          </button>
        </div>
      </div>`;
    });
  }
  html += `</div>`;

  // ── Ongoing games ──────────────────────────────────────────────────────────
  html += `<div style="border-top:1px solid var(--divider);padding:20px 0 8px">
    <div style="font-size:12px;letter-spacing:3px;color:var(--muted);margin-bottom:12px">PÅGÅENDE MATCHER (${ongoingGames.length})</div>`;

  if (ongoingGames.length === 0) {
    html += `<div style="color:var(--muted);font-size:15px;padding-bottom:8px">Inga pågående matcher.</div>`;
  } else {
    ongoingGames.forEach(game => {
      const playerNames = game.players.map(p => p.name).join(", ");
      const numRounds = game.players[0]?.scores?.length ?? 0;
      const expanded = adminExpandedGame === game.id;

      html += `<div style="border-bottom:1px solid var(--divider);padding:14px 0">
        <div style="display:flex;align-items:flex-start;gap:10px">
          <div style="flex:1">
            <div style="font-size:15px;margin-bottom:2px">${playerNames}</div>
            <div style="font-size:13px;color:var(--muted)">${game.date} · Omgång ${game.currentRound} / ${TOTAL_ROUNDS} · ${numRounds} registrerade</div>
          </div>
          <div style="display:flex;gap:8px;flex-shrink:0;margin-top:2px">
            ${numRounds > 0 ? `<button class="btn" onclick="adminToggleRounds('${game.id}')"
              style="padding:4px 10px;font-size:13px;color:var(--muted)">
              ${expanded ? "▲ Dölj" : "▼ Omgångar"}
            </button>` : ""}
          </div>
        </div>`;

      if (expanded && numRounds > 0) {
        html += `<div style="margin-top:12px;background:rgba(26,23,20,0.03);border-radius:8px;padding:10px 12px">
          <div style="font-size:12px;letter-spacing:2px;color:var(--muted);margin-bottom:8px">OMGÅNGAR — endast sista kan tas bort</div>`;
        for (let ri = 0; ri < numRounds; ri++) {
          const roundNum = ri + 1;
          const isLast = ri === numRounds - 1;
          const scores = game.players.map(p => `${p.name}: ${p.scores[ri]}`).join(" · ");
          html += `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(26,23,20,0.06)">
            <div style="font-size:13px;color:var(--muted);width:22px;flex-shrink:0">${roundNum}.</div>
            <div style="flex:1;font-size:13px">${scores}</div>
            ${isLast
              ? `<button class="btn" onclick="adminDeleteRound('${game.id}', ${ri})"
                  style="padding:2px 8px;font-size:12px;color:#c9622f;border-color:rgba(201,98,47,0.3);flex-shrink:0">
                  Ta bort
                </button>`
              : `<div style="width:60px;flex-shrink:0"></div>`
            }
          </div>`;
        }
        html += `</div>`;
      }

      html += `</div>`;
    });
  }
  html += `</div>`;

  // ── Players ────────────────────────────────────────────────────────────────
  html += `<div style="border-top:1px solid var(--divider);padding:20px 0 8px">
    <div style="font-size:12px;letter-spacing:3px;color:var(--muted);margin-bottom:12px">SPELARE (${savedPlayers.length})</div>`;

  if (savedPlayers.length === 0) {
    html += `<div style="color:var(--muted);font-size:15px">Inga spelare.</div>`;
  } else {
    savedPlayers.forEach((p, i) => {
      const color = PLAYER_COLORS[i % PLAYER_COLORS.length];
      const inFinished = allGames.some(g => g.players.find(gp => gp.name === p.name));
      const inOngoing  = ongoingGames.some(g => g.players.find(gp => gp.name === p.name));
      const hasGames = inFinished || inOngoing;
      const reason = inFinished && inOngoing ? "avslutade och pågående matcher"
                   : inFinished ? "avslutade matcher"
                   : "en pågående match";

      html += `<div style="display:flex;align-items:center;gap:10px;padding:12px 0;border-bottom:1px solid var(--divider)">
        <div style="width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0"></div>
        <div style="flex:1">
          <div style="font-size:15px">${p.name}</div>
          <div style="font-size:13px;color:var(--muted)">${p.gamesPlayed || 0} matcher · ${p.wins || 0} vinster</div>
          ${hasGames ? `<div style="font-size:12px;color:var(--dim);margin-top:1px">Ta bort ${reason} först</div>` : ""}
        </div>
        <button class="btn" onclick="adminDeletePlayer('${p.id}', '${p.name}')"
          style="padding:4px 10px;font-size:13px;flex-shrink:0;
            ${hasGames
              ? "color:rgba(26,23,20,0.25);border-color:rgba(26,23,20,0.1);pointer-events:none"
              : "color:#c9622f;border-color:rgba(201,98,47,0.3)"}"
          ${hasGames ? "disabled" : ""}>
          Ta bort
        </button>
      </div>`;
    });
  }
  html += `</div>`;

  el.innerHTML = html;
}

function adminToggleRounds(gameId) {
  adminExpandedGame = adminExpandedGame === gameId ? null : gameId;
  renderAdmin();
}

async function adminDeleteGame(gameId) {
  const game = allGames.find(g => g.id === gameId);
  if (!game) return;
  const names = game.players.map(p => p.name).join(", ");
  if (!confirm(`Ta bort matchen från ${game.date} (${names})?\n\nDetta går inte att ångra och påverkar spelarstatistiken.`)) return;

  try {
    await apiPost("/adminDelete", { type: "game", id: gameId });
    allGames = allGames.filter(g => g.id !== gameId);
    lsave("gin_all_games", allGames);
    await refreshPlayersFromBackend();
    notify("Matchen borttagen ✓", "success");
    renderAdmin();
  } catch(e) {
    notify("Kunde inte ta bort matchen: " + e.message, "warn");
  }
}

async function adminDeleteRound(gameId, roundIndex) {
  const game = ongoingGames.find(g => g.id === gameId);
  if (!game) return;
  const numRounds = game.players[0]?.scores?.length ?? 0;
  if (roundIndex !== numRounds - 1) {
    notify("Endast sista omgången kan tas bort.", "warn");
    return;
  }
  const roundNum = roundIndex + 1;
  if (!confirm(`Ta bort omgång ${roundNum} från matchen ${game.date}?`)) return;

  try {
    await apiPost("/adminDelete", { type: "round", gameId, roundIndex });
    game.players = game.players.map(p => ({
      ...p,
      scores: p.scores.slice(0, -1),
      buys:   (p.buys || []).slice(0, -1),
    }));
    if (Array.isArray(game.roundWinners)) game.roundWinners = game.roundWinners.slice(0, -1);
    game.currentRound = game.players[0].scores.length + 1;
    lsave("gin_ongoing_games", ongoingGames);
    // Keep currentGame in sync if this is the active game.
    if (activeGameId === gameId) currentGame = game;
    notify(`Omgång ${roundNum} borttagen ✓`, "success");
    renderAdmin();
  } catch(e) {
    notify("Kunde inte ta bort omgången: " + e.message, "warn");
  }
}

async function adminDeletePlayer(playerId, playerName) {
  const inFinished = allGames.some(g => g.players.find(p => p.name === playerName));
  const inOngoing  = ongoingGames.some(g => g.players.find(p => p.name === playerName));
  if (inFinished || inOngoing) {
    notify("Ta bort alla matcher för spelaren innan spelaren kan tas bort.", "warn");
    return;
  }
  if (!confirm(`Ta bort spelare "${playerName}"?`)) return;

  try {
    await apiPost("/adminDelete", { type: "player", id: playerId });
    savedPlayers = savedPlayers.filter(p => p.id !== playerId);
    lsave("gin_players", savedPlayers);
    notify(`${playerName} borttagen ✓`, "success");
    renderAdmin();
  } catch(e) {
    notify("Kunde inte ta bort spelare: " + e.message, "warn");
  }
}

async function refreshPlayersFromBackend() {
  try {
    const data = await apiGet("/getPlayers");
    if (data.players?.length > 0) {
      savedPlayers = data.players;
      lsave("gin_players", savedPlayers);
    }
  } catch(e) {
    // Non-fatal — local state is still correct enough.
  }
}
