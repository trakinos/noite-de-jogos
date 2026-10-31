export type PocketKind = 'dadoViciado' | 'marchaRe' | 'calote' | 'fiscal' | 'carona' | 'seguro';

export type LuckEffect =
  | { kind: 'money'; amount: number }        // + from bank, − to bank
  | { kind: 'eachPlayer'; amount: number }   // + each other player pays you, − you pay each
  | { kind: 'advanceToStart' } | { kind: 'goToJail' } | { kind: 'lawyer' }
  | { kind: 'pocket'; card: PocketKind };    // kept in hand and played later (lobby setting)
export interface LuckCard { id: string; tone: 'bom' | 'ruim'; effect: LuckEffect }

/** The most kept cards a player can hold; one drawn beyond that goes back under the deck. */
export const HAND_MAX = 3;
/** Every kind of card to keep, in deck order; two of each. */
export const POCKET_KINDS: readonly PocketKind[] = ['dadoViciado', 'marchaRe', 'calote', 'fiscal', 'carona', 'seguro'];

const effects: LuckEffect[] = [
  { kind: 'lawyer' }, { kind: 'lawyer' },
  { kind: 'goToJail' }, { kind: 'goToJail' },
  { kind: 'advanceToStart' }, { kind: 'advanceToStart' },
  ...[200, 150, 100, 100, 50, 50, 25, 20, -200, -150, -100, -100, -50, -50, -25, -20]
    .map((amount): LuckEffect => ({ kind: 'money', amount })),
  ...[50, 20, -50, -20].map((amount): LuckEffect => ({ kind: 'eachPlayer', amount })),
  ...[75, -75, 10, -10].map((amount): LuckEffect => ({ kind: 'money', amount })),
  ...POCKET_KINDS.flatMap((card): LuckEffect[] => [{ kind: 'pocket', card }, { kind: 'pocket', card }]),
];

const tone = (e: LuckEffect): 'bom' | 'ruim' =>
  e.kind === 'advanceToStart' || e.kind === 'lawyer' || e.kind === 'pocket' ? 'bom'
    : e.kind === 'goToJail' ? 'ruim'
    : e.amount > 0 ? 'bom' : 'ruim';

/** Every Tigrinho card; the cards to keep (c31 on) are only in play with the lobby setting. */
export const DECK: readonly LuckCard[] = effects.map((effect, i) => ({
  id: `c${String(i + 1).padStart(2, '0')}`, tone: tone(effect), effect,
}));

/** The ids a game's deck holds, with or without the cards to keep. */
export const deckIds = (pocketCards: boolean): string[] => DECK.filter(c => pocketCards || c.effect.kind !== 'pocket').map(c => c.id);

/** What kind of card to keep `id` is, or null when it is not one. */
export function pocketKind(id: unknown): PocketKind | null {
  const effect = DECK.find(c => c.id === id)?.effect;
  return effect?.kind === 'pocket' ? effect.card : null;
}
