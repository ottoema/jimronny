// ─── CONFIG ───────────────────────────────────────────────────────────────────
async function loadConfig() {
  try {
    const data = await fetch(API_BASE + '/getConfig').then(r => r.json());
    googleClientId = data.googleClientId;
  } catch(e) { console.warn('loadConfig failed', e); }
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────
// Authorization Code flow — the browser redirects to Google, Google redirects
// to /api/authCallback, the backend exchanges the code for tokens and sets an
// HttpOnly JWT cookie. The frontend never sees a token.
async function signIn() {
  if (!googleClientId) await loadConfig();
  if (!googleClientId) { notify("Konfiguration saknas — försök igen.", "warn"); return; }
  const params = new URLSearchParams({
    client_id:     googleClientId,
    redirect_uri:  REDIRECT_URI,
    response_type: "code",
    scope:         "openid email profile",
    access_type:   "offline",
    prompt:        "select_account",
  });
  window.location.href = "https://accounts.google.com/o/oauth2/v2/auth?" + params;
}

async function signOut() {
  try { await apiPost("/authSignout", {}); } catch(e) {}
  isAuthenticated = false;
  userEmail = null;
  renderAuthBar();
  notify("Utloggad", "info");
}

// ─── BACKEND API ──────────────────────────────────────────────────────────────
// All requests send credentials:include so the browser attaches the session cookie.
// A 401 response means the session has expired — update auth state and re-render.

async function apiGet(path) {
  const r = await fetch(API_BASE + path, { credentials: "include" });
  if (r.status === 401) { isAuthenticated = false; userEmail = null; renderAuthBar(); throw Object.assign(new Error("Ej inloggad"), { status: 401 }); }
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function apiPost(path, body) {
  const r = await fetch(API_BASE + path, {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (r.status === 401) { isAuthenticated = false; userEmail = null; renderAuthBar(); throw Object.assign(new Error("Ej inloggad"), { status: 401 }); }
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function apiPut(path, body) {
  const r = await fetch(API_BASE + path, {
    method: "PUT", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (r.status === 401) { isAuthenticated = false; userEmail = null; renderAuthBar(); throw Object.assign(new Error("Ej inloggad"), { status: 401 }); }
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// ─── DATA SYNC ────────────────────────────────────────────────────────────────
async function loadFromBackend() {
  setSyncStatus("syncing"); renderAuthBar();
  try {
    // Parallel fetch — getSession doubles as an auth check (returns 401 if not logged in)
    const [sessionData, playersData, gamesData] = await Promise.all([
      apiGet("/getSession"),
      apiGet("/getPlayers"),
      apiGet("/getGames"),
    ]);

    isAuthenticated = true;
    userEmail = sessionData.email;

    if (playersData.players?.length > 0) {
      savedPlayers = playersData.players;
      lsave("gin_players", savedPlayers);
    }
    if (gamesData.games?.length > 0) {
      allGames = gamesData.games;
      lsave("gin_all_games", allGames);
    }

    // Merge remote ongoing games with local (keep whichever is further along)
    const remote = sessionData.ongoingGames || [];
    if (remote.length > 0 || ongoingGames.length > 0) {
      const progress  = g => Math.max(g.currentRound || 0, ...g.players.map(p => p.scores.length));
      const localById = Object.fromEntries(ongoingGames.map(g => [g.id, g]));
      const remById   = Object.fromEntries(remote.map(g => [g.id, g]));
      const allIds    = new Set([...Object.keys(localById), ...Object.keys(remById)]);
      const merged    = [];
      for (const id of allIds) {
        const loc = localById[id], rem = remById[id];
        if (!loc) { merged.push(rem); continue; }
        if (!rem) { merged.push(loc); continue; }
        merged.push(progress(loc) >= progress(rem) ? loc : rem);
      }
      ongoingGames = merged;
      lsave("gin_ongoing_games", ongoingGames);
      const newActiveId = sessionData.activeGameId && merged.find(g => g.id === sessionData.activeGameId)
        ? sessionData.activeGameId
        : merged.length > 0 ? merged[0].id : null;
      if (newActiveId) setActiveGame(newActiveId);
      if (remote.length > 0) notify(`${merged.length} pågående matcher synkade ✓`, "success");
    }

    setSyncStatus("synced"); render();
  } catch(e) {
    setSyncStatus(e.status === 401 ? "idle" : "error");
    if (e.status !== 401) notify("Backend-fel: " + e.message, "warn");
    render();
  }
}

async function saveSessionToBackend() {
  if (!isAuthenticated) return;
  try {
    await apiPut("/saveSession", { ongoingGames, activeGameId });
  } catch(e) { console.warn("saveSessionToBackend failed", e); }
}

async function savePlayersToBackend() {
  if (!isAuthenticated) return;
  try {
    await apiPost("/savePlayers", { players: savedPlayers });
  } catch(e) { console.warn("savePlayersToBackend failed", e); }
}

async function saveGameToBackend(game, updatedPlayers) {
  if (!isAuthenticated) return;
  setSyncStatus("syncing"); renderAuthBar();
  try {
    await apiPost("/saveGame", { game, updatedPlayers });
    await saveSessionToBackend();
    setSyncStatus("synced"); renderAuthBar();
  } catch(e) {
    setSyncStatus("error"); renderAuthBar();
    notify("Kunde inte spara till backend: " + e.message, "warn");
  }
}

async function updateGameNoteInBackend(gameId, note) {
  if (!isAuthenticated) return;
  try {
    await apiPost("/saveGame", { game: { id: gameId, note }, noteOnly: true });
  } catch(e) { console.warn("updateGameNoteInBackend failed", e); }
}
