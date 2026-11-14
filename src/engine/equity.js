import { createDeck, shuffle } from './cards.js';
import { bestHand, compareHands } from './evaluate.js';

export function monteCarloEquity(holeCards, community, opponentCount, iterations = 300, rng = Math.random) {
  if (opponentCount < 1) throw new Error('Need at least one opponent');
  const known = new Set([...holeCards, ...community].map((c) => `${c.rank}${c.suit}`));
  const remaining = createDeck().filter((c) => !known.has(`${c.rank}${c.suit}`));

  const boardNeeded = 5 - community.length;
  let win = 0;
  let tie = 0;

  for (let i = 0; i < iterations; i += 1) {
    const simDeck = shuffle(remaining, rng);
    const board = community.concat(simDeck.splice(0, boardNeeded));
    const hero = bestHand([...holeCards, ...board]);
    let heroBest = true;
    let heroTied = false;
    for (let opp = 0; opp < opponentCount; opp += 1) {
      const oppHole = simDeck.splice(0, 2);
      const oppHand = bestHand([...oppHole, ...board]);
      const cmp = compareHands(hero, oppHand);
      if (cmp < 0) {
        heroBest = false;
        break;
      }
      if (cmp === 0) heroTied = true;
    }
    if (heroBest) {
      if (heroTied) tie += 1;
      else win += 1;
    }
  }

  return {
    win: win / iterations,
    tie: tie / iterations,
    equity: (win + tie * 0.5) / iterations,
  };
}

export function potOdds(pot, callAmount) {
  if (callAmount <= 0) return { ratio: 0, requiredEquity: 0 };
  return {
    ratio: pot / callAmount,
    requiredEquity: callAmount / (pot + callAmount),
  };
}
