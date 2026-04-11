// ─── LOCAL STORAGE ────────────────────────────────────────────────────────────
function lsave(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) {} }
function lload(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch(e) { return d; } }

// ─── STATE ────────────────────────────────────────────────────────────────────
let isAuthenticated  = false;
let userEmail        = null;
let wakeLockSentinel = null;
let savedPlayers     = lload("gin_players", []);
let ongoingGames     = lload("gin_ongoing_games", []);
let activeGameId     = lload("gin_active_game_id", null);
let currentGame      = null; // set at init via setActiveGame()
let lastFinishedGame = null;
let historyExpanded  = false;
let allGames         = lload("gin_all_games", []);
let setupPlayers     = [];
let roundInputs      = {};
let goesOutIdx       = null;
let currentView      = "home";
let syncStatus       = "idle";

// ─── ACTIVE GAME ──────────────────────────────────────────────────────────────
function setActiveGame(id) {
  activeGameId = id;
  lsave("gin_active_game_id", activeGameId);
  currentGame = ongoingGames.find(g => g.id === activeGameId) || null;
}
