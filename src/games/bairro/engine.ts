import { nextInt } from '../../engine/rng';
import type { ApplyResult } from '../module';
import { canBuild, canMortgage, canSell, canUnmortgage, liquidationValue, ruaPositions } from './assets';
import { DECK, HAND_MAX, pocketKind } from './deck';
import { BOARD, JAIL_FINE, JAIL_POS, PASS_START, RUAS, unmortgageCost } from './board';
import type { PontoSquare, RuaId, ServicoSquare } from './board';
import { charge, credit, lawyerCardId, log, mortgageOne, passTurn, sellOne } from './ops';
import { answerTrade, cancelTrade, counterTrade, proposeTrade } from './trades';
import { auctionDeclined, bidders, placeBid, startAuction } from './auction';
import { BICHEIRO_BONUS, BICHO_SQUARES, PRACINHA_BONUS, buildCost, buyPrice, hasSkill } from './skills';
import type { BairroIntent, BairroState } from './types';

const ok = (): ApplyResult => ({ ok: true });
const fail = (reason: string): ApplyResult => ({ ok: false, reason });

type IntentType = BairroIntent['type'];
type Handler = (s: BairroState, player: number, intent: BairroIntent) => ApplyResult;

/** Every intent type the union knows, so unknown ones are `badIntent` and not-yet-handled ones `notNow`. */
const INTENT_TYPES: ReadonlySet<string> = new Set<IntentType>([
  'roll', 'buy', 'decline', 'endTurn', 'payJailFine', 'useLawyer', 'build', 'sellBuilding',
  'mortgage', 'unmortgage', 'payDebt', 'goBankrupt', 'proposeTrade', 'cancelTrade', 'answerTrade',
  'counterTrade', 'bid', 'payRent', 'useSkill', 'playCard',
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
  counterTrade: (s, player, i) => counterTrade(s, player, i),
  bid: (s, player, i) => placeBid(s, player, i),
  payRent: s => payRent(s),
  useSkill: s => useSkill(s),
  playCard: (s, player, i) => playCard(s, player, i as Extract<BairroIntent, { type: 'playCard' }>),
};

/** While any debt is open, these are the only intents accepted, and only from a debtor, on or off turn. */
const DEBT_INTENTS: ReadonlySet<IntentType> = new Set<IntentType>(['sellBuilding', 'mortgage', 'payDebt', 'goBankrupt']);

/** Applies one intent from `player` (a seat index), mutating `s`. Never throws on malformed input. */
export function apply(s: BairroState, player: number, intent: BairroIntent): ApplyResult {
  if (s.winner !== null) return fail('gameOver');
  const type: unknown = intent && typeof intent === 'object' ? (intent as { type?: unknown }).type : undefined;
  if (typeof type !== 'string' || !INTENT_TYPES.has(type)) return fail('badIntent');
  if (s.players[player]?.bankrupt) return fail('bankrupt');
  if (s.auction !== null) {
    // The Prefeitura's auction comes first: only bids, from those still to bid.
    if (type !== 'bid' || !bidders(s).includes(player)) return fail('auctionOpen');
  } else if (s.offer !== null) {
    // Exception to the own-turn gate: while an offer is open, the recipient answers or counters and the proposer cancels, nothing else.
    const answering = (type === 'answerTrade' || type === 'counterTrade') && player === s.offer.to;
    const allowed = answering || (type === 'cancelTrade' && player === s.offer.from);
    if (!allowed) return fail('tradePending');
  } else if (s.debts.length > 0) {
    if (!DEBT_INTENTS.has(type as IntentType) || !s.debts.some(d => d.debtor === player)) return fail('waitingForDebts');
  } else if (player !== s.current) return fail('notYourTurn');
  const handler = HANDLERS[type as IntentType];
  return handler ? handler(s, player, intent) : fail('notNow');
}

// ---- helpers shared by the rules ----

/** The dice; a Dado Viciado sets the first one. */
function rollDice(s: BairroState, fixed?: number): [number, number] {
  const rigged = s.riggedDice?.shift();
  if (rigged) return fixed === undefined ? rigged : [fixed, rigged[1]];
  return [fixed ?? nextInt(s.rng, 6) + 1, nextInt(s.rng, 6) + 1];
}

const PRACINHA_POS = BOARD.findIndex(sq => sq.kind === 'pracinha');
/** Serviço rent on a move without dice (Marcha à Ré, Carona): as if they rolled 7. */
const NO_DICE_SUM = 7;

/** Moves forward by `steps`, paying PASS_START when passing or landing on 0 (and the Rei da Pracinha at the Pracinha). */
export function moveBy(s: BairroState, player: number, steps: number): void {
  const p = s.players[player];
  const to = (p.pos + steps) % BOARD.length;
  if (steps > 0 && hasSkill(s, player, 'reiDaPracinha') && (PRACINHA_POS - p.pos + BOARD.length) % BOARD.length <= steps && p.pos !== PRACINHA_POS) {
    credit(s, player, PRACINHA_BONUS);
    log(s, player, 'skillPracinha', { pos: PRACINHA_POS, amount: PRACINHA_BONUS });
  }
  if (to < p.pos || (to === 0 && steps > 0)) {
    credit(s, player, PASS_START);
    log(s, player, 'passStart', { amount: PASS_START });
    // The Malandro's extra roll comes back every lap.
    p.skillUsed = false;
  }
  p.pos = to;
}

/** Bicheiro: someone stopped at the Pé de Meia, the IPTU or the Bolão. */
function bicho(s: BairroState, player: number, pos: number): void {
  if (!BICHO_SQUARES.has(BOARD[pos].id)) return;
  const bicheiro = s.players.findIndex(p => p.skill === 'bicheiro' && !p.bankrupt);
  if (bicheiro < 0) return;
  credit(s, bicheiro, BICHEIRO_BONUS);
  log(s, bicheiro, 'skillBicheiro', { who: player, pos, amount: BICHEIRO_BONUS });
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

/** Takes the top card and applies it. Used cards go to the bottom; a lawyer card and the cards to keep stay with the drawer. */
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
  if (effect.kind === 'pocket' && p.hand.length < HAND_MAX) {
    p.hand.push(id);
    return;
  }
  s.deck.push(id);
  switch (effect.kind) {
    case 'pocket':
      log(s, player, 'handFull', { max: HAND_MAX });
      return;
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
      bicho(s, player, 0);
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
      const amount = rentFor(s, pos, diceSum);
      if (own.owner === player) {
        // Dono da Casa: the Prefeitura pays half the rent you would charge.
        const half = Math.floor(amount / 2);
        if (half > 0 && hasSkill(s, player, 'donoDaCasa')) {
          credit(s, player, half);
          log(s, player, 'skillHome', { pos, amount: half });
        }
        return;
      }
      if (amount <= 0) return;
      // Holding a Calote, you choose: pay or skip it.
      if (handOf(s, player, 'calote')) { s.phase = { kind: 'rent', square: pos, amount, rollAgain }; return; }
      if (charge(s, player, own.owner, amount)) log(s, player, 'paidRent', { to: own.owner, pos, amount });
      return;
    }
    case 'iptu':
      if (charge(s, player, null, sq.amount)) log(s, player, 'paidTax', { pos, amount: sq.amount });
      bicho(s, player, pos);
      return;
    case 'bolao':
      credit(s, player, sq.amount);
      log(s, player, 'wonBolao', { amount: sq.amount });
      bicho(s, player, pos);
      return;
    case 'goToJail':
      sendToJail(s, player);
      return;
    case 'luck':
      drawLuck(s, player);
      return;
    case 'start':
      bicho(s, player, pos);
      return;
    case 'jail':
    case 'pracinha':
      return;
  }
}

