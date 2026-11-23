import type { CardId } from '../../engine/types';
import { Card } from './Card';

interface Props {
  cards: CardId[];
  playable: boolean[];
  /** It is your turn and nothing is pending: cards you cannot play fade out. */
  active: boolean;
  onPlay(handIndex: number): void;
  /** The hand card that gets a flag, and its text. */
  badge?: { index: number; text: string } | null;
}

export function Hand({ cards, playable, active, onPlay, badge }: Props) {
  return (
    <div className="hand" data-motion="hand">
      {cards.map((id, i) => (
        <Card
          key={`${i}-${id}`}
          id={id}
          badge={badge?.index === i ? badge.text : undefined}
          highlight={playable[i]}
          dimmed={active && !playable[i]}
          onClick={playable[i] ? () => onPlay(i) : undefined}
        />
      ))}
    </div>
  );
}
