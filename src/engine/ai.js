import { monteCarloEquity, potOdds } from './equity.js';

function chenValue(hole) {
  const [a, b] = hole.slice().sort((x, y) => y.rank - x.rank);
  const high = a.rank;
  const low = b.rank;
  const suited = a.suit === b.suit;
  let score = high === 14 ? 10 : high / 2;
  if (high === low) {
    score = Math.max(score, 5);
    score *= 2;
    if (high < 12) score -= 1;
  } else {
    if (suited) score += 2;
    const gap = high - low;
    if (gap === 1) score += 0;
    else if (gap === 2) score -= 1;
    else if (gap === 3) score -= 2;
    else if (gap === 4) score -= 4;
    else score -= 5;
    if (gap <= 2 && high < 12 && !(high === 11 && low >= 6)) score += 1;
  }
  return Math.max(0, score);
}

export function preflopStrength(hole) {
  const chen = chenValue(hole);
  if (chen >= 10) return { label: 'Premium', value: 1 };
  if (chen >= 8) return { label: 'Strong', value: 0.85 };
  if (chen >= 6) return { label: 'Playable', value: 0.65 };
  if (chen >= 4) return { label: 'Marginal', value: 0.45 };
  return { label: 'Trash', value: 0.2 };
}

function activeOpponents(game, playerId) {
  return game.players.filter((p) => !p.folded && p.id !== playerId).length;
}

export function decideAction(game, player, rng = Math.random, iterations = 250) {
  const legal = game.legalActionsFor(player.id);
  const opponents = activeOpponents(game, player.id);
  const toCall = legal.callAmount;
  const potAfterCall = game.pot() + toCall;
  const odds = potOdds(game.pot(), toCall);

  let equity;
  if (game.phase === 'preflop' || game.community.length === 0) {
    equity = preflopStrength(player.hand).value;
  } else {
    equity = monteCarloEquity(player.hand, game.community, Math.max(1, opponents), iterations, rng).equity;
  }

  const aggression = 0.75 + rng() * 0.5;
  const bluff = rng() < 0.06 && toCall === 0;

  if (toCall > 0) {
    const needed = odds.requiredEquity;
    const margin = 0.08 / Math.max(1, opponents);
    if (equity + (bluff ? 0.15 : 0) > needed + margin || equity > 0.75) {
      if (equity > needed + 0.18 && rng() < 0.45 && legal.canRaise) {
        const raiseSize = Math.max(legal.minRaiseTo, Math.min(legal.maxRaiseTo, game.currentBet + Math.max(game.minRaise, Math.round(potAfterCall * (0.5 + rng() * 0.5)))));
        return { action: 'raise', amount: raiseSize };
      }
      return { action: 'call', amount: toCall };
    }
    if (equity > needed - 0.05 && rng() < 0.25) {
      return { action: 'call', amount: toCall };
    }
    return { action: 'fold' };
  }

  if (equity > 0.55 * aggression || bluff) {
    if (legal.canRaise && rng() < 0.6) {
      const size = Math.max(legal.minRaiseTo, Math.min(legal.maxRaiseTo, Math.round((game.pot() + game.currentBet) * (0.5 + rng() * 0.75))));
      return { action: 'raise', amount: size };
    }
    return { action: 'check' };
  }
  return { action: 'check' };
}
