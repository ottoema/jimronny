// ─── ENV ──────────────────────────────────────────────────────────────────────
// Used to gate dev-only features. Check is done in both UI rendering and in the
// mutation functions themselves so the guard cannot be bypassed by calling the
// function directly from the console on production.
function isLocalhost() {
  // Allow dev features everywhere except the public production domain.
  // This covers localhost, 127.0.0.1, and all LAN addresses (192.168.x.x,
  // 10.x.x.x, 172.16–31.x.x, etc.) without enumerating private IP ranges.
  return window.location.hostname !== 'ottoema.github.io';
}

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const CLIENT_ID      = "196118672846-ou2s55la38u8gku9r9mvgld6m99ms7rl.apps.googleusercontent.com";
const SPREADSHEET_ID = "110T-ajfYcKBmzdyCUOFZ2pnIRaujyPZ_I6dmYuZY0CQ";
const SCOPES         = "https://www.googleapis.com/auth/spreadsheets";
const REDIRECT_URI   = "https://ottoema.github.io/jimronny/";

const TOTAL_ROUNDS = 15;
const MAX_BUYS = 3;
const PLAYER_COLORS = ["#b5341e","#3d6b45","#9e7820","#2c5f8a","#8b3a6b","#2e6b5a","#7a4e20","#5a2e8e"];

// ─── TURN GOALS ───────────────────────────────────────────────────────────────
// Each hand = array of [value, suit]. suit "★" = joker card.
const TURN_GOALS = [
  { emoji:"😌", flavor:"Uppvärmning. Njut av det medans det varar.",
    hands:[ [["7","♥"],["7","♦"],["7","♠"]], [["J","♣"],["J","♠"],["J","♥"]] ] },

  { emoji:"🎰", flavor:"Rätt färg eller döden.",
    hands:[ [["3","♥"],["4","♥"],["5","♥"],["6","♥"]] ] },

  { emoji:"😤", flavor:"Alla fyra. Ingen slipper undan.",
    hands:[ [["8","♠"],["8","♥"],["8","♦"],["8","♣"]], [["Q","♠"],["Q","♥"],["Q","♦"],["Q","♣"]] ] },

  { emoji:"🌈", flavor:"Dubbel flusch! Hoppas du gillar en färg.",
    hands:[ [["4","♦"],["5","♦"],["6","♦"],["7","♦"]], [["9","♣"],["10","♣"],["J","♣"],["Q","♣"]] ] },

  { emoji:"🤔", flavor:"Nu börjar det hetta till lite smått...",
    hands:[ [["6","♠"],["6","♥"],["6","♦"]], [["9","♣"],["9","♠"],["9","♥"]], [["2","♦"],["3","♦"],["4","♦"],["5","♦"]] ] },

  { emoji:"😬", flavor:"Fem i rad. Och ett fyrtal. Självklart.",
    hands:[ [["K","♠"],["K","♥"],["K","♦"],["K","♣"]], [["6","♥"],["7","♥"],["8","♥"],["9","♥"],["10","♥"]] ] },

  { emoji:"🤯", flavor:"FEMTAL. Det kräver joker. Lycka till.",
    hands:[ [["4","♠"],["4","♥"],["4","♦"],["4","♣"],["★","★"]], [["A","♠"],["A","♥"],["A","♦"],["A","♣"],["★","★"]] ] },

  { emoji:"😱", flavor:"Dubbel LÅNG flusch. Helt rimligt.",
    hands:[ [["2","♠"],["3","♠"],["4","♠"],["5","♠"],["6","♠"]], [["8","♥"],["9","♥"],["10","♥"],["J","♥"],["Q","♥"]] ] },

  { emoji:"😰", flavor:"FYRA tretar. Vi ses på andra sidan.",
    hands:[ [["3","♠"],["3","♥"],["3","♦"]], [["7","♣"],["7","♦"],["7","♥"]], [["J","♠"],["J","♦"],["J","♣"]], [["4","♠"],["4","♥"],["4","♦"]] ] },

  { emoji:"🫠", flavor:"Tre fluchsar. Handen räcker knappt till.",
    hands:[ [["A","♣"],["2","♣"],["3","♣"],["4","♣"]], [["6","♦"],["7","♦"],["8","♦"],["9","♦"]], [["J","♠"],["Q","♠"],["K","♠"],["A","♠"]] ] },

  { emoji:"💀", flavor:"TRE fyrtal. Det är inte en vits.",
    hands:[ [["5","♠"],["5","♥"],["5","♦"],["5","♣"]], [["9","♠"],["9","♥"],["9","♦"],["9","♣"]], [["K","♠"],["K","♥"],["K","♦"],["K","♣"]] ] },

  { emoji:"🎭", flavor:"FEM fluchsar. Den som hittade på det här skrattar fortfarande.",
    hands:[ [["A","♥"],["2","♥"],["3","♥"]], [["5","♣"],["6","♣"],["7","♣"]], [["9","♠"],["10","♠"],["J","♠"]], [["3","♦"],["4","♦"],["5","♦"]], [["7","♥"],["8","♥"],["9","♥"]] ] },

  { emoji:"☠️", flavor:"Fem tretar. Det är inte okej. Det är aldrig okej.",
    hands:[ [["2","♠"],["2","♥"],["2","♦"]], [["5","♣"],["5","♦"],["5","♥"]], [["8","♠"],["8","♦"],["8","♣"]], [["J","♣"],["J","♥"],["J","♦"]], [["A","♠"],["A","♥"],["A","♣"]] ] },

  { emoji:"🔥", flavor:"Femtal + lång flusch + ett par som INTE får byggas på. Självklart.",
    hands:[ [["K","♠"],["K","♥"],["K","♦"],["K","♣"],["★","★"]], [["3","♦"],["4","♦"],["5","♦"],["6","♦"],["7","♦"]], [["10","♠"],["10","♥"]] ],
    extra:[null, null, "🚫 får ej byggas på"] },

  { emoji:"🪦", flavor:"SISTA OMGÅNGEN. Allt ut. Inga kort kvar på handen.",
    hands:[ [["6","♠"],["6","♥"],["6","♦"]], [["9","♣"],["9","♠"],["9","♥"]], [["2","♣"],["3","♣"],["4","♣"],["5","♣"],["6","♣"]], [["8","♦"],["9","♦"],["10","♦"],["J","♦"],["Q","♦"]] ],
    footer:"⚠️ INGET SLÄNG!" }
];

// ─── OMGÅNGSBESKRIVNINGAR ─────────────────────────────────────────────────────
const TURN_DESCRIPTIONS = [
  "2st tretal",
  "1st straight flusch på minst 4 kort",
  "2st fyrtal",
  "2st straight flusch på minst 4 kort",
  "2st tretal, 1st straight flusch på minst 4 kort",
  "1st fyrtal, 1st straight flusch på minst 5 kort",
  "2st femtal",
  "2st straight flusch på minst 5 kort",
  "4st tretal",
  "3st straight flusch på minst 4 kort",
  "3st fyrtal",
  "5st straight flusch på minst 3 kort",
  "5st tretal",
  "1st femtal, 1st straight flusch på minst 5 kort, 1st par som inte får byggas på",
  "2st tretal, resten straight flusch och inga kort på bordet",
];
