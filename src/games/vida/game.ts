import { createRng, nextInt, shuffle, type RngState } from '../../engine/rng';
import type { ClockInput, ClockKind } from '../../net/turnClock';
import type { ApplyResult, GameInstance, GameModule, SeatInfo } from '../module';
import {
  BIKE_UPKEEP, boardFor, CAREERS, COLLEGE_LOANS, HOUSES, INTEREST_EVERY, INVEST, JOB_KEEP_RAISE, JOY_CASH, KID_BONUS, KID_UPKEEP, LOAN, LOAN_INTEREST, LOAN_PAYBACK, MANSION_TILES,
  MIDLIFE, PAYDAY_INTEREST, RETIRE_EARLY, RETIREMENTS, SPIN_MAX, START_CASH, SUE_AMOUNT, THRIFT_DISCOUNT, TILE_VALUES, TILES_EACH, WEDDING, WEDDING_GIFT,
  type GameLength, type InvestPick, type MidlifePick, type Perk, type Retirement, type WeddingPick,
} from './board';

export type { Retirement };

export interface VidaPlayer {
  id: string;
  name: string;
  /** -1 before choosing a path; college players then walk from 0, career players from CAREER_START. */
  pos: number;
  cash: number;
  loans: number;
  career: string | null;
  salary: number;
  married: boolean;
  kids: number;
  house: string | null;
  /** Bought the midlife motorbike. */
  bike: boolean;
  /** Paydays passed, to know when the bank's interest falls due. */
  paydays: number;
  tiles: number[];
  retired: Retirement | null;
  /** Chose college or a career and is on the board. */
  started: boolean;
}

export type VidaPrompt =
  | { kind: 'path' }
  /** `keep`: the career crossroads, where staying in the current job (for a raise) is also an answer. */
  | { kind: 'career'; options: string[]; keep?: boolean }
  | { kind: 'house'; options: string[] }
  | { kind: 'marry' }
  | { kind: 'sue' }
  | { kind: 'invest' }
  | { kind: 'midlife' }
  | { kind: 'retire' };

export type VidaLog =
  | { k: 'spin'; seat: number; n: number }
  | { k: 'path'; seat: number; college: boolean }
  | { k: 'career'; seat: number; career: string }
  | { k: 'payday'; seat: number; n: number }
  /** Fixed costs paid at a payday: children, the house, the motorbike. */
  | { k: 'upkeep'; seat: number; n: number }
  | { k: 'cash'; seat: number; n: number; t: string }
  | { k: 'raise'; seat: number; n: number; t: string }
  | { k: 'life'; seat: number; t: string }
  | { k: 'baby'; seat: number; n: number }
  | { k: 'tax'; seat: number; n: number }
  | { k: 'sue'; seat: number; target: number; n: number }
  | { k: 'marry'; seat: number; n: number; pick: WeddingPick }
  /** Bought a house; `from` is the one it replaced, if any. */
  | { k: 'house'; seat: number; house: string | null; from?: string }
  | { k: 'sellhouse'; seat: number; from: string }
  | { k: 'loan'; seat: number; n: number }
  | { k: 'repay'; seat: number }
  /** A bill that didn't apply (no kids, no loans). */
  | { k: 'dodge'; seat: number; t: string }
  /** `n` is the net result of the investment. */
  | { k: 'invest'; seat: number; pick: InvestPick; n: number }
  | { k: 'midlife'; seat: number; pick: MidlifePick }
  | { k: 'retire'; seat: number; where: Retirement; kids: number }
  | { k: 'mansion'; seat: number | null };

export interface VidaScore {
  seat: number;
  cash: number;
  house: number;
  tiles: number;
  loans: number;
  total: number;
}

export interface VidaState {
  rng: RngState;
  length: GameLength;
  players: VidaPlayer[];
  current: number;
  turnNumber: number;
  /** The current player has spun this turn. */
  spun: boolean;
  prompt: VidaPrompt | null;
  tilePile: number[];
  careerDeck: string[];
  houseDeck: string[];
  lastSpin: { seat: number; n: number } | null;
  /** Retirement order, first to last. */
  retiredOrder: number[];
  scores: VidaScore[] | null;
  winner: number | null;
  log: VidaLog[];
}

