// ─── ADMIN VIEW ───────────────────────────────────────────────────────────────
// Lists all games and players with delete controls.
// Only reachable when authenticated (nav button is hidden otherwise).

let adminExpandedGame = null; // game id whose rounds are shown

function renderAdmin() {
  const el = document.getElementById("view-admin");
  if (!isAuthenticated) {
    el.innerHTML = `<div style="padding:40px 0;text-align:center;color:var(--muted)">Logga in för att öppna admin.</div>`;
    return;
  }

  let html = `<div style="padding:28px 0 0;font-size:12px;letter-spacing:4px;color:var(--muted)">ADMIN</div>`;

  // ── Games ──────────────────────────────────────────────────────────────────
  html += `<div style="border-top:1px solid var(--divider);margin-top:16px;padding:20px 0 8px">
    <div style="font-size:12px;letter-spacing:3px;color:var(--muted);margin-bottom:12px">MATCHER (${allGames.length})</div>`;

  if (allGames.length === 0) {
    html += `<div style="color:var(--muted);font-size:15px">Inga avslutade matcher.</div>`;
  } else {
    const sorted = [...allGames].reverse();
    sorted.forEach(game => {
      const playerNames = game.players.map(p => p.name).join(", ");
      const winner = [...game.players].sort((a,b) =>
        a.scores.reduce((s,x)=>s+x,0) - b.scores.reduce((s,x)=>s+x,0)
      )[0];
      const expanded = adminExpandedGame === game.id;
      const numRounds = game.players[0]?.scores?.length ?? 0;

      html += `<div style="border-bottom:1px solid var(--divider);padding:14px 0">
        <div style="display:flex;align-items:flex-start;gap:10px">
          <div style="flex:1">
            <div style="font-size:15px;margin-bottom:2px">${playerNames}</div>
            <div style="font-size:13px;color:var(--muted)">${game.date}${winner ? ` · Vinnare: ${winner.name}` : ""} · ${numRounds} omg.</div>
            ${game.note ? `<div style="font-size:13px;color:var(--dim);margin-top:2px">${game.note}</div>` : ""}
          </div>
          <div style="display:flex;gap:8px;flex-shrink:0;margin-top:2px">
            <button class="btn" onclick="adminToggleRounds('${game.id}')"
              style="padding:4px 10px;font-size:13px;color:var(--muted)">
              ${expanded ? "▲ Dölj" : "▼ Omgångar"}
            </button>
            <button class="btn admin-delete-btn" onclick="adminDeleteGame('${game.id}')"
              style="padding:4px 10px;font-size:13px;color:#c9622f;border-color:rgba(201,98,47,0.3)">
              Ta bort
            </button>
          </div>
        </div>`;

      if (expanded) {
        html += `<div style="margin-top:12px;background:rgba(26,23,20,0.03);border-radius:8px;padding:10px 12px">
          <div style="font-size:12px;letter-spacing:2px;color:var(--muted);margin-bottom:8px">OMGÅNGAR</div>`;
        for (let ri = 0; ri < numRounds; ri++) {
          const roundNum = ri + 1;
          const scores = game.players.map(p =>
            `${p.name}: ${p.scores[ri]}`
          ).join(" · ");
          html += `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(26,23,20,0.06)">
            <div style="font-size:13px;color:var(--muted);width:22px;flex-shrink:0">${roundNum}.</div>
            <div style="flex:1;font-size:13px">${scores}</div>
            <button class="btn admin-delete-btn" onclick="adminDeleteRound('${game.id}', ${ri})"
              style="padding:2px 8px;font-size:12px;color:#c9622f;border-color:rgba(201,98,47,0.3);flex-shrink:0">
              Ta bort
            </button>
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
      html += `<div style="display:flex;align-items:center;gap:10px;padding:12px 0;border-bottom:1px solid var(--divider)">
        <div style="width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0"></div>
        <div style="flex:1">
          <div style="font-size:15px">${p.name}</div>
          <div style="font-size:13px;color:var(--muted)">${p.gamesPlayed || 0} matcher · ${p.wins || 0} vinster</div>
        </div>
        <button class="btn admin-delete-btn" onclick="adminDeletePlayer('${p.id}', '${p.name}')"
          style="padding:4px 10px;font-size:13px;color:#c9622f;border-color:rgba(201,98,47,0.3);flex-shrink:0">
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
    // Refresh player list from backend so win counts are up to date.
    await refreshPlayersFromBackend();
    notify("Matchen borttagen ✓", "success");
    if (adminExpandedGame === gameId) adminExpandedGame = null;
    renderAdmin();
  } catch(e) {
    notify("Kunde inte ta bort matchen: " + e.message, "warn");
  }
}

async function adminDeleteRound(gameId, roundIndex) {
  const game = allGames.find(g => g.id === gameId);
  if (!game) return;
  const roundNum = roundIndex + 1;
  if (!confirm(`Ta bort omgång ${roundNum} från matchen ${game.date}?\n\nOm matchen var avslutad markeras den som pågående och spelarstatistiken återställs.`)) return;

  try {
    await apiPost("/adminDelete", { type: "round", gameId, roundIndex });
    // Rebuild the local game record to match what the backend now has.
    game.players = game.players.map(p => ({
      ...p,
      scores: p.scores.filter((_, i) => i !== roundIndex),
      buys:   (p.buys || []).filter((_, i) => i !== roundIndex),
    }));
    if (Array.isArray(game.roundWinners)) {
      game.roundWinners = game.roundWinners.filter((_, i) => i !== roundIndex);
    }
    if (game.finished) {
      game.finished = false;
      delete game.finishedDate;
      allGames = allGames.filter(g => g.id !== gameId);
      lsave("gin_all_games", allGames);
      await refreshPlayersFromBackend();
      notify(`Omgång ${roundNum} borttagen — matchen är nu pågående ✓`, "success");
    } else {
      game.currentRound = game.players[0].scores.length + 1;
      lsave("gin_all_games", allGames);
      notify(`Omgång ${roundNum} borttagen ✓`, "success");
    }
    renderAdmin();
  } catch(e) {
    notify("Kunde inte ta bort omgången: " + e.message, "warn");
  }
}

async function adminDeletePlayer(playerId, playerName) {
  if (!confirm(`Ta bort spelare "${playerName}"?\n\nDeras matcher och statistik finns kvar, men spelaren tas bort från listan.`)) return;

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
