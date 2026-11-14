import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate5, bestHand, compareHands, CATEGORY } from '../src/engine/evaluate.js';

const c = (rank, suit) => ({ rank, suit });

test('royal flush beats straight flush beats quads', () => {
  const royal = [c(14, 's'), c(13, 's'), c(12, 's'), c(11, 's'), c(10, 's')];
  const sf = [c(9, 'h'), c(8, 'h'), c(7, 'h'), c(6, 'h'), c(5, 'h')];
  const quads = [c(9, 's'), c(9, 'h'), c(9, 'd'), c(9, 'c'), c(2, 's')];
  assert.equal(evaluate5(royal).category, CATEGORY.STRAIGHT_FLUSH);
  assert.equal(evaluate5(royal).name, 'Royal flush');
  assert.ok(compareHands(evaluate5(royal), evaluate5(sf)) > 0);
  assert.ok(compareHands(evaluate5(sf), evaluate5(quads)) > 0);
});

test('full house beats flush beats straight', () => {
  const fh = [c(7, 's'), c(7, 'h'), c(7, 'd'), c(4, 'c'), c(4, 's')];
  const flush = [c(2, 'd'), c(5, 'd'), c(9, 'd'), c(11, 'd'), c(13, 'd')];
  const straight = [c(9, 's'), c(8, 'h'), c(7, 'd'), c(6, 'c'), c(5, 's')];
  assert.equal(evaluate5(fh).category, CATEGORY.FULL_HOUSE);
  assert.equal(evaluate5(flush).category, CATEGORY.FLUSH);
  assert.equal(evaluate5(straight).category, CATEGORY.STRAIGHT);
  assert.ok(compareHands(evaluate5(fh), evaluate5(flush)) > 0);
  assert.ok(compareHands(evaluate5(flush), evaluate5(straight)) > 0);
});

test('wheel straight A-2-3-4-5 is a 5-high straight', () => {
  const wheel = [c(14, 's'), c(2, 'h'), c(3, 'd'), c(4, 'c'), c(5, 's')];
  const result = evaluate5(wheel);
  assert.equal(result.category, CATEGORY.STRAIGHT);
  assert.equal(result.ranks[0], 5);
  const sixHigh = [c(6, 's'), c(2, 'h'), c(3, 'd'), c(4, 'c'), c(5, 's')];
  assert.ok(compareHands(evaluate5(sixHigh), result) > 0);
});

test('two pair and one pair with kickers', () => {
  const twoPair = [c(11, 's'), c(11, 'h'), c(4, 'd'), c(4, 'c'), c(9, 's')];
  const result = evaluate5(twoPair);
  assert.equal(result.category, CATEGORY.TWO_PAIR);
  assert.deepEqual(result.ranks, [11, 4, 9]);
  const pair = [c(8, 's'), c(8, 'h'), c(13, 'd'), c(10, 'c'), c(3, 's')];
  const pr = evaluate5(pair);
  assert.equal(pr.category, CATEGORY.ONE_PAIR);
  assert.deepEqual(pr.ranks, [8, 13, 10, 3]);
  assert.ok(compareHands(result, pr) > 0);
});

test('bestHand picks the best 5 of 7', () => {
  const seven = [
    c(14, 's'), c(14, 'h'), c(14, 'd'), c(2, 'c'), c(2, 's'), c(9, 'h'), c(5, 'd'),
  ];
  const best = bestHand(seven);
  assert.equal(best.category, CATEGORY.FULL_HOUSE);
  assert.deepEqual(best.ranks, [14, 2]);
});

test('flush uses all five ranks for tiebreak', () => {
  const a = [c(14, 'd'), c(11, 'd'), c(9, 'd'), c(6, 'd'), c(3, 'd')];
  const b = [c(14, 'h'), c(11, 'h'), c(9, 'h'), c(6, 'h'), c(2, 'h')];
  assert.ok(compareHands(evaluate5(a), evaluate5(b)) > 0);
});
