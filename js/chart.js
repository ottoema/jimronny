// ─── ROUND BREAKDOWN CHART ────────────────────────────────────────────────────
// Stacked bar chart: X = players, Y = cumulative score.
// Each bar is divided into per-round segments stacked from bottom to top.
//   • Latest round = full player color + "+score" label above; older rounds fade.
//   • "R1"–"R15" label rendered white inside each segment (when tall enough).
//   • "Gick ut" player per round: bold horizontal line across their bar at the
//     round boundary (their score is 0 so no segment; the line marks the level).
//
// buildRoundBreakdownSVG(game) — pure <svg> string, shared by both callers.
// renderRoundBreakdownChart()  — stats-page section wrapper.
// openStandingsSheet()         — post-round sheet uses buildRoundBreakdownSVG directly.
function buildRoundBreakdownSVG(game) {
  const completedRounds = game.players[0]?.scores.length || 0;
  if (completedRounds === 0) return "";

  const players = game.players;
  const roundWinners = game.roundWinners || [];
  const maxTotal = Math.max(...players.map(p => totalScore(p)), 1);

  const W = 560, H = 480;
  const padL = 40, padR = 12, padT = 30, padB = 44;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const groupW = chartW / players.length;
  const barW = Math.min(Math.max(groupW * 0.58, 20), 60);

  const parts = [];

  // Y-axis grid lines + labels
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const y = H - padB - (i / ticks) * chartH;
    const val = Math.round((i / ticks) * maxTotal);
    parts.push(`<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="currentColor" stroke-opacity="0.08" stroke-width="1"/>`);
    parts.push(`<text x="${padL - 6}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="10" fill="currentColor" opacity="0.4">${val}</text>`);
  }

  // One stacked bar per player
  players.forEach((p, pi) => {
    const color = PLAYER_COLORS[pi % PLAYER_COLORS.length];
    const cx = padL + groupW * (pi + 0.5);
    const bx = cx - barW / 2;
    let yBase = H - padB;

    p.scores.forEach((score, ri) => {
      const isLatest = ri === completedRounds - 1;
      const isGickUt = roundWinners[ri] === pi;
      const segH = score === 0 ? 0 : Math.max((score / maxTotal) * chartH, 2);

      if (segH > 0) {
        const t = completedRounds > 1 ? ri / (completedRounds - 1) : 1;
        const opacity = isLatest ? 1 : (0.18 + t * 0.42).toFixed(2);
        yBase -= segH;

        parts.push(`<rect x="${bx.toFixed(1)}" y="${yBase.toFixed(1)}" width="${barW.toFixed(1)}" height="${segH.toFixed(1)}" fill="${color}" opacity="${opacity}" rx="2"/>`);

        if (segH >= 14) {
          const ly = (yBase + segH / 2 + 3.5).toFixed(1);
          parts.push(`<text x="${cx.toFixed(1)}" y="${ly}" text-anchor="middle" font-size="9" fill="white" opacity="0.72" font-weight="600">R${ri + 1}</text>`);
        }

        if (isLatest && score > 0) {
          parts.push(`<text x="${cx.toFixed(1)}" y="${(yBase - 5).toFixed(1)}" text-anchor="middle" font-size="11" fill="${color}" font-weight="700">+${score}</text>`);
        }
      }

      if (isGickUt) {
        parts.push(`<line x1="${bx.toFixed(1)}" y1="${yBase.toFixed(1)}" x2="${(bx + barW).toFixed(1)}" y2="${yBase.toFixed(1)}" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>`);
      }
    });

    const tot = totalScore(p);
    const totY = (H - padB - (tot / maxTotal) * chartH - 16).toFixed(1);
    parts.push(`<text x="${cx.toFixed(1)}" y="${totY}" text-anchor="middle" font-size="12" fill="${color}" font-weight="bold">${tot}</text>`);

    const name = p.name.length > 11 ? p.name.substring(0, 10) + "…" : p.name;
    parts.push(`<text x="${cx.toFixed(1)}" y="${(H - padB + 18).toFixed(1)}" text-anchor="middle" font-size="13" fill="currentColor">${name}</text>`);
  });

  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;min-width:240px;display:block;color:var(--fg)" role="img" aria-label="Stapeldiagram med poäng per omgång och spelare">
    ${parts.join("\n    ")}
  </svg>`;
}

function renderRoundBreakdownChart(gameOverride = null) {
  const game = gameOverride
    ?? (currentGame && !currentGame.finished ? currentGame : null)
    ?? (allGames.length > 0 ? allGames[allGames.length - 1] : null);
  if (!game) return "";

  const completedRounds = game.players[0]?.scores.length || 0;
  if (completedRounds === 0) return "";

  const svg = buildRoundBreakdownSVG(game);
  const subtitle = !game.finished
    ? `Pågående match · omgång ${completedRounds} av ${TOTAL_ROUNDS}`
    : `Senaste matchen · ${game.date || ""}`;

  return `<div style="border-top:1px solid var(--divider);padding:28px 0 8px">
      <div style="font-size:12px;letter-spacing:3px;color:var(--muted);margin-bottom:4px">POÄNG PER OMGÅNG</div>
      <div style="font-size:14px;color:var(--muted);margin-bottom:14px">${subtitle}</div>
      <div style="overflow-x:auto">${svg}</div>
    </div>`;
}

function renderScoreChart(tall = false) {
  const completedRounds = currentGame.players[0]?.scores.length || 0;
  if (completedRounds === 0) return "";

  const cumulative = currentGame.players.map(p => {
    let sum = 0;
    return p.scores.map(s => (sum += s));
  });

  const allVals = cumulative.flat();
  const maxVal = Math.max(...allVals, 1);

  const W = 600, H = tall ? 340 : 220;
  const padL = 42, padR = 12, padT = 16, padB = 28;
  const cW = W - padL - padR;
  const cH = H - padT - padB;

  const xOf = r => padL + (r / (TOTAL_ROUNDS - 1)) * cW;
  const yOf = s => padT + (1 - s / maxVal) * cH;

  let svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;overflow:visible">`;

  const gridLines = 4;
  for (let g = 0; g <= gridLines; g++) {
    const val = (maxVal / gridLines) * g;
    const y = yOf(val);
    svg += `<line x1="${padL}" y1="${y}" x2="${padL + cW}" y2="${y}" stroke="rgba(26,23,20,0.08)" stroke-width="1"/>`;
    svg += `<text x="${padL - 6}" y="${y + 4}" text-anchor="end" fill="rgba(26,23,20,0.4)" font-size="10" font-family="monospace">${Math.round(val)}</text>`;
  }

  for (let r = 0; r < TOTAL_ROUNDS; r++) {
    const x = xOf(r);
    if (r % 3 === 0 || r === TOTAL_ROUNDS - 1) {
      svg += `<line x1="${x}" y1="${padT}" x2="${x}" y2="${padT + cH}" stroke="rgba(26,23,20,0.08)" stroke-width="1"/>`;
      svg += `<text x="${x}" y="${padT + cH + 16}" text-anchor="middle" fill="rgba(26,23,20,0.4)" font-size="10" font-family="monospace">${r + 1}</text>`;
    }
  }

  if (completedRounds < TOTAL_ROUNDS) {
    const xMarker = xOf(completedRounds - 1) + (xOf(completedRounds) - xOf(completedRounds - 1)) / 2;
    svg += `<line x1="${xMarker}" y1="${padT}" x2="${xMarker}" y2="${padT + cH}" stroke="rgba(201,98,47,0.35)" stroke-width="1.5" stroke-dasharray="4,3"/>`;
  }

  currentGame.players.forEach((p, i) => {
    const color = PLAYER_COLORS[i];
    const pts = cumulative[i].map((val, ri) => `${xOf(ri)},${yOf(val)}`).join(" ");
    if (cumulative[i].length > 1) {
      svg += `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" opacity="0.85"/>`;
    }
    cumulative[i].forEach((val, ri) => {
      svg += `<circle cx="${xOf(ri)}" cy="${yOf(val)}" r="4" fill="${color}" opacity="0.9"/>`;
    });
  });

  svg += `</svg>`;

  let legendHtml = `<div style="display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:12px">`;
  currentGame.players.forEach((p,i) => {
    const c = PLAYER_COLORS[i];
    legendHtml += `<div style="display:flex;align-items:center;gap:5px">
      <div style="width:16px;height:3px;background:${c};border-radius:2px"></div>
      <div style="width:7px;height:7px;border-radius:50%;background:${c}"></div>
      <span style="font-size:12px;color:${c}">${p.name}</span>
    </div>`;
  });
  legendHtml += `</div>`;
  return `<div style="border-top:1px solid var(--divider);padding:28px 0;overflow:hidden">
    <div style="font-size:12px;letter-spacing:3px;color:var(--muted);margin-bottom:18px">POÄNGUTVECKLING</div>
    ${svg}
    ${legendHtml}
  </div>`;
}