export type VidaIntent =
  | { type: 'spin' }
  | { type: 'path'; college: boolean }
  | { type: 'career'; career: string | null }
  | { type: 'invest'; pick: InvestPick }
  | { type: 'midlife'; pick: MidlifePick }
  | { type: 'house'; house: string | null; sell?: boolean }
  | { type: 'marry'; pick: WeddingPick }
  | { type: 'sue'; target: number }
  | { type: 'retire'; where: Retirement }
  | { type: 'repay' };

const ok = (): ApplyResult => ({ ok: true });
const fail = (reason: string): ApplyResult => ({ ok: false, reason });

export function createVida(seats: SeatInfo[], seed: number, length: GameLength = 'normal'): VidaState {
  const rng = createRng(seed);
  const tiles = TILE_VALUES.flatMap(v => Array<number>(Math.ceil((TILES_EACH * Math.max(4, seats.length)) / TILE_VALUES.length)).fill(v));
  return {
    rng,
    length,
    players: seats.map(s => ({
      id: s.id, name: s.name, pos: -1, cash: START_CASH, loans: 0, career: null, salary: 0, married: false, kids: 0, house: null, bike: false, paydays: 0, tiles: [], retired: null, started: false,
    })),
    current: 0,
    turnNumber: 1,
    spun: false,
    prompt: { kind: 'path' },
    tilePile: shuffle(rng, tiles),
    careerDeck: [],
    houseDeck: [],
    lastSpin: null,
    retiredOrder: [],
    scores: null,
    winner: null,
    log: [],
  };
}

/** Pays from cash, taking bank loans for whatever is missing. */
function pay(s: VidaState, seat: number, amount: number): number {
  const p = s.players[seat]!;
  if (p.cash < amount) {
    const loans = Math.ceil((amount - p.cash) / LOAN);
    p.loans += loans;
    p.cash += loans * LOAN;
    s.log.push({ k: 'loan', seat, n: loans });
  }
  p.cash -= amount;
  return amount;
}

function takeTiles(s: VidaState, seat: number, n: number): void {
  for (let i = 0; i < n && s.tilePile.length > 0; i++) s.players[seat]!.tiles.push(s.tilePile.pop()!);
}

function draw(s: VidaState, pool: string[], n: number): string[] {
  return shuffle(s.rng, pool).slice(0, n);
}

function careerOptions(s: VidaState, degree: boolean, n = 3, own: string | null = null): string[] {
  const taken = new Set(s.players.map(p => p.career));
  const pool = CAREERS.filter(c => c.degree === degree && !taken.has(c.id)).map(c => c.id);
  return draw(s, pool.length >= n ? pool : CAREERS.filter(c => c.degree === degree && c.id !== own).map(c => c.id), n);
}

function hasPerk(s: VidaState, seat: number, perk: Perk): boolean {
  return CAREERS.find(c => c.id === s.players[seat]!.career)?.perks.includes(perk) ?? false;
}

/** Money to or from the bank, logged with its reason. */
function bank(s: VidaState, seat: number, n: number, t: string): void {
  if (n >= 0) s.players[seat]!.cash += n;
  else pay(s, seat, -n);
  s.log.push({ k: 'cash', seat, n, t });
}

function nextTurn(s: VidaState): void {
  s.prompt = null;
  s.spun = false;
  if (s.players.every(p => p.retired)) return finish(s);
  do s.current = (s.current + 1) % s.players.length;
  while (s.players[s.current]!.retired);
  s.turnNumber++;
  if (!s.players[s.current]!.started) s.prompt = { kind: 'path' };
}

function finish(s: VidaState): void {
  // The richest player in the mansions takes the bonus Conquistas; a tie gives them to nobody.
  const mansion = s.players.map((p, i) => ({ p, i })).filter(x => x.p.retired === 'mansion');
  if (mansion.length > 0) {
    const top = Math.max(...mansion.map(x => x.p.cash));
    const richest = mansion.filter(x => x.p.cash === top);
    const seat = richest.length === 1 ? richest[0]!.i : null;
    if (seat !== null) takeTiles(s, seat, MANSION_TILES);
    s.log.push({ k: 'mansion', seat });
  }
  s.scores = s.players.map((p, seat) => {
    const house = HOUSES.find(h => h.id === p.house)?.value ?? 0;
    const tiles = p.tiles.reduce((a, b) => a + b, 0);
    const loans = p.loans * LOAN_PAYBACK;
    return { seat, cash: p.cash, house, tiles, loans, total: p.cash + house + tiles - loans };
  });
  const best = Math.max(...s.scores.map(x => x.total));
  s.winner = s.scores.find(x => x.total === best)!.seat;
}

