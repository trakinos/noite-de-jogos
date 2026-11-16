import { SPIN_MAX, type ChapterId, type Square, type StopKind, type VidaBoard } from './board';

/** What a square means for you, at a glance: its colour on the board and its line in the legend. */
export type SquareKind = 'pay' | 'good' | 'bad' | 'life' | 'family' | 'others' | 'stop' | 'plain';

export const LEGEND: readonly SquareKind[] = ['pay', 'good', 'bad', 'life', 'family', 'others', 'stop'];

export const KIND_ICON: Record<SquareKind, string> = {
  pay: '💵', good: '💰', bad: '💳', life: '⭐', family: '👶', others: '👥', stop: '✋', plain: '💼',
};

export const STOP_ICON: Record<StopKind, string> = {
  graduate: '🎓', marry: '💍', house: '🏠', job: '🔀', invest: '📊', midlife: '🏍️', retire: '🌅',
};

export const CHAPTER_ICON: Record<ChapterId, string> = {
  campus: '🎓', firstJob: '💼', couple: '💑', family: '👶', hustle: '🏃', midlife: '🧔', final: '🌅',
};

export function squareKind(sq: Square): SquareKind {
  switch (sq.k) {
    case 'payday': return 'pay';
    case 'cash': return sq.n >= 0 ? 'good' : 'bad';
    case 'raise':
    case 'bonus': return 'good';
    case 'tax':
    case 'interest':
    case 'perkid': return 'bad';
    case 'life': return 'life';
    case 'baby': return 'family';
    case 'sue':
    case 'collect': return 'others';
    case 'stop': return 'stop';
    case 'blank': return 'plain';
  }
}

export function squareIcon(sq: Square): string {
  switch (sq.k) {
    case 'payday': return '💵';
    case 'cash': return sq.n >= 0 ? '💰' : '💳';
    case 'raise': return '📈';
    case 'bonus': return '🎁';
    case 'life': return '⭐';
    case 'baby': return sq.n === 2 ? '👶👶' : '👶';
    case 'tax': return '🧾';
    case 'interest': return '🏦';
    case 'perkid': return '🧸';
    case 'sue': return '⚖️';
    case 'collect': return sq.n >= 0 ? '🎉' : '🍖';
    case 'blank': return '💼';
    case 'stop': return STOP_ICON[sq.s];
  }
}

/**
 * Where a spin of 1..SPIN_MAX would leave a player standing on `pos`: square → the spins that land there.
 * A stop square halts the walk, so it collects every spin from its distance up.
 */
export function reach(board: VidaBoard, pos: number): Map<number, number[]> {
  const out = new Map<number, number[]>();
  for (let n = 1; n <= SPIN_MAX; n++) {
    let at = pos;
    for (let i = 0; i < n && at < board.retire; i++) {
      at++;
      if (board.squares[at]!.k === 'stop') break;
    }
    if (at === pos) continue;
    out.set(at, [...(out.get(at) ?? []), n]);
  }
  return out;
}

/** "5" for one spin, "5–9" for a stop that catches several. */
export function spinsLabel(spins: number[]): string {
  return spins.length === 1 ? `${spins[0]}` : `${spins[0]}–${spins[spins.length - 1]}`;
}
