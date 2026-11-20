/** Vida Adulta's track, careers and houses. Money is in thousands. */

export type StopKind = 'graduate' | 'marry' | 'house' | 'job' | 'invest' | 'midlife' | 'retire';

export type Square =
  | { k: 'payday' }
  | { k: 'cash'; n: number; t: string }
  | { k: 'raise'; n: number; t: string }
  | { k: 'life'; t: string }
  | { k: 'baby'; n: 1 | 2 }
  | { k: 'tax' }
  | { k: 'sue' }
  | { k: 'blank'; t: string }
  /** An extra salary on landing (the 13th, profit sharing). */
  | { k: 'bonus'; t: string }
  /** Every other player still on the road pays you `n` each; negative, you pay each of them. */
  | { k: 'collect'; n: number; t: string }
  /** Pay `n` for each child. */
  | { k: 'perkid'; n: number; t: string }
  /** Pay LOAN_INTEREST for each bank loan. */
  | { k: 'interest' }
  | { k: 'stop'; s: StopKind };

export type ChapterId = 'campus' | 'firstJob' | 'couple' | 'family' | 'hustle' | 'midlife' | 'final';
export type GameLength = 'short' | 'normal';

const payday: Square = { k: 'payday' };
const tax: Square = { k: 'tax' };
const sue: Square = { k: 'sue' };
const interest: Square = { k: 'interest' };
/** Every amount on the track is written in the original small numbers and scaled here, so the whole economy moves together. */
export const MONEY_SCALE = 2;
const cash = (n: number, t: string): Square => ({ k: 'cash', n: n * MONEY_SCALE, t });
const raise = (n: number, t: string): Square => ({ k: 'raise', n, t });
const life = (t: string): Square => ({ k: 'life', t });
const baby = (n: 1 | 2): Square => ({ k: 'baby', n });
const bonus = (t: string): Square => ({ k: 'bonus', t });
const collect = (n: number, t: string): Square => ({ k: 'collect', n: n * MONEY_SCALE, t });
const perkid = (n: number, t: string): Square => ({ k: 'perkid', n: n * MONEY_SCALE, t });
const stop = (s: StopKind): Square => ({ k: 'stop', s });

interface ChapterDef {
  id: ChapterId;
  /** Left out of the short game. */
  long?: boolean;
  squares: Square[];
}

/** Life in chapters; each one ends on a stop square. The campus is walked only by players who chose college. */
const CHAPTERS: readonly ChapterDef[] = [
  {
    id: 'campus',
    squares: [
      cash(-10, 'books'), life('friends'), cash(-5, 'party'), life('exchange'), cash(-10, 'dorm'), life('internship'), cash(10, 'grant'),
      stop('graduate'),
    ],
  },
  {
    id: 'firstJob',
    squares: [
      { k: 'blank', t: 'firstJob' }, cash(-15, 'furniture'), payday, cash(10, 'foundMoney'), life('pet'), cash(-20, 'carBroke'),
      cash(-5, 'coffee'), tax, payday, life('marathon'), cash(-10, 'concert'), collect(5, 'birthday'), cash(-15, 'gym'), raise(5, 'course'),
      payday, life('firstTrip'), cash(-10, 'delivery'), interest, cash(15, 'freela'), payday, cash(-20, 'phone'),
      stop('marry'),
    ],
  },
  {
    id: 'couple',
    squares: [
      life('honeymoon'), cash(-25, 'weddingParty'), payday, cash(10, 'giftsReturn'), baby(1), raise(10, 'promotion'), life('volunteer'),
      cash(-15, 'inlaws'), payday, sue,
      stop('invest'),
      cash(-10, 'streaming'), life('recipe'), tax, payday, cash(-20, 'mattress'), bonus('thirteenth'), cash(-20, 'rentUp'), life('plants'),
      payday, cash(-10, 'airFryer'),
      stop('house'),
    ],
  },
  {
    id: 'family',
    squares: [
      baby(1), life('garden'), cash(-30, 'roof'), payday, perkid(10, 'diapers'), baby(2), cash(-20, 'vet'), raise(10, 'promotion'), tax,
      payday, life('book'), cash(40, 'lottery'), collect(-5, 'barbecue'), sue, cash(-30, 'flood'), payday, baby(1), life('mountain'),
      perkid(15, 'schoolFees'), interest, payday,
      stop('job'),
    ],
  },
  {
    id: 'hustle',
    long: true,
    squares: [
      raise(10, 'bigProject'), cash(-10, 'happyHour'), life('charity'), payday, cash(30, 'sellCar'), tax, cash(-25, 'dentist'), sue,
      life('schoolPlay'), payday, perkid(10, 'kidsParty'), bonus('profitShare'), cash(-20, 'backPain'),
      stop('invest'),
      payday, life('language'), cash(-30, 'carService'), collect(10, 'officePool'), baby(1), cash(-15, 'glasses'), payday, tax,
      raise(10, 'boss'),
      stop('midlife'),
    ],
  },
  {
    id: 'midlife',
    long: true,
    squares: [
      cash(-40, 'sportsCar'), life('reunion'), payday, cash(-20, 'renovation'), perkid(20, 'kidsCollege'), life('worldTrip'), tax,
      cash(50, 'inheritance'), payday, sue, cash(-15, 'hairLoss'), life('garageBand'), interest, raise(10, 'consultant'), payday,
      cash(-25, 'checkup'), collect(10, 'poker'), life('bread'), cash(-30, 'kidCrash'), payday, bonus('thirteenth'),
      stop('house'),
    ],
  },
  {
    id: 'final',
    squares: [
      life('museum'), cash(-30, 'hospital'), payday, cash(20, 'yardSale'), tax, life('award'), cash(-15, 'gift'), perkid(10, 'kidsWedding'),
      payday, life('dance'), sue, cash(30, 'pension'), cash(-20, 'knee'), life('grandkids'), payday, interest, life('cruise'),
      cash(25, 'rentRoom'), payday, life('memoir'),
      stop('retire'),
    ],
  },
];

