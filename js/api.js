// ─── OAUTH ────────────────────────────────────────────────────────────────────
function signIn() {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "token",
    scope: SCOPES,
    prompt: "select_account"
  });
  window.location.href = "https://accounts.google.com/o/oauth2/v2/auth?" + params;
}

function signOut() {
  authToken = null;
  lsave("gin_token_expiry", null);
  renderAuthBar();
  notify("Utloggad", "info");
}

function handleOAuthCallback() {
  const hash = window.location.hash;
  if (!hash.includes("access_token")) return false;
  const params = new URLSearchParams(hash.slice(1));
  const token = params.get("access_token");
  const expiresIn = parseInt(params.get("expires_in") || "3600");
  if (token) {
    authToken = token;
    lsave("gin_token_expiry", Date.now() + expiresIn * 1000);
    window.history.replaceState({}, "", window.location.pathname);
    return true;
  }
  return false;
}

// ─── SHEETS API ───────────────────────────────────────────────────────────────
async function sheetsGet(range) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${authToken}` } });
  if (!r.ok) throw new Error(await r.text());
  return (await r.json()).values || [];
}
async function sheetsAppend(range, values) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
  const r = await fetch(url, { method:"POST", headers:{ Authorization:`Bearer ${authToken}`, "Content-Type":"application/json" }, body:JSON.stringify({ values }) });
  if (!r.ok) throw new Error(await r.text());
}
async function sheetsClear(range) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}:clear`;
  const r = await fetch(url, { method:"POST", headers:{ Authorization:`Bearer ${authToken}` } });
  if (!r.ok) throw new Error(await r.text());
}
async function sheetsUpdate(range, values) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=RAW`;
  const r = await fetch(url, { method:"PUT", headers:{ Authorization:`Bearer ${authToken}`, "Content-Type":"application/json" }, body:JSON.stringify({ values }) });
  if (!r.ok) throw new Error(await r.text());
}

async function initSheets() {
  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`, { headers:{ Authorization:`Bearer ${authToken}` } });
  const data = await r.json();
  const existing = (data.sheets||[]).map(s=>s.properties.title);
  const needed = [
    { title:"Players",     headers:["id","name","wins","gamesPlayed"] },
    { title:"Games",       headers:["id","date","playerNames","playerScores","playerBuys","winnerId","winnerName","note","playlist"] },
    { title:"Rounds",      headers:["gameId","round","playerName","score","buys"] },
    { title:"CurrentGame", headers:["key","value"] },
  ];
  const requests = needed.filter(s=>!existing.includes(s.title)).map(s=>({ addSheet:{ properties:{ title:s.title } } }));
  if (requests.length > 0) {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`, {
      method:"POST", headers:{ Authorization:`Bearer ${authToken}`, "Content-Type":"application/json" },
      body: JSON.stringify({ requests })
    });
  }
  for (const s of needed) {
    try {
      const rows = await sheetsGet(`${s.title}!A1:Z1`);
      if (rows.length===0) await sheetsUpdate(`${s.title}!A1`, [s.headers]);
    } catch(e) {
      try { await sheetsUpdate(`${s.title}!A1`, [s.headers]); } catch(e2) {}
    }
  }
}

async function loadFromSheets() {
  setSyncStatus("syncing");
  try {
    const playerRows = await sheetsGet("Players!A2:D1000");
    if (playerRows.length > 0) {
      savedPlayers = playerRows.map(r => ({ id:r[0], name:r[1], wins:parseInt(r[2])||0, gamesPlayed:parseInt(r[3])||0 }));
      lsave("gin_players", savedPlayers);
    }
    const gameRows = await sheetsGet("Games!A2:I1000");
    if (gameRows.length > 0) {
      allGames = gameRows.map(r => {
        const names  = r[2] ? r[2].split("|") : [];
        const scores = r[3] ? r[3].split("|").map(s=>s.split(",").map(Number)) : [];
        const buys   = r[4] ? r[4].split("|").map(b=>b.split(",").map(Number)) : [];
        return { id:r[0], date:r[1], finished:true,
          players: names.map((name,i) => ({ name, id:name+r[0], scores:scores[i]||[], buys:buys[i]||[] })),
          note: r[7] || "", playlist: r[8] || "" };
      });
      lsave("gin_all_games", allGames);
    }
    try {
      const cgRows = await sheetsGet("CurrentGame!A2:B100");
      const loaded = [];
      let loadedActiveId = null;
      for (const [key, val] of cgRows) {
        if (key === "activeGameId") { loadedActiveId = val; continue; }
        if (key?.startsWith("game_") && val) {
          try { const g = JSON.parse(val); if (g && !g.finished) loaded.push(g); } catch(e) {}
        }
      }
      if (loaded.length > 0 || ongoingGames.length > 0) {
        const progress = (g) => Math.max(g.currentRound || 0, ...g.players.map(p => p.scores.length));
        const localById = Object.fromEntries(ongoingGames.map(g => [g.id, g]));
        const sheetById = Object.fromEntries(loaded.map(g => [g.id, g]));
        const allIds = new Set([...Object.keys(localById), ...Object.keys(sheetById)]);
        const merged = [];
        for (const id of allIds) {
          const local = localById[id];
          const sheet = sheetById[id];
          if (!local) { merged.push(sheet); continue; }
          if (!sheet) { merged.push(local); continue; }
          merged.push(progress(local) >= progress(sheet) ? local : sheet);
        }
        ongoingGames = merged;
        lsave("gin_ongoing_games", ongoingGames);
        const newActiveId = loadedActiveId && merged.find(g => g.id === loadedActiveId)
          ? loadedActiveId
          : (merged.length > 0 ? merged[0].id : null);
        if (newActiveId) setActiveGame(newActiveId);
        saveOngoingGamesToSheets();
        notify(`${merged.length} pågående matcher synkade ✓`, "success");
      }
    } catch(e) {}
    if (!currentGame && ongoingGames.length > 0) {
      setActiveGame(activeGameId && ongoingGames.find(g => g.id === activeGameId) ? activeGameId : ongoingGames[0].id);
    }
    setSyncStatus("synced");
    render();
  } catch(e) {
    setSyncStatus("error");
    notify("Sheets-fel: " + e.message, "warn");
  }
}

async function saveOngoingGamesToSheets() {
  if (!authToken) return;
  try {
    await sheetsClear("CurrentGame!A2:B100");
    const rows = ongoingGames.map(g => [`game_${g.id}`, JSON.stringify(g)]);
    if (activeGameId) rows.push(["activeGameId", activeGameId]);
    if (rows.length > 0) await sheetsUpdate(`CurrentGame!A2:B${rows.length + 1}`, rows);
  } catch(e) { console.warn("saveOngoingGamesToSheets failed", e); }
}

async function saveFinishedGame(game, updatedPlayers) {
  if (!authToken) return;
  setSyncStatus("syncing"); renderAuthBar();
  try {
    const winner = [...game.players].sort((a,b)=>totalScore(a)-totalScore(b))[0];
    await sheetsAppend("Games!A:I", [[
      game.id, game.date,
      game.players.map(p=>p.name).join("|"),
      game.players.map(p=>p.scores.join(",")).join("|"),
      game.players.map(p=>p.buys.join(",")).join("|"),
      winner?.id||"", winner?.name||"",
      game.note || "", game.playlist || ""
    ]]);
    const roundRows = [];
    game.players.forEach(p => p.scores.forEach((score,i) => roundRows.push([game.id,i+1,p.name,score,p.buys[i]||0])));
    if (roundRows.length > 0) await sheetsAppend("Rounds!A:E", roundRows);
    await sheetsClear("Players!A2:D1000");
    if (updatedPlayers.length > 0)
      await sheetsAppend("Players!A:D", updatedPlayers.map(p=>[p.id,p.name,p.wins,p.gamesPlayed]));
    await saveOngoingGamesToSheets();
    setSyncStatus("synced"); renderAuthBar();
  } catch(e) {
    setSyncStatus("error"); renderAuthBar();
    notify("Kunne inte spara till Sheets: " + e.message, "warn");
  }
}