/** Resolves the square the current player stopped on; may open a prompt instead of ending the turn. */
function land(s: VidaState): void {
  const seat = s.current;
  const p = s.players[seat]!;
  const sq = boardFor(s.length).squares[p.pos]!;
  switch (sq.k) {
    case 'payday':
    case 'blank':
      break;
    case 'cash':
      // Thrifty careers spend 30% less (to the nearest $5k).
      bank(s, seat, sq.n < 0 && hasPerk(s, seat, 'thrift') ? -Math.round((-sq.n * (1 - THRIFT_DISCOUNT)) / 5) * 5 : sq.n, sq.t);
      break;
    case 'bonus':
      bank(s, seat, p.salary, sq.t);
      break;
    case 'collect': {
      // Only players still on the road chip in (or get a share).
      let total = 0;
      s.players.forEach((o, i) => {
        if (i === seat || o.retired) return;
        if (sq.n >= 0) total += pay(s, i, sq.n);
        else {
          o.cash += -sq.n;
          total += sq.n;
        }
      });
      bank(s, seat, total, sq.t);
      break;
    }
    case 'perkid':
      if (p.kids === 0) s.log.push({ k: 'dodge', seat, t: sq.t });
      else bank(s, seat, -sq.n * p.kids, sq.t);
      break;
    case 'interest':
      if (p.loans === 0) s.log.push({ k: 'dodge', seat, t: 'interest' });
      else bank(s, seat, -(hasPerk(s, seat, 'noTax') ? LOAN_INTEREST / 2 : LOAN_INTEREST) * p.loans, 'interest');
      break;
    case 'raise':
      p.salary += sq.n;
      s.log.push({ k: 'raise', seat, n: sq.n, t: sq.t });
      break;
    case 'life':
      takeTiles(s, seat, 1);
      s.log.push({ k: 'life', seat, t: sq.t });
      if (hasPerk(s, seat, 'joy')) bank(s, seat, JOY_CASH, 'joy');
      break;
    case 'baby':
      p.kids += sq.n;
      s.log.push({ k: 'baby', seat, n: sq.n });
      break;
    case 'tax': {
      if (hasPerk(s, seat, 'noTax')) {
        s.log.push({ k: 'dodge', seat, t: 'tax' });
        break;
      }
      const n = Math.max(5, Math.round(p.salary / 4 / 5) * 5);
      pay(s, seat, n);
      s.log.push({ k: 'tax', seat, n });
      break;
    }
    case 'sue':
      if (s.players.some((o, i) => i !== seat && !o.retired)) {
        s.prompt = { kind: 'sue' };
        return;
      }
      break;
    case 'stop':
      if (sq.s === 'graduate') {
        s.prompt = { kind: 'career', options: careerOptions(s, true) };
        return;
      }
      if (sq.s === 'marry') {
        s.prompt = { kind: 'marry' };
        return;
      }
      if (sq.s === 'house') {
        s.prompt = { kind: 'house', options: draw(s, HOUSES.filter(h => h.id !== p.house).map(h => h.id), 3) };
        return;
      }
      if (sq.s === 'job') {
        const degree = CAREERS.find(c => c.id === p.career)?.degree ?? false;
        s.prompt = { kind: 'career', options: careerOptions(s, degree, 2, p.career), keep: true };
        return;
      }
      if (sq.s === 'invest' || sq.s === 'midlife' || sq.s === 'retire') {
        s.prompt = { kind: sq.s };
        return;
      }
  }
  nextTurn(s);
}

