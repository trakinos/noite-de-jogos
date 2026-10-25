import { nextInt } from '../../engine/rng';
import type { ApplyResult } from '../module';
import { BOARD, JAIL_POS, PASS_START, RUAS } from './board';
import type { BairroIntent, BairroState } from './types';

const ok = (): ApplyResult => ({ ok: true });
const fail = (reason: string): ApplyResult => ({ ok: false, reason });

type IntentType = BairroIntent['type'];
type Handler = (s: BairroState, player: number, intent: BairroIntent) => ApplyResult;

/** Every intent type the union knows, so unknown ones are `badIntent` and not-yet-handled ones `notNow`. */
const INTENT_TYPES: ReadonlySet<string> = new Set<IntentType>([
  'roll', 'buy', 'decline', 'endTurn', 'payJailFine', 'useLawyer', 'build', 'sellBuilding',
  'mortgage', 'unmortgage', 'payDebt', 'goBankrupt', 'proposeTrade', 'cancelTrade', 'answerTrade',
]);

const HANDLERS: Partial<Record<IntentType, Handler>> = {
  roll: s => roll(s),
  buy: s => buy(s),
  decline: s => decline(s),
  endTurn: s => endTurn(s),
};

/** Applies one intent from `player` (a seat index), mutating `s`. Never throws on malformed input. */
export function apply(s: BairroState, player: number, intent: BairroIntent): ApplyResult {
  if (s.winner !== null) return fail('gameOver');
  const type: unknown = intent && typeof intent === 'object' ? (intent as { type?: unknown }).type : undefined;
  if (typeof type !== 'string' || !INTENT_TYPES.has(type)) return fail('badIntent');
  if (player !== s.current) return fail('notYourTurn');
  const handler = HANDLERS[type as IntentType];
  return handler ? handler(s, player, intent) : fail('notNow');
}

// ---- helpers shared by the rules ----

export function log(s: BairroState, player: number | null, key: string, params?: Record<string, string | number>): void {
  s.log.push(params ? { player, key, params } : { player, key });
}

function rollDice(s: BairroState): [number, number] {
  const rigged = s.riggedDice?.shift();
  if (rigged) return rigged;
  return [nextInt(s.rng, 6) + 1, nextInt(s.rng, 6) + 1];
}

export function credit(s: BairroState, player: number, amount: number): void {
  s.players[player].cash += amount;
}

/** `debtor` pays `amount` to `creditor` (null = bank) now if they can, else it becomes a Debt. Returns whether it was paid. */
export function charge(s: BairroState, debtor: number, creditor: number | null, amount: number): boolean {
  const p = s.players[debtor];
  if (p.cash < amount) {
    s.debts.push({ debtor, creditor, amount });
    if (creditor === null) log(s, debtor, 'owesBank', { amount });
    else log(s, debtor, 'owesPlayer', { to: creditor, amount });
    return false;
  }
  p.cash -= amount;
  if (creditor !== null) credit(s, creditor, amount);
  return true;
}

/** Moves forward by `steps`, paying PASS_START when passing or landing on 0. */
export function moveBy(s: BairroState, player: number, steps: number): void {
  const p = s.players[player];
  const to = (p.pos + steps) % BOARD.length;
  if (to < p.pos || (to === 0 && steps > 0)) {
    credit(s, player, PASS_START);
    log(s, player, 'passStart', { amount: PASS_START });
  }
  p.pos = to;
}

export function sendToJail(s: BairroState, player: number): void {
  const p = s.players[player];
  p.pos = JAIL_POS;
  p.jailTurns = 0;
  s.phase = { kind: 'manage', rollAgain: false };
  log(s, player, 'wentToJail');
}

/** Rent owed on landing at `pos` with dice total `diceSum`, ignoring who lands there. */
export function rentFor(s: BairroState, pos: number, diceSum: number): number {
  const sq = BOARD[pos];
  const own = s.owned[pos];
  if (!own || own.mortgaged || s.players[own.owner].bankrupt) return 0;
  if (sq.kind === 'servico') {
    const all = BOARD.every((x, i) => x.kind !== 'servico' || s.owned[i]?.owner === own.owner);
    return diceSum * sq.multiplier * (all ? 2 : 1);
  }
  if (sq.kind !== 'ponto') return 0;
  if (own.houses > 0) return sq.rent[own.houses];
  const rua = RUAS[sq.rua].map(id => BOARD.findIndex(x => x.id === id));
  const monopoly = rua.every(i => s.owned[i]?.owner === own.owner && s.owned[i].houses === 0);
  return sq.rent[0] * (monopoly ? 2 : 1);
}

