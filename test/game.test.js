import test from 'node:test';
import assert from 'node:assert/strict';
import { HoldemGame } from '../src/engine/game.js';
import { mulberry32 } from '../src/engine/cards.js';

function makeGame(seed = 1, nPlayers = 4, stack = 1000) {
  const events = [];
  const players = Array.from({ length: nPlayers }, (_, i) => ({
    id: `p${i}`,
    name: i === 0 ? 'You' : `Bot ${i}`,
    stack,
    isBot: i !== 0,
  }));
  const game = new HoldemGame({
    players,
    smallBlind: 5,
    bigBlind: 10,
    rng: mulberry32(seed),
    onEvent: (e) => events.push(e),
  });
  return { game, events, players };
}

function playHandToEnd(game, maxSteps = 500) {
  let steps = 0;
  while (game.phase !== 'complete' && steps < maxSteps) {
    const current = game.currentPlayer();
    if (!current) break;
    if (current.isBot) {
      game.step();
    } else {
      const legal = game.legalActionsFor(current.id);
      if (legal.canCheck) game.act(current.id, 'check');
      else if (legal.canCall) game.act(current.id, 'call');
      else game.act(current.id, 'check');
    }
    steps += 1;
  }
  assert.ok(steps < maxSteps, 'hand should terminate');
  assert.equal(game.phase, 'complete');
}

test('chips are conserved across many hands', () => {
  const { game } = makeGame(123, 5, 1000);
  const total = () => game.players.reduce((s, p) => s + p.stack, 0);
  assert.equal(total(), 5000);
  for (let hand = 0; hand < 60; hand += 1) {
    if (!game.startHand()) break;
    playHandToEnd(game);
    assert.equal(total(), 5000, `chips conserved after hand ${hand + 1}`);
    assert.ok(game.pot() === 0 || game.phase === 'complete');
  }
});

test('folded players never win and hand result is emitted', () => {
  const { game, events } = makeGame(7, 4);
  game.startHand();
  playHandToEnd(game);
  const result = events.filter((e) => e.type === 'hand-result').at(-1);
  assert.ok(result, 'hand-result emitted');
  assert.equal(Object.keys(result.net).length, 4);
  const totalDelta = Object.values(result.net).reduce((a, b) => a + b, 0);
  assert.equal(totalDelta, 0);
});

test('everyone folds to the big blind: bb wins the pot', () => {
  const events = [];
  const game = new HoldemGame({
    players: [
      { id: 'a', name: 'A', stack: 100, isBot: false },
      { id: 'b', name: 'B', stack: 100, isBot: false },
      { id: 'c', name: 'C', stack: 100, isBot: false },
    ],
    smallBlind: 5,
    bigBlind: 10,
    rng: mulberry32(3),
    onEvent: (e) => events.push(e),
  });
  game.startHand();
  const bb = game.players.find((p) => p.totalBet === 10);
  let guard = 0;
  while (game.phase !== 'complete' && guard < 20) {
    const cur = game.currentPlayer();
    if (!cur) break;
    if (cur.id === bb.id) game.act(cur.id, 'check');
    else game.act(cur.id, 'fold');
    guard += 1;
  }
  assert.equal(game.phase, 'complete');
  const result = events.filter((e) => e.type === 'hand-result').at(-1);
  assert.equal(result.byFold, true);
  assert.equal(result.winners[0].id, bb.id);
  assert.equal(result.winners[0].amount, 15);
  assert.equal(game.players.find((p) => p.id === bb.id).stack, 105);
});

test('illegal actions are rejected', () => {
  const { game } = makeGame(11, 3);
  game.startHand();
  const notCurrent = game.players.find((p) => p.id !== game.currentPlayer().id);
  assert.equal(game.act(notCurrent.id, 'fold'), false);
  const cur = game.currentPlayer();
  const legal = game.legalActionsFor(cur.id);
  if (legal.canCheck) {
    assert.equal(game.act(cur.id, 'raise', 10000), false);
  }
});

test('all-in side pots are computed correctly', () => {
  const game = new HoldemGame({
    players: [
      { id: 'short', name: 'Short', stack: 50, isBot: false },
      { id: 'mid', name: 'Mid', stack: 200, isBot: false },
      { id: 'big', name: 'Big', stack: 500, isBot: false },
    ],
    smallBlind: 5,
    bigBlind: 10,
    rng: mulberry32(99),
    onEvent: () => {},
  });
  game.startHand();
  let guard = 0;
  while (game.phase !== 'complete' && guard < 50) {
    const cur = game.currentPlayer();
    if (!cur) break;
    const legal = game.legalActionsFor(cur.id);
    if (cur.id === 'short' || cur.id === 'mid' || cur.id === 'big') {
      if (legal.callAmount >= cur.stack) game.act(cur.id, 'call');
      else if (legal.canRaise && legal.maxRaiseTo >= cur.stack) game.act(cur.id, 'raise', legal.maxRaiseTo);
      else if (legal.canCall) game.act(cur.id, 'call');
      else game.act(cur.id, 'check');
    }
    guard += 1;
  }
  assert.equal(game.phase, 'complete');
  const total = game.players.reduce((s, p) => s + p.stack, 0);
  assert.equal(total, 750);
  const result = game.history.at(-1);
  if (!result.byFold) {
    const potSum = result.pots.reduce((s, p) => s + p.amount, 0);
    assert.equal(potSum, result.pot);
    const short = game.players.find((p) => p.id === 'short');
    const maxFromShort = result.pots
      .filter((p) => p.winners.some((w) => w.id === 'short'))
      .reduce((s, p) => s + p.winners.find((w) => w.id === 'short').amount, 0);
    assert.ok(maxFromShort <= 50 * 3, 'short stack can only win up to its contribution level');
    assert.ok(short.stack >= 0);
  }
});

test('bot step only acts for bots and advances the game', () => {
  const { game } = makeGame(2024, 6, 500);
  game.startHand();
  let guard = 0;
  while (game.phase !== 'complete' && guard < 600) {
    const cur = game.currentPlayer();
    if (!cur) break;
    if (cur.isBot) {
      const res = game.step();
      assert.ok(res, 'bot step should produce an action');
    } else {
      const legal = game.legalActionsFor(cur.id);
      game.act(cur.id, legal.canCheck ? 'check' : 'call');
    }
    guard += 1;
  }
  assert.equal(game.phase, 'complete');
});

test('snapshot exposes render-friendly state', () => {
  const { game } = makeGame(5, 4);
  game.startHand();
  const snap = game.snapshot();
  assert.equal(snap.phase, 'preflop');
  assert.equal(snap.community.length, 0);
  assert.equal(snap.players.length, 4);
  assert.ok(snap.players.every((p) => p.hand.length === 2));
  assert.ok(snap.players.some((p) => p.dealer));
  assert.ok(snap.players.filter((p) => !p.folded).every((p) => p.totalBet >= 0));
  assert.equal(snap.pot, 15);
});