/** Moves the current player square by square: paydays pay when passed, stops halt the walk. */
function move(s: VidaState, n: number): void {
  const seat = s.current;
  const p = s.players[seat]!;
  const board = boardFor(s.length);
  for (let i = 0; i < n && p.pos < board.retire; i++) {
    p.pos++;
    const sq = board.squares[p.pos]!;
    if (sq.k === 'payday') {
      p.cash += p.salary;
      s.log.push({ k: 'payday', seat, n: p.salary });
      const house = HOUSES.find(h => h.id === p.house)?.upkeep ?? 0;
      const upkeep = p.kids * KID_UPKEEP + house + (p.bike ? BIKE_UPKEEP : 0);
      if (upkeep > 0) {
        pay(s, seat, upkeep);
        s.log.push({ k: 'upkeep', seat, n: upkeep });
      }
      // The bank's interest falls due every other payday, for as long as a loan is open.
      p.paydays++;
      if (p.loans > 0 && p.paydays % INTEREST_EVERY === 0) bank(s, seat, -Math.round(PAYDAY_INTEREST * p.loans * (hasPerk(s, seat, 'noTax') ? 0.5 : 1)), 'interest');
    }
    if (sq.k === 'stop') break;
  }
  land(s);
}

function isCareer(id: unknown): boolean {
  return CAREERS.some(c => c.id === id);
}

