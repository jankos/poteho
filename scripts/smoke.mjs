import { Window } from 'happy-dom';

const window = new Window({ url: 'http://localhost/' });
for (const key of Object.getOwnPropertyNames(window)) {
  if (!(key in globalThis)) {
    try { globalThis[key] = window[key]; } catch { /* read-only */ }
  }
}
globalThis.window = window;
globalThis.document = window.document;
globalThis.localStorage = window.localStorage;
for (const key of ['navigator', 'location', 'customElements', 'HTMLElement', 'CustomEvent', 'MutationObserver', 'ShadowRoot', 'Node', 'Element', 'DocumentFragment', 'CSSStyleSheet', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']) {
  if (window[key] !== undefined && !(key in globalThis)) {
    try { Object.defineProperty(globalThis, key, { value: window[key], configurable: true }); } catch { /* skip */ }
  }
}

await import('../src/main.js');

let failures = 0;
const check = (name, cond) => {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}`);
  if (!cond) failures += 1;
};

await customElements.whenDefined('poteho-app');
const app = document.createElement('poteho-app');
document.body.appendChild(app);
await app.updateComplete;
await new Promise((r) => setTimeout(r, 50));

const pierce = (root, sel) => {
  const direct = root.querySelector(sel);
  if (direct) return direct;
  for (const el of root.querySelectorAll('*')) {
    if (el.shadowRoot) {
      const found = pierce(el.shadowRoot, sel);
      if (found) return found;
    }
  }
  return null;
};
const pierceAll = (root, sel, acc = []) => {
  for (const el of root.querySelectorAll(sel)) acc.push(el);
  for (const el of root.querySelectorAll('*')) {
    if (el.shadowRoot) pierceAll(el.shadowRoot, sel, acc);
  }
  return acc;
};

check('app renders header brand', app.shadowRoot.innerHTML.includes('poteho'));
check('new game dialog opens on first run', pierce(app.shadowRoot, 'new-game-dialog .dialog') !== null);

const dialog = app.shadowRoot.querySelector('new-game-dialog');
dialog.dispatchEvent(new window.CustomEvent('start', { detail: { bots: 4, stack: 1000, smallBlind: 5, bigBlind: 10 }, bubbles: true, composed: true }));
await app.updateComplete;
await new Promise((r) => setTimeout(r, 50));

check('game created', app.game !== null);
check('hand started', app.game.phase === 'preflop');
check('5 seats rendered', pierceAll(app.shadowRoot, 'player-seat').length === 5);
const heroSeat = pierceAll(app.shadowRoot, 'player-seat').find((el) => el.isHero === true);
check('hero seat found', Boolean(heroSeat));
check('hero has 2 cards rendered', heroSeat ? heroSeat.shadowRoot.querySelectorAll('card-el').length === 2 : false);
check('coach panel renders', app.shadowRoot.querySelector('hint-panel') !== null);

async function playHand() {
  let guard = 0;
  while (app.game.phase !== 'complete' && guard < 400) {
    const cur = app.game.currentPlayer();
    if (!cur) break;
    if (cur.isBot) {
      app.game.step();
    } else {
      const legal = app.game.legalActionsFor(cur.id);
      app.onAct({ detail: { action: legal.canCheck ? 'check' : 'call' } });
    }
    guard += 1;
    await app.updateComplete;
  }
  return app.game.phase === 'complete';
}

check('hand 1 completes', await playHand());
await app.updateComplete;
check('banner shown after hand', app.shadowRoot.querySelector('.banner') !== null);
check('history has 1 entry', app.history.length === 1);
check('saved to localStorage', Boolean(window.localStorage.getItem('poteho-save-v1')));

app.startHand();
await app.updateComplete;
check('hand 2 starts', app.game.phase !== 'complete' && app.game.handNumber === 2);
check('hand 2 completes', await playHand());
await app.updateComplete;
check('history has 2 entries', app.history.length === 2);
check('chips conserved', app.game.players.reduce((s, p) => s + p.stack, 0) === 5000);

app.showLog = true;
await app.updateComplete;
const log = app.shadowRoot.querySelector('hand-log');
check('history drawer lists hands', log.shadowRoot.querySelectorAll('li').length === 2);

const legal = app.heroLegal();
check('action bar state consistent', app.game.phase === 'complete' ? legal === null : legal !== null);

console.log(failures === 0 ? 'DOM SMOKE OK' : `DOM SMOKE FAILED (${failures})`);
process.exit(failures === 0 ? 0 : 1);