export interface Chapter {
  id: ChapterId;
  /** First and last square of the chapter. */
  from: number;
  to: number;
}

export interface VidaBoard {
  squares: readonly Square[];
  chapters: readonly Chapter[];
  /** Where the campus ends. */
  graduate: number;
  /** Where players who skip college start. */
  careerStart: number;
  retire: number;
}

function build(length: GameLength): VidaBoard {
  const squares: Square[] = [];
  const chapters: Chapter[] = [];
  for (const c of CHAPTERS) {
    if (c.long && length === 'short') continue;
    chapters.push({ id: c.id, from: squares.length, to: squares.length + c.squares.length - 1 });
    squares.push(...c.squares);
  }
  const graduate = chapters[0]!.to;
  return { squares, chapters, graduate, careerStart: graduate + 1, retire: squares.length - 1 };
}

const BOARDS: Record<GameLength, VidaBoard> = { short: build('short'), normal: build('normal') };

/** The track for a game length; the short game leaves two chapters out. */
export function boardFor(length: GameLength): VidaBoard {
  return BOARDS[length] ?? BOARDS.normal;
}

/** The chapter a square belongs to (the start flag, -1, counts as the first). */
export function chapterAt(board: VidaBoard, pos: number): Chapter {
  return board.chapters.find(c => pos <= c.to) ?? board.chapters[board.chapters.length - 1]!;
}

/** The first stop square after `pos`. */
export function nextStop(board: VidaBoard, pos: number): number {
  for (let i = pos + 1; i < board.squares.length; i++) if (board.squares[i]!.k === 'stop') return i;
  return board.retire;
}

/** The normal game's track. */
export const BOARD: readonly Square[] = BOARDS.normal.squares;
export const GRADUATE = BOARDS.normal.graduate;
export const CAREER_START = BOARDS.normal.careerStart;
export const RETIRE = BOARDS.normal.retire;

/**
 * What a career gives besides its salary, so the lower-paid ones are a real choice:
 * - thrift: spending squares cost 30% less;
 * - noTax: no income tax, and half the bank interest;
 * - joy: every Achievement square also pays JOY_CASH;
 * - tiles: one extra Achievement at the wedding and one at retirement.
 */
export type Perk = 'thrift' | 'noTax' | 'joy' | 'tiles';

export interface Career {
  id: string;
  degree: boolean;
  salary: number;
  perks: readonly Perk[];
}

export const THRIFT_DISCOUNT = 0.3;
export const JOY_CASH = 10;

export const CAREERS: readonly Career[] = [
  { id: 'cashier', degree: false, salary: 35, perks: ['tiles', 'noTax', 'thrift'] },
  { id: 'driver', degree: false, salary: 40, perks: ['tiles', 'thrift'] },
  { id: 'hairdresser', degree: false, salary: 40, perks: ['joy', 'thrift'] },
  { id: 'mechanic', degree: false, salary: 45, perks: ['thrift', 'noTax'] },
  { id: 'artist', degree: false, salary: 45, perks: ['joy', 'tiles'] },
  { id: 'police', degree: false, salary: 50, perks: ['noTax'] },
  { id: 'chef', degree: false, salary: 50, perks: ['joy'] },
  { id: 'teacher', degree: true, salary: 55, perks: ['joy', 'noTax', 'tiles'] },
  { id: 'accountant', degree: true, salary: 60, perks: ['noTax', 'thrift'] },
  { id: 'vet', degree: true, salary: 65, perks: ['joy', 'tiles'] },
  { id: 'programmer', degree: true, salary: 70, perks: ['thrift'] },
  { id: 'engineer', degree: true, salary: 70, perks: ['noTax'] },
  { id: 'lawyer', degree: true, salary: 75, perks: [] },
  { id: 'doctor', degree: true, salary: 80, perks: [] },
];