export function applyVida(s: VidaState, seat: number, intent: VidaIntent): ApplyResult {
  if (seat < 0 || seat >= s.players.length) return fail('Not a player');
  if (s.winner !== null) return fail('The game is over');
  if (seat !== s.current) return fail('Not your turn');
  if (!intent || typeof intent !== 'object') return fail('Bad move');
  const p = s.players[seat]!;
  const prompt = s.prompt;
  switch (intent.type) {
    case 'repay':
      if (p.loans === 0) return fail('No loans to repay');
      if (p.cash < LOAN_PAYBACK) return fail('Not enough money');
      p.cash -= LOAN_PAYBACK;
      p.loans--;
      s.log.push({ k: 'repay', seat });
      return ok();
    case 'spin': {
      if (prompt) return fail('Answer the choice first');
      if (s.spun) return fail('Already spun');
      const n = 1 + nextInt(s.rng, SPIN_MAX);
      s.spun = true;
      s.lastSpin = { seat, n };
      s.log.push({ k: 'spin', seat, n });
      move(s, n);
      return ok();
    }
    case 'path':
      if (prompt?.kind !== 'path') return fail('Not now');
      s.log.push({ k: 'path', seat, college: !!intent.college });
      if (intent.college) {
        pay(s, seat, COLLEGE_LOANS * LOAN);
        // College students walk in from before the campus, spinning this same turn.
        p.pos = -1;
        p.started = true;
        s.prompt = null;
      } else {
        s.prompt = { kind: 'career', options: careerOptions(s, false) };
      }
      return ok();
    case 'career': {
      if (prompt?.kind !== 'career') return fail('Not now');
      if (intent.career === null && prompt.keep) {
        p.salary += JOB_KEEP_RAISE;
        s.log.push({ k: 'raise', seat, n: JOB_KEEP_RAISE, t: 'keepJob' });
        nextTurn(s);
        return ok();
      }
      if (!isCareer(intent.career) || !prompt.options.includes(intent.career!)) return fail('Pick one of the careers offered');
      const career = CAREERS.find(c => c.id === intent.career)!;
      // Changing jobs keeps the raises earned so far.
      const raises = p.salary - (CAREERS.find(c => c.id === p.career)?.salary ?? p.salary);
      p.career = career.id;
      p.salary = career.salary + raises;
      s.log.push({ k: 'career', seat, career: career.id });
      if (!p.started) {
        // A career player starts on the career path and takes this turn's spin now.
        p.pos = boardFor(s.length).careerStart;
        p.started = true;
        s.prompt = null;
      } else nextTurn(s);
      return ok();
    }
    case 'house': {
      if (prompt?.kind !== 'house') return fail('Not now');
      const old = HOUSES.find(h => h.id === p.house);
      if (intent.sell === true) {
        // Selling up without buying another: the house's value comes back as cash.
        if (!old) return fail('You have no house to sell');
        p.cash += old.value;
        p.house = null;
        s.log.push({ k: 'sellhouse', seat, from: old.id });
        nextTurn(s);
        return ok();
      }
      if (intent.house !== null && !prompt.options.includes(intent.house)) return fail('Pick one of the houses offered');
      if (intent.house !== null) {
        const house = HOUSES.find(h => h.id === intent.house)!;
        // Moving house: the old one is sold at its value when buying the new one.
        if (old) p.cash += old.value;
        pay(s, seat, house.price);
        p.house = house.id;
      }
      s.log.push({ k: 'house', seat, house: intent.house, ...(old && intent.house !== null ? { from: old.id } : {}) });
      nextTurn(s);
      return ok();
    }
    case 'marry': {
      if (prompt?.kind !== 'marry') return fail('Not now');
      const way = Object.hasOwn(WEDDING, intent.pick) ? WEDDING[intent.pick] : null;
      if (!way) return fail('Bad move');
      p.married = true;
      let gifts = 0;
      if (way.gifts) {
        // Retired players have closed their accounts: no gifts from them.
        s.players.forEach((o, i) => {
          if (i === seat || o.retired) return;
          gifts += pay(s, i, WEDDING_GIFT);
        });
        p.cash += gifts;
      }
      pay(s, seat, way.cost);
      takeTiles(s, seat, way.tiles + (hasPerk(s, seat, 'tiles') ? 1 : 0));
      s.log.push({ k: 'marry', seat, n: gifts, pick: intent.pick });
      nextTurn(s);
      return ok();
    }
    case 'sue': {
      if (prompt?.kind !== 'sue') return fail('Not now');
      const target = intent.target;
      if (typeof target !== 'number' || target === seat || !s.players[target] || s.players[target]!.retired) return fail('Pick another player');
      p.cash += pay(s, target, SUE_AMOUNT);
      s.log.push({ k: 'sue', seat, target, n: SUE_AMOUNT });
      nextTurn(s);
      return ok();
    }
    case 'invest': {
      if (prompt?.kind !== 'invest') return fail('Not now');
      const deal = Object.hasOwn(INVEST, intent.pick) ? INVEST[intent.pick] : null;
      if (!deal) return fail('Bad move');
      if (deal.stake > 0) pay(s, seat, deal.stake);
      const back = deal.odds <= 1 || nextInt(s.rng, deal.odds) === 0 ? deal.win : deal.lose;
      p.cash += back;
      s.log.push({ k: 'invest', seat, pick: intent.pick, n: back - deal.stake });
      nextTurn(s);
      return ok();
    }
    case 'midlife': {
      if (prompt?.kind !== 'midlife') return fail('Not now');
      const way = Object.hasOwn(MIDLIFE, intent.pick) ? MIDLIFE[intent.pick] : null;
      if (!way) return fail('Bad move');
      if (way.cash >= 0) p.cash += way.cash;
      else pay(s, seat, -way.cash);
      takeTiles(s, seat, way.tiles);
      if (intent.pick === 'bike') p.bike = true;
      p.salary += way.raise;
      s.log.push({ k: 'midlife', seat, pick: intent.pick });
      nextTurn(s);
      return ok();
    }
    case 'retire': {
      if (prompt?.kind !== 'retire') return fail('Not now');
      const place = Object.hasOwn(RETIREMENTS, intent.where) ? RETIREMENTS[intent.where] : null;
      if (!place) return fail('Bad move');
      if (place.slots !== null && s.players.filter(o => o.retired === intent.where).length >= place.slots) return fail('That place is already taken');
      if (place.cost > 0) pay(s, seat, place.cost);
      p.retired = intent.where;
      p.cash += p.kids * KID_BONUS + place.salaries * p.salary;
      takeTiles(s, seat, place.tiles + (hasPerk(s, seat, 'tiles') ? 1 : 0));
      // The first ones to arrive are paid for it; with a single player there is nobody to wait for.
      const early = s.players.length > 1 ? RETIRE_EARLY[s.retiredOrder.length] ?? 0 : 0;
      if (early > 0) p.cash += early;
      s.retiredOrder.push(seat);
      s.log.push({ k: 'retire', seat, where: intent.where, kids: p.kids });
      if (early > 0) s.log.push({ k: 'cash', seat, n: early, t: 'early' });
      nextTurn(s);
      return ok();
    }
    default:
      return fail('Bad move');
  }
}

export interface VidaView {
  me: number;
  /** Which track this game is played on. */
  length: GameLength;
  players: (Omit<VidaPlayer, 'tiles'> & { tiles: number; tileValues: number[] | null })[];
  current: number;
  spun: boolean;
  /** The open choice, only for the player who must answer it. */
  prompt: VidaPrompt | null;
  /** What the current player is choosing, for everyone else to see. */
  choosing: VidaPrompt['kind'] | null;
  lastSpin: { seat: number; n: number } | null;
  tilesLeft: number;
  scores: VidaScore[] | null;
  winner: number | null;
  log: VidaLog[];
  /** Entries ever written to the log; the host sends only the latest, so screens diff by this count. */
  logTotal: number;
}

