import { LitElement, html, css } from 'lit';
import { monteCarloEquity, potOdds } from '../engine/equity.js';
import { preflopStrength } from '../engine/ai.js';
import { bestHand } from '../engine/evaluate.js';
import { cardsToString } from '../engine/cards.js';

const ITERATIONS = 400;

export class HintPanel extends LitElement {
  static properties = {
    snap: { type: Object },
    heroId: { type: String },
    legal: { type: Object },
    enabled: { type: Boolean },
  };

  constructor() {
    super();
    this.snap = null;
    this.heroId = 'you';
    this.legal = null;
    this.enabled = true;
    this.hint = null;
    this._seq = 0;
  }

  willUpdate(changed) {
    if (!this.enabled) return;
    if (changed.has('snap') || changed.has('legal')) {
      this.computeHint();
    }
  }

  computeHint() {
    const s = this.snap;
    const seq = (this._seq += 1);
    if (!s || !s.players) {
      this.hint = null;
      return;
    }
    const hero = s.players.find((p) => p.id === this.heroId);
    if (!hero || hero.folded || hero.hand.length < 2) {
      this.hint = { folded: true };
      return;
    }
    const opponents = s.players.filter((p) => !p.folded && p.id !== this.heroId).length;
    const toCall = this.legal ? this.legal.callAmount : Math.max(0, s.currentBet - hero.bet);
    const odds = potOdds(s.pot, toCall);
    const signature = `${s.phase}|${cardsToString(hero.hand)}|${cardsToString(s.community)}|${opponents}|${toCall}|${s.pot}`;
    if (this._lastSig === signature && this.hint) return;
    this._lastSig = signature;

    setTimeout(() => {
      if (seq !== this._seq) return;
      const mc = monteCarloEquity(hero.hand, s.community, Math.max(1, opponents), ITERATIONS);
      const made = s.community.length >= 3 ? bestHand([...hero.hand, ...s.community]) : null;
      const preflop = s.community.length === 0 ? preflopStrength(hero.hand) : null;
      this.hint = {
        equity: mc.equity,
        tie: mc.tie,
        opponents,
        toCall,
        pot: s.pot,
        odds,
        made: made ? made.name : null,
        preflop: preflop ? preflop.label : null,
        advice: this.advice(mc.equity, odds, this.legal, made),
      };
      this.requestUpdate();
    }, 20);
  }

  advice(equity, odds, legal, made) {
    const pct = (x) => `${Math.round(x * 100)}%`;
    if (!legal) return null;
    if (legal.canCheck) {
      if (equity > 0.6) return { tone: 'good', text: `Strong hand (${pct(equity)} equity) — consider betting for value.` };
      if (equity > 0.35) return { tone: 'ok', text: `Decent equity (${pct(equity)}) — a free check keeps you in the hand.` };
      return { tone: 'warn', text: `Weak hand (${pct(equity)} equity) — check and be ready to fold.` };
    }
    const need = odds.requiredEquity;
    if (equity > need + 0.05) {
      return { tone: 'good', text: `Call is +EV: you have ${pct(equity)} equity, need only ${pct(need)} (pot pays ${odds.ratio.toFixed(1)}:1).` };
    }
    if (equity > need - 0.05) {
      return { tone: 'ok', text: `Borderline: ${pct(equity)} equity vs ${pct(need)} needed. Position and implied odds decide.` };
    }
    return { tone: 'bad', text: `Fold: you have ${pct(equity)} equity but need ${pct(need)} — the price is wrong.` };
  }

  render() {
    if (!this.enabled) return html``;
    const h = this.hint;
    if (!h) return html`<aside class="panel"><h3>Coach</h3><p class="dim">Waiting for a hand…</p></aside>`;
    if (h.folded) return html`<aside class="panel"><h3>Coach</h3><p class="dim">You folded — watch and learn.</p></aside>`;
    const pct = (x) => `${Math.round(x * 100)}%`;
    return html`
      <aside class="panel">
        <h3>Coach</h3>
        ${h.preflop ? html`<div class="row"><span>Starting hand</span><b>${h.preflop}</b></div>` : ''}
        ${h.made ? html`<div class="row"><span>Made hand</span><b>${h.made}</b></div>` : ''}
        <div class="row"><span>Equity vs ${h.opponents} opp.</span><b>${pct(h.equity)}</b></div>
        <div class="equity-bar"><div class="fill" style="width: ${Math.round(h.equity * 100)}%"></div></div>
        <div class="row"><span>Pot</span><b>${h.pot}</b></div>
        <div class="row"><span>To call</span><b>${h.toCall}</b></div>
        ${h.toCall > 0 ? html`
          <div class="row"><span>Pot odds</span><b>${h.odds.ratio.toFixed(1)} : 1</b></div>
          <div class="row"><span>Equity needed</span><b>${pct(h.odds.requiredEquity)}</b></div>
        ` : html`<div class="row"><span>Pot odds</span><b>free check</b></div>`}
        ${h.advice ? html`<p class="advice ${h.advice.tone}">${h.advice.text}</p>` : ''}
      </aside>
    `;
  }

  static styles = css`
    .panel {
      background: rgba(0, 0, 0, 0.72);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 16px;
      padding: 12px 14px;
      color: #eceff1;
      font-size: 13px;
    }
    h3 { margin: 0 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 2px; color: #ffd54f; }
    .dim { color: rgba(255,255,255,0.55); margin: 0; }
    .row { display: flex; justify-content: space-between; gap: 8px; padding: 2px 0; }
    .row b { color: #fff; font-variant-numeric: tabular-nums; }
    .equity-bar { height: 8px; border-radius: 4px; background: rgba(255,255,255,0.12); margin: 6px 0; overflow: hidden; }
    .equity-bar .fill { height: 100%; background: linear-gradient(90deg, #ef5350, #ffd54f 45%, #66bb6a); }
    .advice { border-radius: 10px; padding: 8px 10px; margin: 8px 0 0; line-height: 1.35; }
    .advice.good { background: rgba(46, 125, 50, 0.35); }
    .advice.ok { background: rgba(255, 213, 79, 0.18); }
    .advice.warn { background: rgba(255, 167, 38, 0.2); }
    .advice.bad { background: rgba(198, 40, 40, 0.35); }
  `;
}

customElements.define('hint-panel', HintPanel);
