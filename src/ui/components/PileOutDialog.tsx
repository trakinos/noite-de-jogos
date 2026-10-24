import { useEffect, useState } from 'react';
import type { CardId } from '../../engine/types';
import { useLang } from '../../i18n/LangProvider';
import { Card } from './Card';
import { Icon } from './Icon';

/** The dialog closes itself after this long. */
const AUTO_CLOSE_MS = 5000;
/** How long the counter shows the last count before it drops to 0. */
const DROP_DELAY_MS = 450;

interface Props {
  card: CardId;
  /** Cards the pile had in the previous view: the counter ticks from here to 0. */
  from: number;
  /** Empty Supply piles now, this one included. */
  empty: number;
  /** Empty piles that end the game. */
  max: number;
  onClose(): void;
}

/** A Supply pile just ran out: show its counter reaching 0 and how close the game is to ending. */
export function PileOutDialog({ card, from, empty, max, onClose }: Props) {
  const { tr } = useLang();
  const [count, setCount] = useState(from);
  useEffect(() => {
    const drop = setTimeout(() => setCount(0), DROP_DELAY_MS);
    const close = setTimeout(onClose, AUTO_CLOSE_MS);
    return () => {
      clearTimeout(drop);
      clearTimeout(close);
    };
  }, [card]);
  const ending = card === 'province' ? tr.t('pileOutProvince') : empty >= max ? tr.t('pileOutLast', { max }) : null;
  return (
    <div className="overlay" role="alertdialog" aria-modal="true" aria-label={tr.t('pileOutTitle', { card: tr.card(card) })} onClick={onClose}>
      <div className="prompt prompt--confirm pile-out panel" onClick={(e) => e.stopPropagation()}>
        <div className="pile-out__stage">
          <div className={`pile-out__card ${count === 0 ? 'is-gone' : ''}`}>
            <Card id={card} size="small" />
          </div>
          <span key={count} className={`pile-out__count ${count === 0 ? 'is-zero' : ''}`} aria-live="polite">
            {count}
          </span>
        </div>
        <h2>{tr.t('pileOutTitle', { card: tr.card(card) })}</h2>
        <p className="muted">{tr.t('pileOutBody', { empty, max })}</p>
        {ending && (
          <p className="pile-out__ending">
            <Icon name="trophy" />
            {ending}
          </p>
        )}
        <div className="actions actions--center">
          <button type="button" className="primary" autoFocus onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
