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
const cash = (n: number, t: string): Square => ({ k: 'cash', n, t });
const raise = (n: number, t: string): Square => ({ k: 'raise', n, t });
const life = (t: string): Square => ({ k: 'life', t });
const baby = (n: 1 | 2): Square => ({ k: 'baby', n });
const bonus = (t: string): Square => ({ k: 'bonus', t });
const collect = (n: number, t: string): Square => ({ k: 'collect', n, t });
const perkid = (n: number, t: string): Square => ({ k: 'perkid', n, t });
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

export interface Career {
  id: string;
  degree: boolean;
  salary: number;
}

export const CAREERS: readonly Career[] = [
  { id: 'cashier', degree: false, salary: 30 },
  { id: 'driver', degree: false, salary: 40 },
  { id: 'hairdresser', degree: false, salary: 40 },
  { id: 'mechanic', degree: false, salary: 50 },
  { id: 'artist', degree: false, salary: 50 },
  { id: 'police', degree: false, salary: 60 },
  { id: 'chef', degree: false, salary: 60 },
  { id: 'teacher', degree: true, salary: 60 },
  { id: 'accountant', degree: true, salary: 70 },
  { id: 'vet', degree: true, salary: 80 },
  { id: 'programmer', degree: true, salary: 90 },
  { id: 'engineer', degree: true, salary: 90 },
  { id: 'lawyer', degree: true, salary: 100 },
  { id: 'doctor', degree: true, salary: 110 },
];

export interface House {
  id: string;
  price: number;
  /** What it sells for at retirement. */
  value: number;
}

export const HOUSES: readonly House[] = [
  { id: 'kitnet', price: 40, value: 60 },
  { id: 'flat', price: 80, value: 110 },
  { id: 'villa', price: 100, value: 140 },
  { id: 'townhouse', price: 150, value: 200 },
  { id: 'farmhouse', price: 180, value: 230 },
  { id: 'beach', price: 220, value: 300 },
  { id: 'penthouse', price: 300, value: 420 },
];

export type InvestPick = 'savings' | 'stocks' | 'crypto';
export type MidlifePick = 'bike' | 'therapy' | 'deny';

/** Investments: the stake, the odds of it working out (1 in `odds`), and what comes back either way. */
export const INVEST: Record<InvestPick, { stake: number; odds: number; win: number; lose: number }> = {
  savings: { stake: 0, odds: 1, win: 15, lose: 15 },
  stocks: { stake: 50, odds: 2, win: 120, lose: 10 },
  crypto: { stake: 50, odds: 5, win: 300, lose: 0 },
};

/** The midlife crisis: what each way out costs and gives. */
export const MIDLIFE: Record<MidlifePick, { cash: number; tiles: number; raise: number }> = {
  bike: { cash: -80, tiles: 1, raise: 0 },
  therapy: { cash: -20, tiles: 0, raise: 10 },
  deny: { cash: 20, tiles: 0, raise: 0 },
};

/** Values of the Conquista tiles, face down until the end. */
export const TILE_VALUES: readonly number[] = [50, 100, 150, 200, 250];
export const TILES_EACH = 14;

export const START_CASH = 10;
export const LOAN = 50;
export const LOAN_PAYBACK = 60;
export const LOAN_INTEREST = 10;
export const COLLEGE_LOANS = 2;
export const WEDDING_GIFT = 20;
export const SUE_AMOUNT = 50;
export const KID_BONUS = 50;
export const COUNTRY_TILES = 2;
export const MANSION_TILES = 4;
/** Staying in your job at the career crossroads is worth this raise. */
export const JOB_KEEP_RAISE = 10;
export const SPIN_MAX = 9;
