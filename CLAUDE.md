# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**JimRonny** is a single-file SPA for tracking scores in a Swedish card game (Gin Rummy variant). The entire application lives in `index.html` — CSS, JavaScript, and HTML are all embedded in this one file. It deploys automatically to GitHub Pages via `.github/workflows/static.yml` on push to `main`.

## Development

There is no build step, package manager, or test suite. To develop:

- Open `index.html` directly in a browser (no server required)
- For OAuth to work, the redirect URI must match — local testing will break the Google OAuth flow; test auth-related features by deploying to GitHub Pages

## Architecture

### Single-File Structure (`index.html`)

The JavaScript section is organized around these concerns:

**Constants** (top of `<script>`):
- `CLIENT_ID`, `SPREADSHEET_ID`, `REDIRECT_URI` — Google OAuth/Sheets config
- `TOTAL_ROUNDS = 15`, `MAX_BUYS = 3` — game rules
- `PLAYER_COLORS` — array of 8 hex colors for player UI

**State**: All mutable state is held in-memory (plain variables). On relevant actions it is synced to:
1. `localStorage` — always (keys: `gin_players`, `gin_current_game`, `gin_all_games`, `gin_token_expiry`)
2. Google Sheets — only when authenticated (4 sheets: `Players`, `Games`, `Rounds`, `CurrentGame`)

**Data flow**: User interaction → in-memory state update → `localStorage` write → (if authenticated) Sheets API call

**Views** (rendered by direct DOM manipulation, no framework):
- `renderHome()` — game setup and saved player management
- `renderGame()` — active round with score input
- `renderStats()` — leaderboard and match history
- `renderPlayers()` — career statistics per player

**Google Sheets integration**:
- `sheetsGet(range)` / `sheetsAppend(range, values)` / `sheetsUpdate(range, values)` — low-level Sheets v4 REST wrappers
- `loadFromSheets()` — pull remote state on sign-in
- `saveFinishedGame()` — write completed game to Sheets

**Auth**:
- Google OAuth 2.0 implicit flow — `signIn()` redirects to Google, `handleOAuthCallback()` reads the token from the URL hash on return
- Token stored in `localStorage` alongside an expiry timestamp

### Game Rules Encoded in JS
- 15 rounds total; lowest cumulative score wins
- Each player can buy up to 3 times per round (adds penalty points)
- The player who "goes out" records 0 for that round; others enter their hand score
