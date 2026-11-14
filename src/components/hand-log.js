import { LitElement, html, css } from 'lit';
import './card-el.js';
import { cardsToString } from '../engine/cards.js';

export class HandLog extends LitElement {
  static properties = {
    history: { type: Array },
    heroId: { type: String },
    open: { type: Boolean },
  };

  constructor() {
    super();
    this.history = [];
    this.heroId = 'you';
    this.open = false;
  }

  render() {
    if (!this.open) return html``;
    const rows = this.history.slice(-30).reverse();
    return html`
      <aside class="drawer">
        <h3>Hand history</h3>
        ${rows.length === 0 ? html`<p class="dim">No hands played yet.</p>` : html`
          <ol>
            ${rows.map((h) => {
              const heroNet = h.net?.[this.heroId] ?? 0;
              const winners = (h.winners || [])
                .map((w) => {
                  const name = h.showdown?.find((p) => p.id === w.id)?.name || w.id;
                  return `${name} +${w.amount}${w.handName ? ` (${w.handName})` : ''}`;
                })
                .join(', ');
              return html`
                <li>
                  <div class="head">
                    <b>#${h.handNumber}</b>
                    <span class="board">${h.community?.length ? cardsToString(h.community) : '—'}</span>
                    <span class="net ${heroNet >= 0 ? 'pos' : 'neg'}">${heroNet >= 0 ? '+' : ''}${heroNet}</span>
                  </div>
                  <div class="winners">${winners}</div>
                </li>
              `;
            })}
          </ol>
        `}
      </aside>
    `;
  }

  static styles = css`
    .drawer {
      position: absolute;
      top: 0; right: 0; bottom: 0;
      width: min(320px, 85vw);
      background: rgba(4, 20, 15, 0.96);
      border-left: 1px solid rgba(255, 255, 255, 0.15);
      padding: 14px;
      overflow-y: auto;
      z-index: 30;
      color: #eceff1;
    }
    h3 { margin: 0 0 10px; font-size: 13px; text-transform: uppercase; letter-spacing: 2px; color: #ffd54f; }
    .dim { color: rgba(255,255,255,0.5); }
    ol { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 10px; }
    li { background: rgba(255,255,255,0.06); border-radius: 10px; padding: 8px 10px; font-size: 12px; }
    .head { display: flex; align-items: center; gap: 8px; }
    .board { flex: 1; letter-spacing: 1px; }
    .net.pos { color: #69f0ae; } .net.neg { color: #ff8a80; }
    .net { font-weight: 700; font-variant-numeric: tabular-nums; }
    .winners { color: rgba(255,255,255,0.75); margin-top: 3px; }
  `;
}

customElements.define('hand-log', HandLog);
