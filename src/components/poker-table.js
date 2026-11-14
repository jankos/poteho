import { LitElement, html, css } from 'lit';
import './card-el.js';
import './player-seat.js';
import { cardsToString } from '../engine/cards.js';

function seatPosition(index, count) {
  if (index === 0) return { x: 50, y: 87 };
  const angle = (90 + (index * 360) / count) * (Math.PI / 180);
  return {
    x: 50 + 41 * Math.cos(angle),
    y: 46 + 36 * Math.sin(angle),
  };
}

export class PokerTable extends LitElement {
  static properties = {
    snap: { type: Object },
    heroId: { type: String },
    feed: { type: Array },
  };

  constructor() {
    super();
    this.snap = null;
    this.heroId = 'you';
    this.feed = [];
  }

  render() {
    const s = this.snap;
    if (!s) return html`<div class="felt empty">Press “New game” to sit down.</div>`;
    const showCards = s.phase === 'showdown' || s.phase === 'complete';
    const n = s.players.length;
    return html`
      <div class="felt">
        <div class="table-oval">
          <div class="community">
            ${[0, 1, 2, 3, 4].map((i) => html`
              <div class="slot">${s.community[i] ? html`<card-el .card=${s.community[i]}></card-el>` : ''}</div>
            `)}
          </div>
          <div class="pot">${s.phase === 'idle' ? '' : `Pot ${s.pot}`}</div>
          <div class="phase">${s.phase === 'complete' ? 'hand over' : s.phase}</div>
        </div>
        ${s.players.map((p, i) => {
          const pos = seatPosition(i, n);
          return html`<player-seat
            style="left: ${pos.x}%; top: ${pos.y}%;"
            .player=${p}
            .isHero=${p.id === this.heroId}
            ?showCards=${showCards}
          ></player-seat>`;
        })}
        <div class="feed">
          ${this.feed.map((f) => html`<div class="feed-line">${f}</div>`)}
        </div>
      </div>
    `;
  }

  static styles = css`
    :host { display: block; height: 100%; }
    .felt {
      position: relative;
      height: 100%;
      min-height: 0;
      border-radius: 24px;
      background: radial-gradient(ellipse at 50% 42%, #14634a 0%, #0d4a35 45%, #07271e 100%);
      box-shadow: inset 0 0 60px rgba(0, 0, 0, 0.55), 0 8px 30px rgba(0, 0, 0, 0.4);
      overflow: hidden;
    }
    .felt.empty {
      display: flex; align-items: center; justify-content: center;
      color: rgba(255, 255, 255, 0.6); font-size: 18px;
    }
    .table-oval {
      position: absolute;
      left: 50%; top: 46%;
      transform: translate(-50%, -50%);
      width: min(72%, 560px);
      aspect-ratio: 2 / 1;
      border-radius: 50%;
      border: 10px solid #5d4037;
      box-shadow: inset 0 0 40px rgba(0, 0, 0, 0.5), 0 4px 14px rgba(0,0,0,0.4);
      background: radial-gradient(ellipse at 50% 45%, rgba(255,255,255,0.06), transparent 70%);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }
    .community { display: flex; gap: 8px; min-height: 70px; align-items: center; }
    .slot { width: clamp(44px, 7vw, 68px); }
    .pot { color: #ffd54f; font-weight: 800; font-size: clamp(14px, 2.4vw, 20px); text-shadow: 0 1px 3px #000; font-variant-numeric: tabular-nums; }
    .phase { color: rgba(255,255,255,0.55); font-size: 12px; text-transform: uppercase; letter-spacing: 2px; }
    .feed {
      position: absolute;
      left: 10px; bottom: 8px;
      display: flex; flex-direction: column-reverse; gap: 2px;
      max-width: 46%;
      pointer-events: none;
    }
    .feed-line {
      font-size: 11px; color: rgba(255, 255, 255, 0.85);
      background: rgba(0, 0, 0, 0.35);
      border-radius: 6px; padding: 2px 8px; width: fit-content;
    }
  `;
}

customElements.define('poker-table', PokerTable);

export { cardsToString };
