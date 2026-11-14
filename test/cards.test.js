import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeck, shuffle, mulberry32, cardLabel } from '../src/engine/cards.js';

test('deck has 52 unique cards', () => {
  const deck = createDeck();
  assert.equal(deck.length, 52);
  const keys = new Set(deck.map((c) => `${c.rank}${c.suit}`));
  assert.equal(keys.size, 52);
  assert.ok(deck.some((c) => c.rank === 14 && c.suit === 's'));
});

test('shuffle preserves the multiset of cards', () => {
  const deck = createDeck();
  const shuffled = shuffle(deck, mulberry32(42));
  assert.equal(shuffled.length, 52);
  const sortKey = (a, b) => `${a.rank}${a.suit}`.localeCompare(`${b.rank}${b.suit}`);
  assert.deepEqual(shuffled.slice().sort(sortKey), deck.slice().sort(sortKey));
});

test('seeded rng is deterministic', () => {
  const a = shuffle(createDeck(), mulberry32(7));
  const b = shuffle(createDeck(), mulberry32(7));
  assert.deepEqual(a, b);
});

test('cardLabel renders rank and suit', () => {
  assert.equal(cardLabel({ rank: 14, suit: 's' }), 'A♠');
  assert.equal(cardLabel({ rank: 10, suit: 'h' }), '10♥');
});
