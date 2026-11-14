import { createDeck, shuffle, cardsToString, defaultRng } from './cards.js';
import { bestHand, compareHands, HAND_NAMES } from './evaluate.js';
import { decideAction } from './ai.js';

export const PHASES = ['preflop', 'flop', 'turn', 'river', 'showdown', 'complete'];

const STREET_CARDS = { flop: 3, turn: 1, river: 1 };
const STREET_ORDER = ['flop', 'turn', 'river'];

function computeSidePots(players) {
  const contribs = players
    .filter((p) => p.totalBet > 0)
    .map((p) => ({ id: p.id, amount: p.totalBet, folded: p.folded }));
  const pots = [];
  let remaining = contribs.filter((c) => c.amount > 0);
  while (remaining.length > 0) {
    const min = Math.min(...remaining.map((c) => c.amount));
    const pot = { amount: 0, eligible: [] };
    for (const c of contribs) {
      if (c.amount <= 0) continue;
      pot.amount += min;
      c.amount -= min;
      if (!c.folded) pot.eligible.push(c.id);
    }
    if (pot.amount > 0) pots.push(pot);
    remaining = contribs.filter((c) => c.amount > 0);
  }
  return pots;
}

export class HoldemGame {
  constructor({ players, smallBlind = 5, bigBlind = 10, onEvent = () => {}, rng = defaultRng() }) {
    this.smallBlind = smallBlind;
    this.bigBlind = bigBlind;
    this.onEvent = onEvent;
    this.rng = rng;
    this.players = players.map((p) => ({
      id: p.id,
      name: p.name,
      stack: p.stack,
      isBot: Boolean(p.isBot),
      avatar: p.avatar || null,
      hand: [],
      bet: 0,
      totalBet: 0,
      startStack: p.stack,
      folded: false,
      allIn: false,
      acted: false,
      lastAction: null,
    }));
    this.dealerIndex = -1;
    this.community = [];
    this.phase = 'idle';
    this.currentBet = 0;
    this.minRaise = bigBlind;
    this.currentPlayerIndex = -1;
    this.handNumber = 0;
    this.history = [];
    this.deck = [];
  }

  emit(event) {
    this.onEvent(event);
  }

  activePlayers() {
    return this.players.filter((p) => p.stack > 0 || p.totalBet > 0 || (!p.folded && p.hand.length > 0));
  }

  inHandPlayers() {
    return this.players.filter((p) => !p.folded && p.hand.length > 0);
  }

  actors() {
    return this.inHandPlayers().filter((p) => !p.allIn && p.stack > 0);
  }

  pot() {
    return this.players.reduce((sum, p) => sum + p.totalBet, 0);
  }

