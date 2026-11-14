import { LitElement, html, css } from 'lit';

export class NewGameDialog extends LitElement {
  static properties = {
    open: { type: Boolean },
    initial: { type: Object },
  };

  constructor() {
    super();
    this.open = false;
    this.initial = { bots: 4, stack: 1000, smallBlind: 5, bigBlind: 10 };
  }

  start() {
    const bots = Number(this.renderRoot.querySelector('#bots').value);
    const stack = Number(this.renderRoot.querySelector('#stack').value);
    const blinds = this.renderRoot.querySelector('#blinds').value.split('/').map(Number);
    this.dispatchEvent(new CustomEvent('start', {
      detail: { bots, stack, smallBlind: blinds[0], bigBlind: blinds[1] },
      bubbles: true,
      composed: true,
    }));
  }

  render() {
    if (!this.open) return html``;
    const i = this.initial;
    return html`
      <div class="overlay" @click=${(e) => { if (e.target === e.currentTarget) this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true })); }}>
        <div class="dialog">
          <h2>New game</h2>
          <label>Opponents
            <select id="bots">
              ${[2, 3, 4, 5].map((n) => html`<option value=${n} ?selected=${n === i.bots}>${n} bots</option>`)}
            </select>
          </label>
          <label>Starting stack
            <select id="stack">
              ${[500, 1000, 2000, 5000].map((n) => html`<option value=${n} ?selected=${n === i.stack}>${n}</option>`)}
            </select>
          </label>
          <label>Blinds
            <select id="blinds">
              ${['5/10', '10/20', '25/50', '50/100'].map((b) => html`<option value=${b} ?selected=${b === `${i.smallBlind}/${i.bigBlind}`}>${b}</option>`)}
            </select>
          </label>
          <div class="actions">
            <button class="primary" @click=${() => this.start()}>Sit down</button>
          </div>
          <p class="note">Train against bots with live equity &amp; pot-odds coaching. Progress is saved on this device.</p>
        </div>
      </div>
    `;
  }

  static styles = css`
    .overlay {
      position: fixed; inset: 0; z-index: 50;
      background: rgba(0, 0, 0, 0.6);
      display: flex; align-items: center; justify-content: center;
      padding: 16px;
    }
    .dialog {
      background: #0d352a;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 18px;
      padding: 22px;
      width: min(340px, 92vw);
      color: #eceff1;
      display: flex; flex-direction: column; gap: 12px;
    }
    h2 { margin: 0; color: #ffd54f; font-size: 20px; }
    label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: #b0bec5; }
    select {
      background: #07271e; color: #fff;
      border: 1px solid rgba(255, 255, 255, 0.25);
      border-radius: 10px; padding: 9px 10px; font-size: 15px;
    }
    .actions { display: flex; justify-content: flex-end; }
    .primary {
      background: #2e7d32; color: #fff; border: none;
      border-radius: 10px; padding: 11px 22px; font-size: 15px; font-weight: 700; cursor: pointer;
    }
    .note { font-size: 11px; color: rgba(255,255,255,0.5); margin: 0; line-height: 1.4; }
  `;
}

customElements.define('new-game-dialog', NewGameDialog);
