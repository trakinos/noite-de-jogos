/** Vida Adulta's track, careers and houses. Money is in thousands. */

export type Square =
  | { k: 'payday' }
  | { k: 'cash'; n: number; t: string }
  | { k: 'raise'; n: number; t: string }
  | { k: 'life'; t: string }
  | { k: 'baby'; n: 1 | 2 }
  | { k: 'tax' }
  | { k: 'sue' }
  | { k: 'blank'; t: string }
  | { k: 'stop'; s: 'graduate' | 'marry' | 'house' | 'retire' };

/** Squares 0–7 are the campus, walked only by players who chose college; everyone else starts on CAREER_START. */
export const BOARD: readonly Square[] = [
  { k: 'cash', n: -10, t: 'books' },
  { k: 'life', t: 'friends' },
  { k: 'cash', n: -5, t: 'party' },
  { k: 'life', t: 'exchange' },
  { k: 'cash', n: -10, t: 'dorm' },
  { k: 'life', t: 'internship' },
  { k: 'cash', n: 10, t: 'grant' },
  { k: 'stop', s: 'graduate' },
  // 8: the career path starts here.
  { k: 'blank', t: 'firstJob' },
  { k: 'cash', n: -15, t: 'furniture' },
  { k: 'payday' },
  { k: 'cash', n: 10, t: 'foundMoney' },
  { k: 'life', t: 'pet' },
  { k: 'cash', n: -20, t: 'carBroke' },
  { k: 'tax' },
  { k: 'life', t: 'marathon' },
  { k: 'payday' },
  { k: 'cash', n: -10, t: 'concert' },
  { k: 'stop', s: 'marry' },
  { k: 'life', t: 'honeymoon' },
  // 20
  { k: 'cash', n: -25, t: 'weddingParty' },
  { k: 'payday' },
  { k: 'baby', n: 1 },
  { k: 'raise', n: 10, t: 'promotion' },
  { k: 'life', t: 'volunteer' },
  { k: 'sue' },
  { k: 'payday' },
  { k: 'cash', n: -30, t: 'roof' },
  { k: 'stop', s: 'house' },
  { k: 'baby', n: 1 },
  // 30
  { k: 'life', t: 'garden' },
  { k: 'payday' },
  { k: 'tax' },
  { k: 'baby', n: 2 },
  { k: 'cash', n: -20, t: 'vet' },
  { k: 'raise', n: 10, t: 'promotion' },
  { k: 'payday' },
  { k: 'life', t: 'book' },
  { k: 'cash', n: 40, t: 'lottery' },
  { k: 'sue' },
  // 40
  { k: 'cash', n: -30, t: 'flood' },
  { k: 'payday' },
  { k: 'baby', n: 1 },
  { k: 'life', t: 'mountain' },
  { k: 'cash', n: -25, t: 'schoolFees' },
  { k: 'tax' },
  { k: 'payday' },
  { k: 'raise', n: 10, t: 'bigProject' },
  { k: 'life', t: 'charity' },
  { k: 'cash', n: 30, t: 'sellCar' },
  // 50
  { k: 'sue' },
  { k: 'payday' },
  { k: 'cash', n: -40, t: 'sportsCar' },
  { k: 'life', t: 'reunion' },
  { k: 'baby', n: 1 },
  { k: 'cash', n: -20, t: 'renovation' },
  { k: 'payday' },
  { k: 'life', t: 'worldTrip' },
  { k: 'tax' },
  { k: 'cash', n: 50, t: 'inheritance' },
  // 60
  { k: 'sue' },
  { k: 'payday' },
  { k: 'life', t: 'museum' },
  { k: 'cash', n: -30, t: 'hospital' },
  { k: 'life', t: 'award' },
  { k: 'payday' },
  { k: 'cash', n: -15, t: 'gift' },
  { k: 'life', t: 'dance' },
  { k: 'cash', n: 20, t: 'yardSale' },
  { k: 'payday' },
  // 70
  { k: 'stop', s: 'retire' },
];

export const GRADUATE = 7;
export const CAREER_START = 8;
export const RETIRE = BOARD.length - 1;

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

/** Values of the Conquista tiles, face down until the end. */
export const TILE_VALUES: readonly number[] = [50, 100, 150, 200, 250];
export const TILES_EACH = 8;

export const START_CASH = 10;
export const LOAN = 50;
export const LOAN_PAYBACK = 60;
export const COLLEGE_LOANS = 2;
export const WEDDING_GIFT = 20;
export const SUE_AMOUNT = 50;
export const KID_BONUS = 50;
export const COUNTRY_TILES = 2;
export const MANSION_TILES = 4;
export const SPIN_MAX = 10;