  snapshot() {
    return {
      phase: this.phase,
      handNumber: this.handNumber,
      community: this.community.map((c) => ({ ...c })),
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        stack: p.stack,
        isBot: p.isBot,
        avatar: p.avatar,
        hand: p.hand.map((c) => ({ ...c })),
        bet: p.bet,
        totalBet: p.totalBet,
        folded: p.folded,
        allIn: p.allIn,
        lastAction: p.lastAction,
        current: this.players[this.currentPlayerIndex] === p && this.awaitingAction(),
        dealer: this.players[this.dealerIndex] === p,
      })),
      pot: this.pot(),
      currentBet: this.currentBet,
      minRaise: this.minRaise,
      currentPlayerIndex: this.currentPlayerIndex,
      smallBlind: this.smallBlind,
      bigBlind: this.bigBlind,
    };
  }

  awaitingAction() {
    return ['preflop', 'flop', 'turn', 'river'].includes(this.phase);
  }

  currentPlayer() {
    if (!this.awaitingAction()) return null;
    return this.players[this.currentPlayerIndex] || null;
  }

  legalActionsFor(playerId) {
    const player = this.players.find((p) => p.id === playerId);
    if (!player || !this.awaitingAction() || this.currentPlayer()?.id !== playerId) {
      return { canFold: false, canCheck: false, canCall: false, canRaise: false, callAmount: 0, minRaiseTo: 0, maxRaiseTo: 0 };
    }
    const toCall = Math.min(this.currentBet - player.bet, player.stack);
    const canCheck = this.currentBet === player.bet;
    const maxRaiseTo = player.bet + player.stack;
    const minRaiseTo = Math.min(this.currentBet + this.minRaise, maxRaiseTo);
    const canRaise = player.stack > toCall && maxRaiseTo > this.currentBet;
    return {
      canFold: !canCheck,
      canCheck,
      canCall: toCall > 0,
      canRaise,
      callAmount: toCall,
      minRaiseTo,
      maxRaiseTo,
    };
  }

  startHand() {
    const seated = this.players.filter((p) => p.stack > 0);
    if (seated.length < 2) {
      this.phase = 'complete';
      this.emit({ type: 'game-over', winner: seated[0]?.id ?? null });
      return false;
    }
    this.handNumber += 1;
    this.deck = shuffle(createDeck(), this.rng);
    this.community = [];
    this.phase = 'preflop';
    this.currentBet = 0;
    this.minRaise = this.bigBlind;

    for (const p of this.players) {
      p.hand = [];
      p.bet = 0;
      p.totalBet = 0;
      p.startStack = p.stack;
      p.folded = p.stack <= 0;
      p.allIn = false;
      p.acted = false;
      p.lastAction = null;
      if (!p.folded) {
        p.hand = [this.deck.pop(), this.deck.pop()];
      }
    }

    this.dealerIndex = this.nextDealerIndex();
    const inHand = this.inHandPlayers();
    const headsUp = inHand.length === 2;
    const sbIndex = headsUp ? this.dealerIndex : this.nextIndex(this.dealerIndex, (p) => !p.folded);
    const bbIndex = this.nextIndex(sbIndex, (p) => !p.folded);

    this.postBlind(sbIndex, this.smallBlind, 'small blind');
    this.postBlind(bbIndex, this.bigBlind, 'big blind');

    this.currentBet = Math.max(this.smallBlind, this.bigBlind);
    this.minRaise = this.bigBlind;
    this.currentPlayerIndex = this.nextIndex(bbIndex, (p) => !p.folded && !p.allIn && p.stack > 0);

    this.emit({
      type: 'hand-start',
      handNumber: this.handNumber,
      dealerIndex: this.dealerIndex,
      players: this.snapshot().players,
    });
    this.emit({ type: 'deal', players: this.snapshot().players });
    this.emit({ type: 'phase', phase: this.phase });
    return true;
  }

  postBlind(index, amount, label) {
    const p = this.players[index];
    const posted = Math.min(amount, p.stack);
    p.stack -= posted;
    p.bet += posted;
    p.totalBet += posted;
    if (p.stack === 0) p.allIn = true;
    p.lastAction = label;
    this.emit({ type: 'blind', playerId: p.id, amount: posted, label });
  }

  nextDealerIndex() {
    if (this.dealerIndex === -1) {
      return this.players.findIndex((p) => p.stack > 0);
    }
    return this.nextIndex(this.dealerIndex, (p) => p.stack > 0);
  }

  nextIndex(fromIndex, predicate) {
    const n = this.players.length;
    for (let i = 1; i <= n; i += 1) {
      const idx = (fromIndex + i) % n;
      if (predicate(this.players[idx])) return idx;
    }
    return fromIndex;
  }

  act(playerId, action, amount = 0) {
    const player = this.players.find((p) => p.id === playerId);
    if (!player || !this.awaitingAction()) return false;
    if (this.currentPlayer()?.id !== playerId) return false;

    const legal = this.legalActionsFor(playerId);
    let normalized = action;
    if (action === 'bet' && this.currentBet === 0) normalized = 'raise';
    if (normalized === 'raise' && this.currentBet === 0) normalized = 'raise';

    if (normalized === 'fold') {
      player.folded = true;
      player.lastAction = 'fold';
      this.emit({ type: 'action', playerId, action: 'fold', amount: 0 });
    } else if (normalized === 'check') {
      if (!legal.canCheck) return false;
      player.acted = true;
      player.lastAction = 'check';
      this.emit({ type: 'action', playerId, action: 'check', amount: 0 });
    } else if (normalized === 'call') {
      const toCall = legal.callAmount;
      if (toCall <= 0) {
        player.acted = true;
        player.lastAction = 'check';
        this.emit({ type: 'action', playerId, action: 'check', amount: 0 });
      } else {
        const pay = Math.min(toCall, player.stack);
        player.stack -= pay;
        player.bet += pay;
        player.totalBet += pay;
        player.acted = true;
        if (player.stack === 0) player.allIn = true;
        player.lastAction = pay < toCall ? `all-in ${player.bet}` : `call ${player.bet}`;
        this.emit({ type: 'action', playerId, action: pay < toCall ? 'all-in' : 'call', amount: player.bet, toCall: pay });
      }
    } else if (normalized === 'raise') {
      if (!legal.canRaise) return false;
      let raiseTo = Math.round(amount);
      raiseTo = Math.max(raiseTo, legal.minRaiseTo);
      raiseTo = Math.min(raiseTo, legal.maxRaiseTo);
      const increment = raiseTo - this.currentBet;
      if (increment > 0 && increment < this.minRaise && raiseTo < legal.maxRaiseTo) {
        raiseTo = Math.min(legal.minRaiseTo, legal.maxRaiseTo);
      }
      const pay = raiseTo - player.bet;
      player.stack -= pay;
      player.bet = raiseTo;
      player.totalBet += pay;
      if (player.stack === 0) player.allIn = true;
      if (increment >= this.minRaise || player.allIn) {
        this.minRaise = Math.max(this.minRaise, increment);
      }
      this.currentBet = raiseTo;
      player.acted = true;
      player.lastAction = player.allIn ? `all-in ${raiseTo}` : `raise to ${raiseTo}`;
      for (const other of this.players) {
        if (other !== player && !other.folded && !other.allIn) other.acted = false;
      }
      this.emit({ type: 'action', playerId, action: player.allIn ? 'all-in' : 'raise', amount: raiseTo });
    } else {
      return false;
    }

    this.advance();
    return true;
  }

  advance() {
    const inHand = this.inHandPlayers();
    if (inHand.length === 1) {
      this.finishByFold(inHand[0]);
      return;
    }
    if (this.roundComplete()) {
      this.nextStreet();
      return;
    }
    this.currentPlayerIndex = this.nextIndex(this.currentPlayerIndex, (p) => !p.folded && !p.allIn && p.stack > 0);
  }

  roundComplete() {
    const actors = this.actors();
    if (actors.length === 0) return true;
    return actors.every((p) => p.acted && p.bet === this.currentBet);
  }

  nextStreet() {
    const idx = STREET_ORDER.indexOf(this.phase);
    const next = idx === -1 ? 'flop' : STREET_ORDER[idx + 1];
    if (!next) {
      this.showdown();
      return;
    }
    this.phase = next;
    const count = STREET_CARDS[next];
    const cards = [];
    for (let i = 0; i < count; i += 1) {
      const card = this.deck.pop();
      this.community.push(card);
      cards.push(card);
    }
    for (const p of this.players) {
      p.bet = 0;
      p.acted = false;
    }
    this.currentBet = 0;
    this.minRaise = this.bigBlind;
    this.emit({ type: 'phase', phase: this.phase, cards });

    const inHand = this.inHandPlayers();
    if (inHand.length === 1) {
      this.finishByFold(inHand[0]);
      return;
    }
    if (this.actors().length === 0) {
      this.nextStreet();
      return;
    }
    this.currentPlayerIndex = this.nextIndex(this.dealerIndex, (p) => !p.folded && !p.allIn && p.stack > 0);
  }

  finishByFold(winner) {
    const amount = this.pot();
    winner.stack += amount;
    this.phase = 'complete';
    const result = {
      type: 'hand-result',
      handNumber: this.handNumber,
      byFold: true,
      winners: [{ id: winner.id, amount, handName: null }],
      community: this.community.map((c) => ({ ...c })),
      showdown: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        hand: p.hand.map((c) => ({ ...c })),
        folded: p.folded,
        net: p.stack - p.startStack,
      })),
      net: Object.fromEntries(this.players.map((p) => [p.id, p.stack - p.startStack])),
      pot: amount,
    };
    this.history.push(result);
    this.emit({ type: 'showdown', hands: result.showdown });
    this.emit(result);
  }

  showdown() {
    this.phase = 'showdown';
    const contenders = this.inHandPlayers();
    const hands = new Map();
    for (const p of contenders) {
      hands.set(p.id, bestHand([...p.hand, ...this.community]));
    }
    const pots = computeSidePots(this.players);
    const winnings = new Map();
    const potResults = [];
    for (const pot of pots) {
      const eligible = pot.eligible
        .map((id) => this.players.find((p) => p.id === id))
        .filter(Boolean)
        .map((p) => ({ player: p, hand: hands.get(p.id) }));
      if (eligible.length === 0) continue;
      let best = eligible[0].hand;
      for (const e of eligible.slice(1)) best = compareHands(e.hand, best) > 0 ? e.hand : best;
      const winners = eligible.filter((e) => compareHands(e.hand, best) === 0).map((e) => e.player);
      const share = Math.floor(pot.amount / winners.length);
      const remainder = pot.amount - share * winners.length;
      const ordered = winners.slice().sort((a, b) => {
        const da = (a === this.players[this.dealerIndex]) ? -1 : 0;
        return da;
      });
      winners.forEach((w, i) => {
        const amount = share + (i === 0 ? remainder : 0);
        w.stack += amount;
        winnings.set(w.id, (winnings.get(w.id) || 0) + amount);
      });
      potResults.push({
        amount: pot.amount,
        winners: winners.map((w) => ({ id: w.id, amount: share + (w === ordered[0] ? remainder : 0), handName: best.name })),
      });
    }
    this.phase = 'complete';
    const result = {
      type: 'hand-result',
      handNumber: this.handNumber,
      byFold: false,
      community: this.community.map((c) => ({ ...c })),
      showdown: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        hand: p.hand.map((c) => ({ ...c })),
        folded: p.folded,
        handName: hands.get(p.id)?.name || null,
        net: p.stack - p.startStack,
      })),
      pots: potResults,
      winners: [...winnings.entries()].map(([id, amount]) => ({
        id,
        amount,
        handName: hands.get(id)?.name || null,
      })),
      net: Object.fromEntries(this.players.map((p) => [p.id, p.stack - p.startStack])),
      pot: this.pot(),
      board: this.community.map((c) => ({ ...c })),
    };
    this.history.push(result);
    this.emit({ type: 'showdown', hands: result.showdown });
    this.emit(result);
  }

  step() {
    const player = this.currentPlayer();
    if (!player || !player.isBot) return null;
    const decision = decideAction(this, player, this.rng);
    const ok = this.act(player.id, decision.action, decision.amount || 0);
    return ok ? { playerId: player.id, ...decision } : null;
  }

  handSummary() {
    return this.history[this.history.length - 1] || null;
  }
}

export function describeAction(action, amount) {
  switch (action) {
    case 'fold': return 'folds';
    case 'check': return 'checks';
    case 'call': return `calls ${amount}`;
    case 'all-in': return `is all-in for ${amount}`;
    case 'raise': return `raises to ${amount}`;
    default: return action;
  }
}

export { HAND_NAMES, cardsToString };