export interface House {
  id: string;
  price: number;
  /** What it sells for at retirement. */
  value: number;
  /** Paid at every payday while you live there: condo fees, property tax, repairs. */
  upkeep: number;
}

export const HOUSES: readonly House[] = [
  { id: 'kitnet', price: 150, value: 210, upkeep: 3 },
  { id: 'flat', price: 300, value: 420, upkeep: 6 },
  { id: 'villa', price: 400, value: 560, upkeep: 8 },
  { id: 'townhouse', price: 550, value: 770, upkeep: 11 },
  { id: 'farmhouse', price: 650, value: 910, upkeep: 13 },
  { id: 'beach', price: 800, value: 1120, upkeep: 16 },
  { id: 'penthouse', price: 1000, value: 1400, upkeep: 20 },
];

export type InvestPick = 'savings' | 'stocks' | 'crypto';
export type MidlifePick = 'bike' | 'therapy' | 'deny';

/** Investments: the stake, the odds of it working out (1 in `odds`), and what comes back either way. */
export const INVEST: Record<InvestPick, { stake: number; odds: number; win: number; lose: number }> = {
  savings: { stake: 0, odds: 1, win: 60, lose: 60 },
  stocks: { stake: 200, odds: 2, win: 480, lose: 40 },
  crypto: { stake: 200, odds: 5, win: 1200, lose: 0 },
};

/** The midlife crisis: what each way out costs and gives. */
export const MIDLIFE: Record<MidlifePick, { cash: number; tiles: number; raise: number }> = {
  bike: { cash: -250, tiles: 3, raise: 0 },
  therapy: { cash: -60, tiles: 0, raise: 15 },
  deny: { cash: 60, tiles: 0, raise: 0 },
};

/** Values of the Conquista tiles, face down until the end. */
export const TILE_VALUES: readonly number[] = [50, 100, 150, 200, 250];
export const TILES_EACH = 14;

export const START_CASH = 20;
export const LOAN = 100;
export const LOAN_PAYBACK = 120;
/** Charged by the interest squares, per loan. */
export const LOAN_INTEREST = 15;
/** Every this many paydays, each loan also costs PAYDAY_INTEREST, so debt keeps growing until it is repaid. */
export const INTEREST_EVERY = 2;
export const PAYDAY_INTEREST = 10;
export const COLLEGE_LOANS = 1;
export const WEDDING_GIFT = 40;

/** How to marry: the party is paid for by the guests' gifts, the other two buy Achievements instead. */
export type WeddingPick = 'party' | 'civil' | 'honeymoon';
export const WEDDING: Record<WeddingPick, { cost: number; tiles: number; gifts: boolean }> = {
  party: { cost: 80, tiles: 1, gifts: true },
  civil: { cost: 20, tiles: 1, gifts: false },
  honeymoon: { cost: 150, tiles: 2, gifts: false },
};

/**
 * Where to retire. `slots` is how many players can take the place (null: any number); `salaries` is a payout of that many salaries;
 * the mansion pays nothing now, but its richest guest wins MANSION_TILES at the end.
 */
export type Retirement = 'country' | 'beach' | 'world' | 'business' | 'mansion';
export const RETIREMENTS: Record<Retirement, { cost: number; tiles: number; salaries: number; slots: number | null }> = {
  country: { cost: 0, tiles: 2, salaries: 0, slots: null },
  beach: { cost: 150, tiles: 3, salaries: 0, slots: null },
  world: { cost: 250, tiles: 4, salaries: 0, slots: 1 },
  business: { cost: 0, tiles: 0, salaries: 5, slots: null },
  mansion: { cost: 0, tiles: 0, salaries: 0, slots: null },
};
/** Reaching the end first is paid: the 1st, 2nd and 3rd to retire get these, since the others keep earning meanwhile. */
export const RETIRE_EARLY: readonly number[] = [200, 120, 60];
export const SUE_AMOUNT = 100;
export const KID_BONUS = 100;
/** Each child costs this at every payday. */
export const KID_UPKEEP = 5;
/** The motorbike's insurance, fuel and repairs at every payday. */
export const BIKE_UPKEEP = 6;
export const COUNTRY_TILES = 2;
export const MANSION_TILES = 4;
/** Staying in your job at the career crossroads is worth this raise. */
export const JOB_KEEP_RAISE = 10;
export const SPIN_MAX = 9;
