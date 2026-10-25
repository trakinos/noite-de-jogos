import { nextInt } from '../../engine/rng';
import type { ApplyResult } from '../module';
import { canBuild, canMortgage, canSell, canUnmortgage, liquidationValue, ruaPositions } from './assets';
import { DECK } from './deck';
import { BOARD, JAIL_FINE, JAIL_POS, PASS_START, RUAS, unmortgageCost } from './board';
import type { PontoSquare, RuaId, ServicoSquare } from './board';
import { charge, credit, lawyerCardId, log, mortgageOne, passTurn, sellOne } from './ops';
import { answerTrade, cancelTrade, proposeTrade } from './trades';
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
  payDebt: (s, player) => payDebt(s, player),
  goBankrupt: (s, player) => goBankrupt(s, player),
  proposeTrade: (s, player, i) => proposeTrade(s, player, i),
  cancelTrade: (s, player) => cancelTrade(s, player),
  answerTrade: (s, player, i) => answerTrade(s, player, i),
};

/** While any debt is open, these are the only intents accepted, and only from a debtor, on or off turn. */
const DEBT_INTENTS: ReadonlySet<IntentType> = new Set<IntentType>(['sellBuilding', 'mortgage', 'payDebt', 'goBankrupt']);

/** Applies one intent from `player` (a seat index), mutating `s`. Never throws on malformed input. */
export function apply(s: BairroState, player: number, intent: BairroIntent): ApplyResult {
  if (s.winner !== null) return fail('gameOver');
  const type: unknown = intent && typeof intent === 'object' ? (intent as { type?: unknown }).type : undefined;
  if (typeof type !== 'string' || !INTENT_TYPES.has(type)) return fail('badIntent');
  if (s.players[player]?.bankrupt) return fail('bankrupt');
  if (s.offer !== null) {
    // Exception to the own-turn gate: while an offer is open, the recipient answers and the proposer cancels, nothing else.
    const allowed = (type === 'answerTrade' && player === s.offer.to) || (type === 'cancelTrade' && player === s.offer.from);
    if (!allowed) return fail('tradePending');
  } else if (s.debts.length > 0) {
    if (!DEBT_INTENTS.has(type as IntentType) || !s.debts.some(d => d.debtor === player)) return fail('waitingForDebts');
  } else if (player !== s.current) return fail('notYourTurn');
  const handler = HANDLERS[type as IntentType];
  return handler ? handler(s, player, intent) : fail('notNow');
}

// ---- helpers shared by the rules ----

function rollDice(s: BairroState): [number, number] {
  const rigged = s.riggedDice?.shift();
  if (rigged) return rigged;
  return [nextInt(s.rng, 6) + 1, nextInt(s.rng, 6) + 1];
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
  sellOne(s, player, pos);
  return ok();
}

function mortgage(s: BairroState, player: number, pos: number): ApplyResult {
  const why = canMortgage(s, player, pos);
  if (why) return fail(why);
  mortgageOne(s, player, pos);
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
  passTurn(s);
  return ok();
}

// ---- debts and bankruptcy ----

const debtsOf = (s: BairroState, player: number) => s.debts.filter(d => d.debtor === player);

/** Pays the player's oldest open debt in full. */
function payDebt(s: BairroState, player: number): ApplyResult {
  const debt = s.debts.find(d => d.debtor === player);
  if (!debt) return fail('notNow');
  const p = s.players[player];
  if (p.cash < debt.amount) return fail('notEnoughCash');
  p.cash -= debt.amount;
  s.debts.splice(s.debts.indexOf(debt), 1);
  if (debt.creditor === null) log(s, player, 'paidDebtBank', { amount: debt.amount });
  else {
    credit(s, debt.creditor, debt.amount);
    log(s, player, 'paidDebtPlayer', { to: debt.creditor, amount: debt.amount });
  }
  return ok();
}

/**
 * Settles all of the player's debts by bankruptcy, allowed only when liquidating everything can't cover them.
 * Goes to the bank when every debt is to the bank, else to the creditor of the oldest debt to a player;
 * the other creditors get nothing.
 */
function goBankrupt(s: BairroState, player: number): ApplyResult {
  const mine = debtsOf(s, player);
  if (mine.length === 0) return fail('notNow');
  if (liquidationValue(s, player) >= mine.reduce((sum, d) => sum + d.amount, 0)) return fail('canStillPay');
  const creditor = mine.find(d => d.creditor !== null)?.creditor ?? null;
  const p = s.players[player];
  const assets = Object.keys(s.owned).map(Number).filter(i => s.owned[i].owner === player);
  if (creditor === null) {
    for (const i of assets) delete s.owned[i];
    for (; p.lawyerCards > 0; p.lawyerCards--) s.deck.push(lawyerCardId(s));
    log(s, player, 'bankruptToBank');
  } else {
    let proceeds = 0;
    for (const i of assets) {
      const own = s.owned[i];
      if (own.houses > 0) proceeds += (own.houses * (BOARD[i] as PontoSquare).houseCost) / 2;
      own.houses = 0;
      own.owner = creditor;
    }
    credit(s, creditor, p.cash + proceeds);
    s.players[creditor].lawyerCards += p.lawyerCards;
    p.lawyerCards = 0;
    log(s, player, 'bankruptToPlayer', { to: creditor });
  }
  p.cash = 0;
  p.bankrupt = true;
  // A bankrupt player neither pays nor collects.
  s.debts = s.debts.filter(d => d.debtor !== player && d.creditor !== player);
  const solvent = s.players.flatMap((x, i) => (x.bankrupt ? [] : [i]));
  if (solvent.length === 1) {
    s.winner = solvent[0];
    log(s, s.winner, 'won');
  } else if (player === s.current) passTurn(s);
  return ok();
}

/**
 * Raises the player's cash up to `target`, stopping as soon as it is reached. Sells buildings first,
 * most expensive rua first and always from a rua's highest building (even selling), then mortgages
 * the cheapest unmortgaged assets first. Also used by the timeout.
 */
export function liquidate(s: BairroState, player: number, target: number): void {
  const p = s.players[player];
  for (const rua of (Object.keys(RUAS) as RuaId[]).reverse()) {
    // Most expensive ponto first among those tied at the top.
    const mine = ruaPositions(rua).reverse().filter(i => s.owned[i]?.owner === player);
    while (p.cash < target) {
      const top = Math.max(0, ...mine.map(i => s.owned[i].houses));
      if (top === 0) break;
      sellOne(s, player, mine.find(i => s.owned[i].houses === top)!);
    }
  }
  const unmortgaged = Object.keys(s.owned).map(Number)
    .filter(i => s.owned[i].owner === player && !s.owned[i].mortgaged)
    .sort((a, b) => (BOARD[a] as PontoSquare | ServicoSquare).mortgage - (BOARD[b] as PontoSquare | ServicoSquare).mortgage || a - b);
  for (const i of unmortgaged) {
    if (p.cash >= target) return;
    mortgageOne(s, player, i);
  }
}
