# poteho

Poker Texas Hold'em — a progressive web app (PWA) built with [Lit](https://lit.dev) to train your poker skills against bot opponents.

## Features

- **Full Texas Hold'em engine** — blinds, betting rounds (pre-flop → river), raises, all-ins, side pots, showdowns.
- **Bot opponents** — heuristic AI that estimates hand equity with Monte Carlo simulation and weighs it against pot odds.
- **Coach panel** — live training aid: your Monte Carlo equity vs. remaining opponents, pot odds, equity needed to call, and an +EV / fold recommendation.
- **Hand history** — every hand is logged with board, winners, hand names and your result.
- **PWA** — installable (manifest + icons + service worker), works offline, progress saved in `localStorage` so you can close the tab and resume.
- **Responsive** — playable on desktop and mobile.

## Develop

```bash
npm install
npm run dev       # vite dev server
npm test          # engine unit tests (node:test)
npm run smoke     # DOM smoke test of the Lit components (happy-dom)
npm run build     # production build into dist/
npm run preview   # serve the production build
npm run icons     # regenerate PWA icons (public/icons/*.png)
```

## Project layout

```
index.html               app shell + PWA meta
vite.config.js
src/main.js              entry: mounts <poteho-app>, registers service worker
src/engine/              pure game logic (no DOM — unit tested)
  cards.js               deck, shuffle, seeded RNG
  evaluate.js            5/7-card hand evaluator
  equity.js              Monte Carlo equity + pot odds
  ai.js                  bot decision making
  game.js                Hold'em state machine (blinds, streets, side pots, showdown)
  storage.js             localStorage persistence
src/components/          Lit web components
  poteho-app.js          root: game controller, header, banner, dialogs
  poker-table.js         felt, community cards, seats, event feed
  player-seat.js         seat with cards, stack, bet, dealer button
  card-el.js             playing card
  action-bar.js          fold / check-call / bet-raise controls
  hint-panel.js          coach: equity, pot odds, advice
  hand-log.js            hand history drawer
  new-game-dialog.js     table setup
public/                  manifest, service worker, icons, favicon
test/                    node:test suites for the engine
scripts/smoke.mjs        DOM smoke test
```

## Rules notes

Standard no-limit hold'em: small/big blinds, dealer button rotates, one aggressor per round. All-in raises below the minimum are allowed (they reopen betting in this implementation — a deliberate simplification). Chips are conserved across hands (covered by tests).
