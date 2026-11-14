import { LitElement, html, css } from 'lit';

export class ActionBar extends LitElement {
  static properties = {
    legal: { type: Object },
    pot: { type: Number },
    currentBet: { type: Number },
    disabled: { type: Boolean },
  };

  constructor() {
    super();
    this.legal = null;
    this.pot = 0;
    this.currentBet = 0;
    this.disabled = false;
    this.raiseTo = 0;
  }

  willUpdate(changed) {
    if (changed.has('legal') && this.legal?.canRaise) {
      this.raiseTo = this.legal.minRaiseTo;
    }
  }

  emit(action, amount = 0) {
    if (this.disabled) return;
    this.dispatchEvent(new CustomEvent('act', { detail: { action, amount }, bubbles: true, composed: true }));
  }

  preset(kind) {
    const l = this.legal;
    if (!l?.canRaise) return;
    const toCall = l.callAmount;
    let target;
    if (kind === 'min') target = l.minRaiseTo;
    else if (kind === 'half') target = this.currentBet + Math.round((this.pot + toCall) / 2);
    else if (kind === 'pot') target = this.currentBet + this.pot + toCall;
    else target = l.maxRaiseTo;
    this.raiseTo = Math.max(l.minRaiseTo, Math.min(l.maxRaiseTo, target));
  }

  render() {
    const l = this.legal;
    if (!l) return html``;
    const callLabel = l.canCheck ? 'Check' : `Call ${l.callAmount}`;
    const callAction = l.canCheck ? 'check' : 'call';
    return html`
      <div class="bar">
        <div class="info">
          <span>Pot <b>${this.pot}</b></span>
          <span>To call <b>${l.callAmount}</b></span>
        </div>
        <div class="buttons">
          ${l.canFold ? html`<button class="btn fold" ?disabled=${this.disabled} @click=${() => this.emit('fold')}>Fold</button>` : ''}
          <button class="btn call" ?disabled=${this.disabled} @click=${() => this.emit(callAction)}>${callLabel}</button>
          ${l.canRaise ? html`
            <div class="raise">
              <button class="btn raise" ?disabled=${this.disabled} @click=${() => this.emit('raise', this.raiseTo)}>
                ${this.currentBet === 0 ? 'Bet' : 'Raise to'} ${this.raiseTo}
              </button>
              <input
                type="range"
                min=${l.minRaiseTo}
                max=${l.maxRaiseTo}
                step="5"
                .value=${String(this.raiseTo)}
                @input=${(e) => { this.raiseTo = Number(e.target.value); }}
              />
              <div class="presets">
                <button @click=${() => this.preset('min')}>Min</button>
                <button @click=${() => this.preset('half')}>½ Pot</button>
                <button @click=${() => this.preset('pot')}>Pot</button>
                <button @click=${() => this.preset('allin')}>All-in</button>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  static styles = css`
    :host { display: block; }
    .bar {
      display: flex; flex-wrap: wrap; align-items: center; gap: 10px;
      background: rgba(0, 0, 0, 0.72);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 16px;
      padding: 10px 14px;
      backdrop-filter: blur(6px);
    }
    .info { display: flex; gap: 14px; color: #cfd8dc; font-size: 13px; }
    .info b { color: #ffd54f; font-variant-numeric: tabular-nums; }
    .buttons { display: flex; align-items: center; gap: 10px; flex: 1; flex-wrap: wrap; }
    .btn {
      border: none; border-radius: 10px;
      padding: 10px 18px;
      font-size: 15px; font-weight: 700;
      cursor: pointer; color: #fff;
    }
    .btn:disabled { opacity: 0.45; cursor: default; }
    .fold { background: #c62828; }
    .call { background: #1565c0; }
    .raise { background: #2e7d32; }
    .raise-box { display: flex; align-items: center; gap: 10px; }
    .raise { display: flex; flex-direction: column; gap: 6px; min-width: 220px; }
    .raise input[type='range'] { width: 100%; accent-color: #ffd54f; }
    .presets { display: flex; gap: 6px; }
    .presets button {
      background: rgba(255, 255, 255, 0.12); color: #fff;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px; padding: 4px 10px; font-size: 12px; cursor: pointer;
    }
    .presets button:hover { background: rgba(255, 255, 255, 0.22); }
  `;
}

customElements.define('action-bar', ActionBar);
