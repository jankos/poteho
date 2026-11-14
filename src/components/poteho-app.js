import { LitElement, html, css } from 'lit';
import { HoldemGame, describeAction } from '../engine/game.js';
import { loadSave, writeSave, clearSave } from '../engine/storage.js';
import { cardsToString } from '../engine/cards.js';
import './poker-table.js';
import './action-bar.js';
import './hint-panel.js';
import './hand-log.js';
import './new-game-dialog.js';

const HERO_ID = 'you';
const HERO_NAME = 'You';
const BOT_NAMES = ['Ada', 'Blaze', 'Cleo', 'Dex', 'Echo', 'Faye', 'Gus', 'Hana'];
const BOT_DELAY_MS = [550, 1250];

export class PotehoApp extends LitElement {
  static properties = {
    snap: { state: true },
    feed: { state: true },
    banner: { state: true },
    history: { state: true },
    showLog: { state: true },
    showHints: { state: true },
    showNewGame: { state: true },
    gameOver: { state: true },
    settings: { state: true },
    installReady: { state: true },
  };

  constructor() {
    super();
    this.game = null;
    this.snap = null;
    this.feed = [];
    this.banner = null;
    this.history = [];
    this.showLog = false;
    this.showHints = true;
    this.showNewGame = false;
    this.gameOver = false;
    this.settings = { bots: 4, stack: 1000, smallBlind: 5, bigBlind: 10 };
    this.installEvent = null;
    this.installReady = false;
    this._pumpTimer = null;
  }

