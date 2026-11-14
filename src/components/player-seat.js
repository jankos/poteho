import { LitElement, html, css } from 'lit';
import './card-el.js';

export class PlayerSeat extends LitElement {
  static properties = {
    player: { type: Object },
    isHero: { type: Boolean },
    showCards: { type: Boolean },
  };

  constructor() {
    super();
    this.player = null;
    this.isHero = false;
    this.showCards = false;
  }

  render() {
    const p = this.player;
    if (!p) return html``;
    const classes = [
      'seat',
      p.folded ? 'folded' : '',
      p.current ? 'current' : '',
      p.allIn ? 'allin' : '',
      this.isHero ? 'hero' : '',
    ].join(' ');
    const reveal = this.showCards || this.isHero;
    return html`
      <div class=${classes}>
        <div class="cards">
          ${p.hand.length
            ? p.hand.map((c) => html`<card-el .card=${c} ?faceDown=${!reveal} small></card-el>`)
            : html`<span class="empty">out</span>`}
        </div>
        <div class="plate">
          ${p.dealer ? html`<span class="dealer">D</span>` : ''}
          <span class="avatar">${(p.name || '?').slice(0, 1).toUpperCase()}</span>
          <span class="meta">
            <span class="name">${p.name}</span>
            <span class="stack">${p.stack}</span>
          </span>
          ${p.bet > 0 ? html`<span class="bet">${p.bet}</span>` : ''}
        </div>
        ${p.lastAction ? html`<div class="action">${p.lastAction}</div>` : ''}
      </div>
    `;
  }

  static styles = css`
    :host { position: absolute; transform: translate(-50%, -50%); z-index: 2; }
    .seat { display: flex; flex-direction: column; align-items: center; gap: 2px; }
    .cards { display: flex; gap: 4px; min-height: 40px; }
    .empty { color: rgba(255,255,255,0.35); font-size: 11px; align-self: center; }
    .plate {
      position: relative;
      display: flex;
      align-items: center;
      gap: 6px;
      background: rgba(0, 0, 0, 0.55);
      border: 2px solid rgba(255, 255, 255, 0.18);
      border-radius: 999px;
      padding: 4px 12px 4px 4px;
      color: #fff;
      min-width: 108px;
    }
    .seat.current .plate { border-color: #ffd54f; box-shadow: 0 0 12px rgba(255, 213, 79, 0.55); }
    .seat.folded .plate, .seat.folded .cards { opacity: 0.38; filter: grayscale(0.7); }
    .avatar {
      width: 28px; height: 28px; border-radius: 50%;
      background: linear-gradient(135deg, #26a69a, #00695c);
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 14px; flex: none;
    }
    .hero .avatar { background: linear-gradient(135deg, #ffb300, #e65100); }
    .meta { display: flex; flex-direction: column; line-height: 1.1; }
    .name { font-size: 12px; font-weight: 600; max-width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .stack { font-size: 12px; color: #ffd54f; font-variant-numeric: tabular-nums; }
    .dealer {
      position: absolute; top: -9px; right: -7px;
      width: 18px; height: 18px; border-radius: 50%;
      background: #f5f0e6; color: #111;
      font-size: 11px; font-weight: 800;
      display: flex; align-items: center; justify-content: center;
    }
    .bet {
      position: absolute; bottom: -10px; left: 50%; transform: translateX(-50%);
      background: #ffd54f; color: #4e342e;
      font-size: 11px; font-weight: 800;
      border-radius: 999px; padding: 1px 8px;
      font-variant-numeric: tabular-nums;
    }
    .action { font-size: 11px; color: #ffe082; text-shadow: 0 1px 2px #000; min-height: 13px; }
  `;
}

customElements.define('player-seat', PlayerSeat);
