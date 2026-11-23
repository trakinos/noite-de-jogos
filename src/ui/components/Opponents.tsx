import type { PlayerView } from '../../engine/view';
import { useLang } from '../../i18n/LangProvider';
import type { AttackRound } from '../attacks';
import { primaryType } from '../format';
import { Avatar } from './Avatar';
import { Icon } from './Icon';

interface Props {
  view: PlayerView;
  online(playerIndex: number): boolean;
  colorOf(playerIndex: number): string;
  /** The attack played this turn, to mark who was hit and who defended. */
  attack?: AttackRound | null;
}

export function Opponents({ view, online, colorOf, attack }: Props) {
  const { tr } = useLang();
  return (
    <ul className="opponents">
      {view.players.map((p, i) =>
        i === view.you ? null : (
          <li key={p.id} className={i === view.turn.player ? 'is-current' : ''} data-motion={`seat-${i}`}>
            <Avatar name={p.name} color={colorOf(i)} online={online(i)} />
            {attack?.outcomes[i] && (
              <span
                className={`seat__attack seat__attack--${attack.outcomes[i]}`}
                title={tr.t(attack.outcomes[i] === 'blocked' ? 'attackBlocked' : 'attackHit', { card: tr.card(attack.card) })}
              >
                <Icon name={attack.outcomes[i] === 'blocked' ? 'shield' : 'sword'} />
                <span className="sr-only">{tr.t(attack.outcomes[i] === 'blocked' ? 'attackBlocked' : 'attackHit', { card: tr.card(attack.card) })}</span>
              </span>
            )}
            <span>
              <span className="seat__name">{p.name}</span>
              <span className="seat__tag">{i === view.turn.player ? tr.t('onTurn') : online(i) ? tr.t('online') : tr.t('offline')}</span>
            </span>
            <span className="stats">
              <span title={tr.t('hand')}>
                <Icon name="hand" />
                <span className="sr-only">{tr.t('hand')}</span>
                {p.handCount}
              </span>
              <span title={tr.t('deck')}>
                <Icon name="deck" />
                <span className="sr-only">{tr.t('deck')}</span>
                {p.deckCount}
              </span>
              <span title={tr.t('discardPile')}>
                <Icon name="discard" />
                <span className="sr-only">{tr.t('discardPile')}</span>
                {p.discardCount}
              </span>
            </span>
            {p.discardTop && <span className={`lchip lchip--${primaryType(p.discardTop)}`}>{tr.card(p.discardTop)}</span>}
          </li>
        ),
      )}
    </ul>
  );
}