// ---- intents ----

/** Whether the current player may roll now: before moving, or again after doubles. */
const mayRoll = (s: BairroState) => s.phase.kind === 'roll' || (s.phase.kind === 'manage' && s.phase.rollAgain);

function roll(s: BairroState, fixed?: number): ApplyResult {
  if (!mayRoll(s)) return fail('notNow');
  const player = s.current;
  const p = s.players[player];
  const wasJailed = p.jailTurns !== null;
  const dice = rollDice(s, fixed);
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
  if (p.fiscal) return fail('fiscalBlocked');
  const price = buyPrice(s, s.current, pos);
  if (p.cash < price) return fail('notEnoughCash');
  p.cash -= price;
  s.owned[pos] = { owner: s.current, houses: 0, mortgaged: false };
  log(s, s.current, 'bought', { pos, price });
  afterBuyDecision(s);
  return ok();
}

function decline(s: BairroState): ApplyResult {
  if (s.phase.kind !== 'buy') return fail('notNow');
  const pos = s.phase.square;
  log(s, s.current, 'declined', { pos });
  afterBuyDecision(s);
  if (s.auctionDeclined) auctionDeclined(s, s.current, pos);
  return ok();
}

function build(s: BairroState, player: number, pos: number): ApplyResult {
  const why = canBuild(s, player, pos);
  if (why) return fail(why);
  const cost = buildCost(s, player, pos);
  s.players[player].cash -= cost;
  const own = s.owned[pos];
  own.houses++;
  log(s, player, own.houses === 5 ? 'builtPredio' : 'builtPuxadinho', { pos, cost });
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

// ---- rent choice, skills and cards to keep ----

/** The first card of `kind` in the player's hand, if any. */
function handOf(s: BairroState, player: number, kind: string): string | undefined {
  return s.players[player].hand.find(id => pocketKind(id) === kind);
}

function payRent(s: BairroState): ApplyResult {
  const ph = s.phase;
  if (ph.kind !== 'rent') return fail('notNow');
  const owner = s.owned[ph.square].owner;
  s.phase = { kind: 'manage', rollAgain: ph.rollAgain };
  if (charge(s, s.current, owner, ph.amount)) log(s, s.current, 'paidRent', { to: owner, pos: ph.square, amount: ph.amount });
  return ok();
}

/** Malandro: once per lap, after moving, roll again. */
function useSkill(s: BairroState): ApplyResult {
  const p = s.players[s.current];
  if (p.skill !== 'malandro') return fail('noSkillToUse');
  if (p.skillUsed) return fail('skillUsed');
  if (s.phase.kind !== 'manage' || s.phase.rollAgain || p.jailTurns !== null) return fail('notNow');
  p.skillUsed = true;
  log(s, s.current, 'skillMalandro');
  // A fresh roll: it doesn't count toward three doubles in a row.
  s.doublesInRow = 0;
  s.phase = { kind: 'manage', rollAgain: true };
  return roll(s);
}

/** Squares a Carona can reach from `pos`: its side of the board up to the next corner, but not `pos` itself. */
export function caronaTargets(pos: number): number[] {
  const side = Math.floor(pos / 10) * 10;
  return Array.from({ length: 11 }, (_, k) => (side + k) % BOARD.length).filter(i => i !== pos);
}

const isInt = (x: unknown, min: number, max: number): x is number => Number.isInteger(x) && (x as number) >= min && (x as number) <= max;

/** Plays a kept card from the current player's hand. The card goes back under the deck. */
function playCard(s: BairroState, player: number, intent: Extract<BairroIntent, { type: 'playCard' }>): ApplyResult {
  const p = s.players[player];
  const id = intent.card;
  if (typeof id !== 'string' || !p.hand.includes(id)) return fail('notInHand');
  const kind = pocketKind(id)!;
  const moving = kind === 'dadoViciado' || kind === 'marchaRe' || kind === 'carona';
  if (moving && !mayRoll(s)) return fail('notNow');
  if ((kind === 'marchaRe' || kind === 'carona') && p.jailTurns !== null) return fail('notNow');
  if (kind === 'calote' && s.phase.kind !== 'rent') return fail('notNow');
  if (kind === 'fiscal' && s.phase.kind !== 'roll' && s.phase.kind !== 'manage') return fail('notNow');
  if (kind === 'seguro') return fail('playsItself');
  const choice = { dadoViciado: intent.die, marchaRe: intent.steps, carona: intent.pos, fiscal: intent.target, calote: 0 }[kind];
  const valid = {
    dadoViciado: isInt(choice, 1, 6),
    marchaRe: isInt(choice, 1, 3),
    carona: isInt(choice, 0, BOARD.length - 1) && caronaTargets(p.pos).includes(choice),
    fiscal: isInt(choice, 0, s.players.length - 1) && choice !== player && !s.players[choice].bankrupt,
    calote: true,
  }[kind];
  if (!valid) return fail('badCardChoice');
  p.hand.splice(p.hand.indexOf(id), 1);
  s.deck.push(id);
  switch (kind) {
    case 'dadoViciado':
      log(s, player, 'cardDado', { name: kind, die: choice as number });
      return roll(s, choice as number);
    case 'marchaRe':
    case 'carona': {
      const to = choice as number;
      if (kind === 'marchaRe') {
        p.pos = (p.pos - to + BOARD.length) % BOARD.length;
        log(s, player, 'cardMarchaRe', { name: kind, steps: to });
      } else {
        log(s, player, 'cardCarona', { name: kind, pos: to });
        // Forward (up to the corner, which may be the Pé de Meia) pays on the way; back just goes there.
        const ahead = (to - p.pos + BOARD.length) % BOARD.length;
        if (ahead <= 10) moveBy(s, player, ahead);
        else p.pos = to;
      }
      // Instead of the roll: no extra roll after it.
      s.phase = { kind: 'manage', rollAgain: false };
      land(s, player, NO_DICE_SUM, false);
      return ok();
    }
    case 'calote': {
      const ph = s.phase as Extract<BairroState['phase'], { kind: 'rent' }>;
      log(s, player, 'cardCalote', { name: kind, to: s.owned[ph.square].owner, pos: ph.square, amount: ph.amount });
      s.phase = { kind: 'manage', rollAgain: ph.rollAgain };
      return ok();
    }
    case 'fiscal': {
      const target = choice as number;
      const seguro = handOf(s, target, 'seguro');
      if (seguro) {
        const t = s.players[target];
        t.hand.splice(t.hand.indexOf(seguro), 1);
        s.deck.push(seguro);
        log(s, player, 'cardSeguro', { name: kind, to: target, guard: 'seguro' });
      } else {
        s.players[target].fiscal = true;
        log(s, player, 'cardFiscal', { name: kind, to: target });
      }
      return ok();
    }
  }
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
  // Kept cards go back under the deck either way.
  s.deck.push(...p.hand);
  p.hand = [];
  p.fiscal = false;
  if (creditor === null) {
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
  s.bankruptOrder.push(player);
  // A bankrupt player neither pays nor collects.
  s.debts = s.debts.filter(d => d.debtor !== player && d.creditor !== player);
  const solvent = s.players.flatMap((x, i) => (x.bankrupt ? [] : [i]));
  if (solvent.length === 1) {
    for (const i of assets) if (creditor === null) delete s.owned[i];
    s.winner = solvent[0];
    log(s, s.winner, 'won');
    return ok();
  }
  if (player === s.current) passTurn(s);
  // Owed to the Prefeitura: it auctions the escrituras to everyone left, clean of buildings and mortgages.
  if (creditor === null) startAuction(s, player, assets);
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