/** Resolves the square the current player just reached. May set the phase (buy, jail). */
function land(s: BairroState, player: number, diceSum: number): void {
  const pos = s.players[player].pos;
  const sq = BOARD[pos];
  switch (sq.kind) {
    case 'ponto':
    case 'servico': {
      const own = s.owned[pos];
      if (!own) { s.phase = { kind: 'buy', square: pos }; return; }
      if (own.owner === player) return;
      const amount = rentFor(s, pos, diceSum);
      if (amount > 0 && charge(s, player, own.owner, amount)) log(s, player, 'paidRent', { to: own.owner, pos, amount });
      return;
    }
    case 'iptu':
      if (charge(s, player, null, sq.amount)) log(s, player, 'paidTax', { pos, amount: sq.amount });
      return;
    case 'bolao':
      credit(s, player, sq.amount);
      log(s, player, 'wonBolao', { amount: sq.amount });
      return;
    case 'goToJail':
      sendToJail(s, player);
      return;
    case 'luck':
      // Task 7 draws and resolves the card.
      log(s, player, 'luckDrawn');
      return;
    case 'start':
    case 'jail':
    case 'pracinha':
      return;
  }
}

// ---- intents ----

function roll(s: BairroState): ApplyResult {
  const ph = s.phase;
  if (!(ph.kind === 'roll' || (ph.kind === 'manage' && ph.rollAgain))) return fail('notNow');
  const player = s.current;
  const dice = rollDice(s);
  const doubles = dice[0] === dice[1];
  s.lastRoll = dice;
  log(s, player, 'rolled', { d1: dice[0], d2: dice[1] });
  // Set before landing so squares that change the phase (buy, jail) override it.
  s.phase = { kind: 'manage', rollAgain: false };
  if (doubles && ++s.doublesInRow === 3) {
    log(s, player, 'thirdDouble');
    sendToJail(s, player);
    return ok();
  }
  moveBy(s, player, dice[0] + dice[1]);
  land(s, player, dice[0] + dice[1]);
  if (s.phase.kind === 'manage') s.phase.rollAgain = doubles && s.players[player].jailTurns === null;
  return ok();
}

/** After a buy decision, keep the roll-again that the dice earned. */
function afterBuyDecision(s: BairroState): void {
  const doubles = s.lastRoll !== null && s.lastRoll[0] === s.lastRoll[1];
  s.phase = { kind: 'manage', rollAgain: doubles && s.players[s.current].jailTurns === null };
}

function buy(s: BairroState): ApplyResult {
  if (s.phase.kind !== 'buy') return fail('notNow');
  const pos = s.phase.square;
  const sq = BOARD[pos];
  if ((sq.kind !== 'ponto' && sq.kind !== 'servico') || s.owned[pos]) return fail('notNow');
  const p = s.players[s.current];
  if (p.cash < sq.price) return fail('notEnoughCash');
  p.cash -= sq.price;
  s.owned[pos] = { owner: s.current, houses: 0, mortgaged: false };
  log(s, s.current, 'bought', { pos, price: sq.price });
  afterBuyDecision(s);
  return ok();
}

function decline(s: BairroState): ApplyResult {
  if (s.phase.kind !== 'buy') return fail('notNow');
  log(s, s.current, 'declined', { pos: s.phase.square });
  afterBuyDecision(s);
  return ok();
}

function endTurn(s: BairroState): ApplyResult {
  if (s.phase.kind !== 'manage' || s.phase.rollAgain) return fail('notNow');
  if (s.debts.length > 0) return fail('debtOpen');
  const n = s.players.length;
  let next = s.current;
  for (let k = 1; k <= n; k++) {
    next = (s.current + k) % n;
    if (!s.players[next].bankrupt) break;
  }
  s.current = next;
  s.phase = { kind: 'roll' };
  s.doublesInRow = 0;
  s.turnNumber++;
  return ok();
}
