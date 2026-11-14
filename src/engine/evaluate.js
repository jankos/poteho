export const HAND_NAMES = [
  'High card',
  'One pair',
  'Two pair',
  'Three of a kind',
  'Straight',
  'Flush',
  'Full house',
  'Four of a kind',
  'Straight flush',
];

export const CATEGORY = {
  HIGH_CARD: 0,
  ONE_PAIR: 1,
  TWO_PAIR: 2,
  THREE_OF_A_KIND: 3,
  STRAIGHT: 4,
  FLUSH: 5,
  FULL_HOUSE: 6,
  FOUR_OF_A_KIND: 7,
  STRAIGHT_FLUSH: 8,
};

function straightHighCard(ranks) {
  const unique = [...new Set(ranks)].sort((a, b) => b - a);
  if (unique.length < 5) return 0;
  for (let i = 0; i <= unique.length - 5; i += 1) {
    if (unique[i] - unique[i + 4] === 4) return unique[i];
  }
  if (
    unique.includes(14) && unique.includes(5) && unique.includes(4)
    && unique.includes(3) && unique.includes(2)
  ) {
    return 5;
  }
  return 0;
}

function packScore(category, ranks) {
  let score = category;
  for (let i = 0; i < 5; i += 1) score = score * 16 + (ranks[i] ?? 0);
  return score;
}

export function evaluate5(cards) {
  const ranks = cards.map((c) => c.rank);
  const suits = cards.map((c) => c.suit);
  const isFlush = suits.every((s) => s === suits[0]);
  const straightHigh = straightHighCard(ranks);

  const counts = new Map();
  for (const r of ranks) counts.set(r, (counts.get(r) || 0) + 1);
  const groups = [...counts.entries()]
    .map(([rank, count]) => ({ rank, count }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);

  if (isFlush && straightHigh > 0) {
    return {
      category: CATEGORY.STRAIGHT_FLUSH,
      ranks: [straightHigh],
      score: packScore(CATEGORY.STRAIGHT_FLUSH, [straightHigh]),
      name: straightHigh === 14 ? 'Royal flush' : 'Straight flush',
    };
  }
  if (groups[0].count === 4) {
    const quad = groups[0].rank;
    const kicker = groups[1].rank;
    return {
      category: CATEGORY.FOUR_OF_A_KIND,
      ranks: [quad, kicker],
      score: packScore(CATEGORY.FOUR_OF_A_KIND, [quad, kicker]),
      name: 'Four of a kind',
    };
  }
  if (groups[0].count === 3 && groups[1].count === 2) {
    const trips = groups[0].rank;
    const pair = groups[1].rank;
    return {
      category: CATEGORY.FULL_HOUSE,
      ranks: [trips, pair],
      score: packScore(CATEGORY.FULL_HOUSE, [trips, pair]),
      name: 'Full house',
    };
  }
  if (isFlush) {
    const sorted = ranks.slice().sort((a, b) => b - a);
    return {
      category: CATEGORY.FLUSH,
      ranks: sorted,
      score: packScore(CATEGORY.FLUSH, sorted),
      name: 'Flush',
    };
  }
  if (straightHigh > 0) {
    return {
      category: CATEGORY.STRAIGHT,
      ranks: [straightHigh],
      score: packScore(CATEGORY.STRAIGHT, [straightHigh]),
      name: 'Straight',
    };
  }
  if (groups[0].count === 3) {
    const trips = groups[0].rank;
    const kickers = groups.slice(1).map((g) => g.rank).sort((a, b) => b - a);
    return {
      category: CATEGORY.THREE_OF_A_KIND,
      ranks: [trips, ...kickers],
      score: packScore(CATEGORY.THREE_OF_A_KIND, [trips, ...kickers]),
      name: 'Three of a kind',
    };
  }
  if (groups[0].count === 2 && groups[1].count === 2) {
    const high = Math.max(groups[0].rank, groups[1].rank);
    const low = Math.min(groups[0].rank, groups[1].rank);
    const kicker = groups[2].rank;
    return {
      category: CATEGORY.TWO_PAIR,
      ranks: [high, low, kicker],
      score: packScore(CATEGORY.TWO_PAIR, [high, low, kicker]),
      name: 'Two pair',
    };
  }
  if (groups[0].count === 2) {
    const pair = groups[0].rank;
    const kickers = groups.slice(1).map((g) => g.rank).sort((a, b) => b - a);
    return {
      category: CATEGORY.ONE_PAIR,
      ranks: [pair, ...kickers],
      score: packScore(CATEGORY.ONE_PAIR, [pair, ...kickers]),
      name: 'One pair',
    };
  }
  const sorted = ranks.slice().sort((a, b) => b - a);
  return {
    category: CATEGORY.HIGH_CARD,
    ranks: sorted,
    score: packScore(CATEGORY.HIGH_CARD, sorted),
    name: 'High card',
  };
}

function* combinations(arr, k, start = 0, prefix = []) {
  if (prefix.length === k) {
    yield prefix;
    return;
  }
  for (let i = start; i <= arr.length - (k - prefix.length); i += 1) {
    yield* combinations(arr, k, i + 1, [...prefix, arr[i]]);
  }
}

export function bestHand(cards) {
  if (cards.length < 5) throw new Error('bestHand needs at least 5 cards');
  let best = null;
  for (const combo of combinations(cards, 5)) {
    const result = evaluate5(combo);
    if (!best || result.score > best.score) best = result;
  }
  return best;
}

export function compareHands(a, b) {
  if (a.score > b.score) return 1;
  if (a.score < b.score) return -1;
  return 0;
}

export function describeHand(cards) {
  const best = bestHand(cards);
  return `${best.name}${best.category === CATEGORY.HIGH_CARD ? ` (${best.ranks[0] === 14 ? 'A' : best.ranks[0]})` : ''}`;
}
