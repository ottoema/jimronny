// ─── WAKE LOCK ────────────────────────────────────────────────────────────────
async function acquireWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try { wakeLockSentinel = await navigator.wakeLock.request('screen'); } catch(e) {}
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && currentView === 'game') acquireWakeLock();
});

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
let notifTimer = null;
function notify(msg, type = "info") {
  const el = document.getElementById("notification");
  el.textContent = msg;
  el.style.background = type === "success" ? "#3d6b45" : type === "warn" ? "#9e7820" : "#2c5f8a";
  el.style.color = "#fff";
  el.style.display = "block";
  if (notifTimer) clearTimeout(notifTimer);
  notifTimer = setTimeout(() => { el.style.display = "none"; }, 3000);
}

// ─── EASTER THEME ─────────────────────────────────────────────────────────────
// Auto-activates March 29 – April 12 (two weeks around Easter 2026-04-05).
// Toggle manually: add ?easter=1 to the URL to force-enable, ?easter=0 to force-disable.
function applyEasterTheme() {
  const params = new URLSearchParams(window.location.search);
  const override = params.get("easter");
  let active;
  if (override === "1") {
    active = true;
  } else if (override === "0") {
    active = false;
  } else {
    const now = new Date();
    const m = now.getMonth() + 1;
    const d = now.getDate();
    active = (m === 3 && d >= 29) || (m === 4 && d <= 12);
  }
  if (active) document.body.classList.add("easter");
}
applyEasterTheme();

// ─── INIT ─────────────────────────────────────────────────────────────────────
// Show a ?auth_error= banner if the backend callback redirected with an error.
(function checkAuthError() {
  const err = new URLSearchParams(window.location.search).get("auth_error");
  if (!err) return;
  const msgs = { forbidden: "Åtkomst nekad — din e-post finns inte i tillåtslistan.", token: "Inloggning misslyckades — försök igen.", server: "Serverfel vid inloggning — försök igen." };
  notify(msgs[err] || "Inloggning avbröts.", "warn");
  window.history.replaceState({}, "", window.location.pathname);
})();

// Migrate old gin_current_game storage key if present
const oldGame = lload("gin_current_game", null);
if (oldGame && !oldGame.finished && !ongoingGames.find(g => g.id === oldGame.id)) {
  ongoingGames.push(oldGame);
  lsave("gin_ongoing_games", ongoingGames);
  lsave("gin_current_game", null);
}
if (ongoingGames.length > 0) {
  setActiveGame(activeGameId && ongoingGames.find(g => g.id === activeGameId) ? activeGameId : ongoingGames[0].id);
}

// Render immediately from localStorage so the UI is never blank,
// then sync with the backend in the background (updates if session cookie is valid).
render();
loadFromBackend();