  firstUpdated() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.installEvent = e;
      this.installReady = true;
    });
    window.addEventListener('appinstalled', () => {
      this.installEvent = null;
      this.installReady = false;
    });
    const save = loadSave();
    if (save?.players?.some((p) => p.id === HERO_ID && p.stack > 0)) {
      this.settings = save.settings || this.settings;
      this.buildGame(save.players, this.settings);
      this.game.handNumber = save.handNumber || 0;
      this.game.dealerIndex = save.dealerIndex ?? -1;
      this.game.history = Array.isArray(save.history) ? save.history : [];
      this.history = this.game.history;
      this.pushFeed(`Resumed — hand #${this.game.handNumber + 1}`);
      this.startHand();
    } else {
      this.showNewGame = true;
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearTimeout(this._pumpTimer);
  }

  buildGame(players, settings) {
    this.game = new HoldemGame({
      players,
      smallBlind: settings.smallBlind,
      bigBlind: settings.bigBlind,
      onEvent: (e) => this.onEvent(e),
    });
    this.history = this.game.history;
  }

  save() {
    if (!this.game) return;
    writeSave({
      players: this.game.players.map((p) => ({ id: p.id, name: p.name, stack: p.stack, isBot: p.isBot })),
      settings: this.settings,
      history: this.history.slice(-100),
      handNumber: this.game.handNumber,
      dealerIndex: this.game.dealerIndex,
    });
  }

  pushFeed(msg) {
    this.feed = [...this.feed.slice(-7), msg];
  }

  onEvent(e) {
    if (!this.game) return;
    if (e.type === 'action') {
      const p = this.game.players.find((x) => x.id === e.playerId);
      this.pushFeed(`${p?.name ?? e.playerId} ${describeAction(e.action, e.amount)}`);
    } else if (e.type === 'phase' && e.cards?.length) {
      this.pushFeed(`${e.phase}: ${cardsToString(e.cards)}`);
    } else if (e.type === 'hand-result') {
      this.banner = e;
      this.save();
    } else if (e.type === 'game-over') {
      this.gameOver = true;
      this.save();
    }
    this.snap = this.game.snapshot();
  }

  pump() {
    clearTimeout(this._pumpTimer);
    if (!this.game) return;
    const phase = this.game.phase;
    if (!['preflop', 'flop', 'turn', 'river'].includes(phase)) return;
    const cur = this.game.currentPlayer();
    if (!cur) return;
    if (cur.isBot) {
      const delay = BOT_DELAY_MS[0] + Math.random() * (BOT_DELAY_MS[1] - BOT_DELAY_MS[0]);
      this._pumpTimer = setTimeout(() => {
        this.game.step();
        this.pump();
      }, delay);
    }
  }

  startHand() {
    if (!this.game) return;
    this.banner = null;
    const ok = this.game.startHand();
    if (!ok) this.gameOver = true;
    this.snap = this.game.snapshot();
    this.pump();
  }

  onAct(e) {
    const { action, amount } = e.detail;
    this.game?.act(HERO_ID, action, amount);
    this.pump();
  }

  onNewGame(e) {
    const { bots, stack, smallBlind, bigBlind } = e.detail;
    this.settings = { bots, stack, smallBlind, bigBlind };
    clearSave();
    const players = [
      { id: HERO_ID, name: HERO_NAME, stack, isBot: false },
      ...BOT_NAMES.slice(0, bots).map((name, i) => ({ id: `bot${i}`, name, stack, isBot: true })),
    ];
    this.buildGame(players, this.settings);
    this.gameOver = false;
    this.showNewGame = false;
    this.feed = [];
    this.save();
    this.startHand();
  }

  onInstall() {
    if (this.installEvent) {
      this.installEvent.prompt();
      this.installEvent = null;
      this.installReady = false;
    }
  }

  heroLegal() {
    if (!this.game) return null;
    const cur = this.game.currentPlayer();
    if (cur && cur.id === HERO_ID) return this.game.legalActionsFor(HERO_ID);
    return null;
  }

  renderBanner() {
    const b = this.banner;
    if (!b) return html``;
    const heroNet = b.net?.[HERO_ID] ?? 0;
    const winners = (b.winners || []).map((w) => {
      const p = b.showdown?.find((x) => x.id === w.id);
      return `${p?.name ?? w.id} wins ${w.amount}${w.handName ? ` with ${w.handName}` : ''}`;
    }).join(' · ');
    return html`
      <div class="banner ${heroNet > 0 ? 'win' : heroNet < 0 ? 'loss' : ''}">
        <div class="banner-title">${winners || 'Hand over'}</div>
        <div class="banner-sub">
          Board: ${b.community?.length ? cardsToString(b.community) : '—'}
          ${b.byFold ? ' · everyone folded' : ''}
          · You ${heroNet >= 0 ? '+' : ''}${heroNet}
        </div>
        ${this.gameOver
          ? html`<button class="primary" @click=${() => { this.gameOver = false; this.showNewGame = true; }}>New game</button>`
          : html`<button class="primary" @click=${() => this.startHand()}>Next hand</button>`}
      </div>
    `;
  }

  render() {
    const legal = this.heroLegal();
    return html`
      <header>
        <div class="brand"><span class="chip">♠</span> poteho</div>
        <div class="hand-no">${this.snap ? `hand #${this.snap.handNumber}` : ''}</div>
        <nav>
          <button class=${this.showHints ? 'on' : ''} @click=${() => { this.showHints = !this.showHints; }}>Coach</button>
          <button class=${this.showLog ? 'on' : ''} @click=${() => { this.showLog = !this.showLog; }}>History</button>
          ${this.installReady ? html`<button class="on" @click=${() => this.onInstall()}>Install</button>` : ''}
          <button @click=${() => { this.showNewGame = true; }}>New game</button>
        </nav>
      </header>
      <main>
        <section class="table-wrap">
          <poker-table .snap=${this.snap} heroId=${HERO_ID} .feed=${this.feed}></poker-table>
          ${this.renderBanner()}
          ${legal ? html`
            <div class="action-wrap">
              <action-bar
                .legal=${legal}
                .pot=${this.snap.pot}
                .currentBet=${this.snap.currentBet}
                @act=${(e) => this.onAct(e)}
              ></action-bar>
            </div>
          ` : ''}
        </section>
        ${this.showHints ? html`<hint-panel .snap=${this.snap} heroId=${HERO_ID} .legal=${legal} .enabled=${this.showHints}></hint-panel>` : ''}
      </main>
      <hand-log .history=${this.history} heroId=${HERO_ID} ?open=${this.showLog}></hand-log>
      <new-game-dialog ?open=${this.showNewGame} .initial=${this.settings} @start=${(e) => this.onNewGame(e)} @close=${() => { this.showNewGame = false; }}></new-game-dialog>
    `;
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100dvh;
      background: #07271e;
      color: #eceff1;
      font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
    }
    header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: calc(8px + env(safe-area-inset-top)) 14px 8px;
      background: rgba(0, 0, 0, 0.35);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      flex: none;
    }
    .brand { font-weight: 800; font-size: 18px; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px; }
    .brand .chip {
      display: inline-flex; align-items: center; justify-content: center;
      width: 26px; height: 26px; border-radius: 50%;
      background: #f5f0e6; color: #0b3d2e; font-size: 15px;
    }
    .hand-no { color: rgba(255, 255, 255, 0.6); font-size: 13px; flex: 1; }
    nav { display: flex; gap: 8px; }
    nav button {
      background: rgba(255, 255, 255, 0.08);
      color: #eceff1;
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 999px;
      padding: 7px 14px;
      font-size: 13px;
      cursor: pointer;
    }
    nav button.on { background: #ffd54f; color: #3e2723; border-color: #ffd54f; font-weight: 700; }
    main {
      flex: 1;
      display: flex;
      gap: 12px;
      padding: 12px;
      min-height: 0;
      position: relative;
    }
    .table-wrap { flex: 1; position: relative; display: flex; flex-direction: column; min-width: 0; }
    poker-table { flex: 1; min-height: 0; }
    .action-wrap { padding-top: 10px; flex: none; }
    hint-panel { width: 264px; flex: none; align-self: flex-start; position: sticky; top: 0; }
    .banner {
      position: absolute;
      left: 50%; top: 38%;
      transform: translate(-50%, -50%);
      background: rgba(4, 20, 15, 0.92);
      border: 1px solid rgba(255, 213, 79, 0.5);
      border-radius: 16px;
      padding: 16px 22px;
      text-align: center;
      z-index: 20;
      display: flex; flex-direction: column; gap: 8px; align-items: center;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
      max-width: min(480px, 90%);
    }
    .banner.win { border-color: #69f0ae; }
    .banner.loss { border-color: #ff8a80; }
    .banner-title { font-weight: 800; font-size: 17px; }
    .banner-sub { font-size: 12px; color: rgba(255, 255, 255, 0.7); }
    .primary {
      background: #2e7d32; color: #fff; border: none;
      border-radius: 10px; padding: 10px 20px; font-size: 14px; font-weight: 700; cursor: pointer;
    }
    hand-log { position: fixed; inset: 0; pointer-events: none; }
    hand-log[open] { pointer-events: auto; }
    @media (max-width: 760px) {
      main { flex-direction: column; }
      hint-panel { width: 100%; position: static; }
      .hand-no { display: none; }
    }
  `;
}

customElements.define('poteho-app', PotehoApp);