export function vidaView(s: VidaState, seat: number): VidaView {
  const over = s.winner !== null;
  return {
    me: seat,
    length: s.length,
    players: s.players.map(p => ({ ...p, tiles: p.tiles.length, tileValues: over ? p.tiles : null })),
    current: s.current,
    spun: s.spun,
    prompt: s.current === seat ? s.prompt : null,
    choosing: s.prompt?.kind ?? null,
    lastSpin: s.lastSpin,
    tilesLeft: s.tilePile.length,
    scores: s.scores,
    winner: s.winner,
    log: s.log,
    logTotal: s.log.length,
  };
}

/** The cautious answer when time runs out. */
export function defaultIntent(s: VidaState): VidaIntent {
  const prompt = s.prompt;
  if (!prompt) return { type: 'spin' };
  switch (prompt.kind) {
    case 'path':
      return { type: 'path', college: false };
    case 'career':
      return { type: 'career', career: prompt.keep ? null : prompt.options[0]! };
    case 'invest':
      return { type: 'invest', pick: 'savings' };
    case 'midlife':
      return { type: 'midlife', pick: 'deny' };
    case 'house':
      return { type: 'house', house: null };
    case 'marry':
      return { type: 'marry', pick: 'civil' };
    case 'sue': {
      const others = s.players.map((p, i) => ({ p, i })).filter(x => x.i !== s.current && !x.p.retired);
      return { type: 'sue', target: others.sort((a, b) => b.p.cash - a.p.cash)[0]!.i };
    }
    case 'retire':
      return { type: 'retire', where: 'country' };
  }
}

export class VidaInstance implements GameInstance {
  private turnKey = -1;
  private turnObj: object = {};
  constructor(readonly state: VidaState) {}

  private seat(playerId: string): number {
    return this.state.players.findIndex(p => p.id === playerId);
  }

  apply(playerId: string, intent: unknown): ApplyResult {
    return applyVida(this.state, this.seat(playerId), intent as VidaIntent);
  }

  viewFor(playerId: string): VidaView {
    const seat = this.seat(playerId);
    if (seat < 0) throw new Error(`Unknown player: ${playerId}`);
    return vidaView(this.state, seat);
  }

  clockInput(): ClockInput {
    const s = this.state;
    if (s.turnNumber !== this.turnKey) {
      this.turnKey = s.turnNumber;
      this.turnObj = {};
    }
    return { turn: this.turnObj, currentPlayer: s.current, pending: null, over: s.winner !== null };
  }

  get over(): boolean {
    return this.state.winner !== null;
  }

  /** Time ran out: answer every open choice cautiously and spin, until the turn passes. */
  expire(_kind: ClockKind, _seed: number): void {
    const s = this.state;
    const turn = s.turnNumber;
    for (let guard = 0; guard < 10 && s.winner === null && s.turnNumber === turn; guard++) {
      applyVida(s, s.current, defaultIntent(s));
    }
  }
}

/** `auto` plays the normal track with up to AUTO_SHORT_FROM − 1 players and the short one with more, so a full table doesn't take all night. */
export type LengthOption = 'auto' | GameLength;
export interface VidaOptions {
  length: LengthOption;
}
export const AUTO_SHORT_FROM = 5;

export function resolveLength(option: LengthOption, players: number): GameLength {
  if (option === 'auto') return players >= AUTO_SHORT_FROM ? 'short' : 'normal';
  return option;
}

export const vidaModule: GameModule<VidaOptions> = {
  id: 'vida',
  minPlayers: 2,
  maxPlayers: 6,
  defaultOptions: () => ({ length: 'auto' }),
  parseOptions: raw => {
    const length = (raw as { length?: unknown } | null | undefined)?.length;
    if (length === undefined) return { length: 'auto' };
    if (length !== 'auto' && length !== 'short' && length !== 'normal') return { error: 'Bad options' };
    return { length };
  },
  create: (seats, options, seed) => new VidaInstance(createVida(seats, seed, resolveLength(options.length, seats.length))),
};

export function asVidaView(v: unknown): VidaView {
  return v as VidaView;
}
