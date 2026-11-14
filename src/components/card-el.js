import { LitElement, html, css } from 'lit';
import { cardLabel, cardColor, SUIT_SYMBOLS, RANK_LABELS } from '../engine/cards.js';

export class CardEl extends LitElement {
  static properties = {
    card: { type: Object },
    faceDown: { type: Boolean },
    small: { type: Boolean },
  };

  constructor() {
    super();
    this.card = null;
    this.faceDown = false;
    this.small = false;
  }

  render() {
    if (this.faceDown || !this.card) {
      return html`<div class="card back ${this.small ? 'small' : ''}"></div>`;
    }
    const red = cardColor(this.card) === 'red';
    const label = RANK_LABELS[this.card.rank];
    const suit = SUIT_SYMBOLS[this.card.suit];
    return html`
      <div class="card ${red ? 'red' : ''} ${this.small ? 'small' : ''}">
        <span class="corner top">${label}<br />${suit}</span>
        <span class="pip">${suit}</span>
        <span class="corner bottom">${label}<br />${suit}</span>
      </div>
    `;
  }

  static styles = css`
    :host { display: inline-block; }
    .card {
      position: relative;
      width: clamp(44px, 7vw, 68px);
      aspect-ratio: 5 / 7;
      border-radius: 8%;
      background: #f8f6ef;
      color: #1c1c1c;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.45);
      font-weight: 700;
      user-select: none;
    }
    .card.red { color: #c62828; }
    .card.small { width: clamp(30px, 4.5vw, 44px); }
    .corner {
      position: absolute;
      font-size: clamp(10px, 1.6vw, 15px);
      line-height: 1.05;
      text-align: center;
    }
    .corner.top { top: 6%; left: 8%; }
    .corner.bottom { bottom: 6%; right: 8%; transform: rotate(180deg); }
    .pip {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: clamp(18px, 3vw, 30px);
    }
    .card.back {
      background:
        repeating-linear-gradient(45deg, #7a1f2b 0 6px, #5c1620 6px 12px);
      border: 3px solid #f5f0e6;
      box-sizing: border-box;
    }
  `;
}

customElements.define('card-el', CardEl);