// ─── STANDINGS SHEET ──────────────────────────────────────────────────────────
function openStandingsSheet(afterSubmit = false) {
  const sorted = [...currentGame.players]
    .map((p,i) => ({p, i, t: totalScore(p)}))
    .sort((a,b) => a.t - b.t);
  const completedRounds = currentGame.players[0]?.scores.length || 0;
  let html = afterSubmit
    ? `<div style="text-align:center;padding:28px 24px 20px;border-bottom:1px solid var(--divider)">
        <div style="font-size:36px;color:#3d6b45;margin-bottom:10px">✓</div>
        <div style="font-family:Georgia,serif;font-size:28px;margin-bottom:4px">Omgång ${completedRounds} klar</div>
        <div style="font-size:13px;color:var(--muted)">${completedRounds} / ${TOTAL_ROUNDS} omgångar avklarade</div>
       </div>`
    : `<div style="padding:20px 24px 4px;display:flex;align-items:baseline;justify-content:space-between">
        <div style="font-size:12px;letter-spacing:3px;color:var(--muted)">STÄLLNING</div>
        <div style="font-size:13px;color:var(--dim)">${completedRounds} / ${TOTAL_ROUNDS} omgångar</div>
       </div>`;
  const prevSorted = completedRounds > 0
    ? [...currentGame.players]
        .map((p,i) => ({ i, t: p.scores.slice(0, -1).reduce((a,b) => a+b, 0) }))
        .sort((a,b) => a.t - b.t)
    : null;
  sorted.forEach(({p,i,t},rank) => {
    const lastScore = p.scores.length > 0 ? p.scores[p.scores.length - 1] : null;
    let rankArrow = "";
    if (prevSorted) {
      const prevRank = prevSorted.findIndex(x => x.i === i);
      if (prevRank > rank) rankArrow = `<span style="color:var(--green);font-size:12px;margin-left:6px">▲</span>`;
      else if (prevRank < rank) rankArrow = `<span style="color:var(--red);font-size:12px;margin-left:6px">▼</span>`;
    }
    const pGames = allGames.filter(g => g.players.find(gp => gp.name === p.name));
    const last3 = pGames.slice(-3);
    const onStreak = last3.length === 3 && last3.every(g => {
      const w = [...g.players].sort((a,b) => totalScore(a) - totalScore(b))[0];
      return w?.name === p.name;
    });
    html += `<div style="display:flex;align-items:center;padding:16px 24px;border-top:1px solid var(--divider)">
      <div style="flex:1">
        <span style="font-size:20px;color:${PLAYER_COLORS[i]}">${p.name}${onStreak ? " 🔥" : ""}</span>${rankArrow}
        <div style="font-size:13px;color:var(--muted);margin-top:3px">${totalBuys(p)} köp</div>
      </div>
      <div style="display:flex;align-items:baseline;gap:10px">
        ${lastScore !== null ? `<span style="font-size:20px;color:var(--muted)">+${lastScore}</span>` : ""}
        <div style="font-family:Georgia,serif;font-size:40px;color:${rank===0?PLAYER_COLORS[i]:"rgba(26,23,20,0.82)"}">${t}</div>
      </div>
    </div>`;
  });
  if (completedRounds > 0) {
    let headers = `<th style="text-align:left;color:rgba(26,23,20,0.45);font-size:13px">OMG</th>`;
    currentGame.players.forEach((p,i) => { headers += `<th style="color:${PLAYER_COLORS[i]};text-align:center">${p.name}</th>`; });
    let rows = "";
    currentGame.players[0].scores.forEach((_,round) => {
      const winnerIdx = currentGame.roundWinners ? currentGame.roundWinners[round] : -1;
      const cumTotals = currentGame.players.map(p => p.scores.slice(0, round + 1).reduce((a,b) => a+b, 0));
      const minCum = Math.min(...cumTotals);
      let cells = `<td style="color:rgba(26,23,20,0.38)">${round+1}</td>`;
      currentGame.players.forEach((p,i) => {
        const s = p.scores[round];
        const b = p.buys[round]||0;
        const isWinner = winnerIdx >= 0 ? i === winnerIdx : s === 0;
        const isLeader = cumTotals[i] === minCum;
        const scoreSpan = isWinner
          ? `<span title="Gick ut" style="text-decoration:${isLeader?"underline":"none"};text-underline-offset:3px">—</span>`
          : `<span style="text-decoration:${isLeader?"underline":"none"};text-underline-offset:3px">${s}</span>`;
        cells += `<td style="text-align:center;color:${isWinner?PLAYER_COLORS[i]:"#1a1714"};font-weight:${isWinner?"bold":"normal"}">${scoreSpan}${b>0?`<span style="font-size:12px;color:${PLAYER_COLORS[i]};margin-left:4px">+${b}</span>`:""}</td>`;
      });
      rows += `<tr style="border-top:1px solid rgba(26,23,20,0.06)">${cells}</tr>`;
    });
    const totals = currentGame.players.map(p => totalScore(p));
    const minTot = Math.min(...totals);
    let totRow = `<td style="font-size:13px;letter-spacing:2px;color:rgba(26,23,20,0.45)">TOT</td>`;
    currentGame.players.forEach((p,i) => { totRow += `<td style="text-align:center;color:${PLAYER_COLORS[i]};font-weight:bold;font-size:18px"><span style="text-decoration:${totals[i]===minTot?"underline":"none"};text-underline-offset:3px">${totalScore(p)}</span></td>`; });
    html += `<div style="border-top:1px solid var(--divider);padding:20px 24px;overflow-x:auto">
      <div style="font-size:12px;letter-spacing:3px;color:var(--muted);margin-bottom:20px">POÄNGHISTORIK</div>
      <table><thead><tr>${headers}</tr></thead><tbody>${rows}<tr style="border-top:1px solid rgba(26,23,20,0.12)">${totRow}</tr></tbody></table>
    </div>`;
    const _breakdownSVG = buildRoundBreakdownSVG(currentGame);
    if (_breakdownSVG) {
      html += `<div style="border-top:1px solid var(--divider);padding:20px 24px 8px">
        <div style="font-size:12px;letter-spacing:3px;color:var(--muted);margin-bottom:14px">POÄNG PER OMGÅNG</div>
        <div style="overflow-x:auto">${_breakdownSVG}</div>
      </div>`;
    }
    html += `<div onclick="openChartOverlay()" style="padding:0 24px;cursor:pointer">
      ${renderScoreChart()}
      <div style="text-align:center;font-size:11px;color:var(--dim);letter-spacing:1px;padding-bottom:8px">TRYCK FÖR ATT FÖRSTORA ›</div>
    </div>`;
  }

  const plVal = (currentGame.playlist || "").replace(/"/g, "&quot;");
  html += `<div style="padding:4px 24px 20px;border-top:1px solid var(--divider)">
    <div style="font-size:12px;letter-spacing:3px;color:var(--muted);margin-bottom:10px;margin-top:20px">SPELLISTA</div>
    <input type="url" inputmode="url" id="playlist-input" placeholder="Klistra in Spotify-länk…" value="${plVal}"
      oninput="currentGame.playlist=this.value;lsave('gin_ongoing_games',ongoingGames);var a=document.getElementById('playlist-link');if(a){a.href=this.value;a.style.display=this.value?'block':'none'}"
      style="width:100%;font-size:15px;border:none;border-bottom:1px solid var(--divider);padding:6px 0;background:transparent;color:var(--fg);outline:none">
    <a id="playlist-link" href="${plVal}" target="_blank" rel="noopener"
      style="font-size:13px;color:#1DB954;display:${plVal?"block":"none"};margin-top:10px">♪ Öppna spellistan</a>
  </div>`;
  html += `<div style="padding:0 24px 32px">
    <button class="btn" onclick="closeStandingsSheet()"
      style="width:100%;padding:18px;background:#c9622f;border:none;color:#fff;
             font-size:18px;font-weight:600;border-radius:12px">
      Fortsätt →
    </button>
  </div>`;

  const sheetEl = document.getElementById("standings-sheet");
  sheetEl.innerHTML = `<div style="padding:12px 0 4px;text-align:center">
    <div style="width:40px;height:4px;background:rgba(26,23,20,0.2);border-radius:2px;display:inline-block"></div>
  </div>` + html;
  sheetEl.scrollTop = 0;
  sheetEl.classList.add("open");
  document.getElementById("standings-backdrop").style.display = "block";
  document.body.style.overflow = "hidden";
  let _ty0 = 0;
  sheetEl.ontouchstart = e => { _ty0 = e.touches[0].clientY; };
  sheetEl.ontouchend = e => { if (e.changedTouches[0].clientY - _ty0 > 70) closeStandingsSheet(); };
}

function closeStandingsSheet() {
  document.getElementById("standings-sheet").classList.remove("open");
  document.getElementById("standings-backdrop").style.display = "none";
  document.body.style.overflow = "";
  render();
  requestAnimationFrame(() => {
    const el = document.getElementById("round-header");
    if (el) el.scrollIntoView({behavior: "smooth", block: "start"});
  });
}

// ─── CHART OVERLAY ────────────────────────────────────────────────────────────
function setViewportZoom(allow) {
  const vp = document.querySelector('meta[name="viewport"]');
  if (vp) vp.content = allow
    ? 'width=device-width, initial-scale=1.0'
    : 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
}

function openChartOverlay() {
  document.getElementById("chart-overlay-content").innerHTML = renderScoreChart(true);
  const el = document.getElementById("chart-overlay");
  el.scrollTop = 0;
  el.classList.add("open");
  document.getElementById("chart-backdrop").style.display = "block";
  setViewportZoom(true);
  let _ty0 = 0;
  el.ontouchstart = e => { _ty0 = e.touches[0].clientY; };
  el.ontouchend = e => { if (e.changedTouches[0].clientY - _ty0 > 70) closeChartOverlay(); };
}

function closeChartOverlay() {
  document.getElementById("chart-overlay").classList.remove("open");
  document.getElementById("chart-backdrop").style.display = "none";
  setViewportZoom(false);
}
