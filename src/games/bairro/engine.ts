import { nextInt } from '../../engine/rng';
import type { ApplyResult } from '../module';
import { canBuild, canMortgage, canSell, canUnmortgage } from './assets';
import { DECK } from './deck';
import { BOARD, JAIL_FINE, JAIL_POS, PASS_START, RUAS, unmortgageCost } from './board';
import type { PontoSquare, ServicoSquare } from './board';
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
  payJailFine: s => payJailFine(s),
  useLawyer: s => useLawyer(s),
  build: (s, player, i) => build(s, player, (i as { pos: number }).pos),
  sellBuilding: (s, player, i) => sellBuilding(s, player, (i as { pos: number }).pos),
  mortgage: (s, player, i) => mortgage(s, player, (i as { pos: number }).pos),
  unmortgage: (s, player, i) => unmortgage(s, player, (i as { pos: number }).pos),
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

/** lawyerCards is a count, so the card id is inferred: c01 unless it is already back in the deck. */
function lawyerCardId(s: BairroState): string {
  return s.deck.includes('c01') ? 'c02' : 'c01';
}

/** Takes the top card and applies it. Used cards go to the bottom; a lawyer card is kept by the drawer. */
function drawLuck(s: BairroState, player: number): void {
  const id = s.deck.shift();
  if (id === undefined) return;
  const effect = DECK.find(c => c.id === id)!.effect;
  log(s, player, 'luck', { card: id });
  const p = s.players[player];
  if (effect.kind === 'lawyer') {
    p.lawyerCards++;
    return;
  }
  s.deck.push(id);
  switch (effect.kind) {
    case 'money':
      if (effect.amount > 0) credit(s, player, effect.amount);
      else charge(s, player, null, -effect.amount);
      return;
    case 'eachPlayer': {
      const n = s.players.length;
      for (let k = 1; k < n; k++) {
        const other = (player + k) % n;
        if (s.players[other].bankrupt) continue;
        if (effect.amount > 0) charge(s, other, player, effect.amount);
        else charge(s, player, other, -effect.amount);
      }
      return;
    }
    case 'advanceToStart':
      moveBy(s, player, BOARD.length - p.pos);
      return;
    case 'goToJail':
      sendToJail(s, player);
      return;
  }
}

/** Resolves the square the current player just reached. May set the phase (buy, jail). */
function land(s: BairroState, player: number, diceSum: number, rollAgain: boolean): void {
  const pos = s.players[player].pos;
  const sq = BOARD[pos];
  switch (sq.kind) {
    case 'ponto':
    case 'servico': {
      const own = s.owned[pos];
      if (!own) { s.phase = { kind: 'buy', square: pos, rollAgain }; return; }
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
      drawLuck(s, player);
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
  const p = s.players[player];
  const wasJailed = p.jailTurns !== null;
  const dice = rollDice(s);
  const doubles = dice[0] === dice[1];
  s.lastRoll = dice;
  log(s, player, 'rolled', { d1: dice[0], d2: dice[1] });
  // Set before landing so squares that change the phase (buy, jail) override it.
  s.phase = { kind: 'manage', rollAgain: false };
  if (wasJailed) {
    if (doubles) {
      p.jailTurns = null;
      log(s, player, 'leftJailDoubles');
    } else if (++p.jailTurns! < 3) {
      log(s, player, 'jailRollFailed', { turns: p.jailTurns! });
      return ok();
    } else {
      p.jailTurns = null;
      if (charge(s, player, null, JAIL_FINE)) log(s, player, 'jailFineForced', { amount: JAIL_FINE });
    }
  } else if (doubles && ++s.doublesInRow === 3) {
    log(s, player, 'thirdDouble');
    sendToJail(s, player);
    return ok();
  }
  // A jail exit never earns an extra roll, even on doubles.
  const again = doubles && !wasJailed;
  moveBy(s, player, dice[0] + dice[1]);
  land(s, player, dice[0] + dice[1], again);
  if (s.phase.kind === 'manage') s.phase.rollAgain = again && p.jailTurns === null;
  return ok();
}

function leaveJail(s: BairroState, key: string, params?: Record<string, string | number>): void {
  s.players[s.current].jailTurns = null;
  log(s, s.current, key, params);
}

function payJailFine(s: BairroState): ApplyResult {
  const p = s.players[s.current];
  if (s.phase.kind !== 'roll' || p.jailTurns === null) return fail('notNow');
  if (p.cash < JAIL_FINE) return fail('notEnoughCash');
  p.cash -= JAIL_FINE;
  leaveJail(s, 'paidJailFine', { amount: JAIL_FINE });
  return ok();
}

function useLawyer(s: BairroState): ApplyResult {
  const p = s.players[s.current];
  if (s.phase.kind !== 'roll' || p.jailTurns === null || p.lawyerCards < 1) return fail('notNow');
  p.lawyerCards--;
  s.deck.push(lawyerCardId(s));
  leaveJail(s, 'usedLawyer');
  return ok();
}

/** After a buy decision, keep the roll-again that the dice earned. */
function afterBuyDecision(s: BairroState): void {
  const rollAgain = s.phase.kind === 'buy' && s.phase.rollAgain;
  s.phase = { kind: 'manage', rollAgain };
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

function build(s: BairroState, player: number, pos: number): ApplyResult {
  const why = canBuild(s, player, pos);
  if (why) return fail(why);
  const sq = BOARD[pos] as PontoSquare;
  s.players[player].cash -= sq.houseCost;
  const own = s.owned[pos];
  own.houses++;
  log(s, player, own.houses === 5 ? 'builtPredio' : 'builtPuxadinho', { pos, cost: sq.houseCost });
  return ok();
}

function sellBuilding(s: BairroState, player: number, pos: number): ApplyResult {
  const why = canSell(s, player, pos);
  if (why) return fail(why);
  const refund = (BOARD[pos] as PontoSquare).houseCost / 2;
  s.owned[pos].houses--;
  credit(s, player, refund);
  log(s, player, 'soldBuilding', { pos, amount: refund });
  return ok();
}

function mortgage(s: BairroState, player: number, pos: number): ApplyResult {
  const why = canMortgage(s, player, pos);
  if (why) return fail(why);
  const sq = BOARD[pos] as PontoSquare | ServicoSquare;
  s.owned[pos].mortgaged = true;
  credit(s, player, sq.mortgage);
  log(s, player, 'mortgaged', { pos, amount: sq.mortgage });
  return ok();
}

function unmortgage(s: BairroState, player: number, pos: number): ApplyResult {
  const why = canUnmortgage(s, player, pos);
  if (why) return fail(why);
  const cost = unmortgageCost(BOARD[pos] as PontoSquare | ServicoSquare);
  s.players[player].cash -= cost;
  s.owned[pos].mortgaged = false;
  log(s, player, 'unmortgaged', { pos, amount: cost });
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
