import test from 'node:test';
import assert from 'node:assert/strict';
import { monteCarloEquity, potOdds } from '../src/engine/equity.js';
import { mulberry32 } from '../src/engine/cards.js';

const c = (rank, suit) => ({ rank, suit });

test('pocket aces have high equity preflop against 3 opponents', () => {
  const hole = [c(14, 's'), c(14, 'h')];
  const { equity } = monteCarloEquity(hole, [], 3, 400, mulberry32(1));
  assert.ok(equity > 0.6, `AA equity vs 3 should be > 0.6, got ${equity}`);
  assert.ok(equity < 0.95);
});

test('trash hand has low equity on the river with no improvement', () => {
  const hole = [c(7, 's'), c(2, 'd')];
  const board = [c(14, 'h'), c(13, 'h'), c(11, 'c'), c(9, 's'), c(5, 'h')];
  const { equity } = monteCarloEquity(hole, board, 1, 200, mulberry32(2));
  assert.ok(equity < 0.1, `72o on A K Q 9 5 board should be near 0, got ${equity}`);
});

test('flush draw plus overcard outs on flop lands around 45%', () => {
  const hole = [c(7, 'h'), c(2, 'h')];
  const board = [c(9, 'h'), c(5, 'h'), c(13, 'c')];
  const { equity } = monteCarloEquity(hole, board, 1, 800, mulberry32(3));
  assert.ok(equity > 0.4 && equity < 0.55, `flush draw equity expected ~0.45, got ${equity}`);
});

test('ace high beats most random hands heads up', () => {
  const hole = [c(14, 'h'), c(10, 'h')];
  const board = [c(2, 'd'), c(6, 'c'), c(13, 's')];
  const { equity } = monteCarloEquity(hole, board, 1, 800, mulberry32(4));
  assert.ok(equity > 0.4 && equity < 0.6, `ace high equity expected ~0.5, got ${equity}`);
});

test('pot odds math', () => {
  const odds = potOdds(90, 10);
  assert.equal(odds.ratio, 9);
  assert.ok(Math.abs(odds.requiredEquity - 0.1) < 1e-9);
  assert.equal(potOdds(50, 0).requiredEquity, 0);
});
