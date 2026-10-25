export type LuckEffect =
  | { kind: 'money'; amount: number }        // + from bank, − to bank
  | { kind: 'eachPlayer'; amount: number }   // + each other player pays you, − you pay each
  | { kind: 'advanceToStart' } | { kind: 'goToJail' } | { kind: 'lawyer' };
export interface LuckCard { id: string; tone: 'bom' | 'ruim'; effect: LuckEffect }

const effects: LuckEffect[] = [
  { kind: 'lawyer' }, { kind: 'lawyer' },
  { kind: 'goToJail' }, { kind: 'goToJail' },
  { kind: 'advanceToStart' }, { kind: 'advanceToStart' },
  ...[200, 150, 100, 100, 50, 50, 25, 20, -200, -150, -100, -100, -50, -50, -25, -20]
    .map((amount): LuckEffect => ({ kind: 'money', amount })),
  ...[50, 20, -50, -20].map((amount): LuckEffect => ({ kind: 'eachPlayer', amount })),
  ...[75, -75, 10, -10].map((amount): LuckEffect => ({ kind: 'money', amount })),
];

const tone = (e: LuckEffect): 'bom' | 'ruim' =>
  e.kind === 'advanceToStart' || e.kind === 'lawyer' ? 'bom'
    : e.kind === 'goToJail' ? 'ruim'
    : e.amount > 0 ? 'bom' : 'ruim';

export const DECK: readonly LuckCard[] = effects.map((effect, i) => ({
  id: `c${String(i + 1).padStart(2, '0')}`, tone: tone(effect), effect,
}));
