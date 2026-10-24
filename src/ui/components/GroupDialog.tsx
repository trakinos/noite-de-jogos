import type { PlayerView } from '../../engine/view';
import type { LocalClock } from '../../net/guest';
import { useLang } from '../../i18n/LangProvider';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { TimerBar } from './TimerBar';

interface Props {
  group: NonNullable<PlayerView['group']>;
  you: number;
  names: string[];
  colorOf(player: number): string;
  online(player: number): boolean;
  clock: LocalClock | null;
  onHide(): void;
}

/** Everyone answering an attack at once: who is still choosing, live, for whoever is not choosing right now. */
export function GroupDialog({ group, you, names, colorOf, online, clock, onHide }: Props) {
  const { tr } = useLang();
  const done = group.players.filter((p) => p.done).length;
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={tr.t('groupTitle')}>
      <div className="prompt group panel">
        <div className="group__sig">
          <Icon name="clock" />
        </div>
        <h2>{tr.t('groupTitle')}</h2>
        <p className="muted">{group.card ? tr.t('groupBody', { card: tr.card(group.card) }) : tr.t('groupBodyPlain')}</p>
        <ul className="group__list" aria-live="polite">
          {group.players.map(({ player, done }) => (
            <li key={player} className={done ? 'is-done' : ''}>
              <Avatar name={names[player]} color={colorOf(player)} online={online(player)} />
              <span className="group__name">
                {names[player]}
                {player === you && <span className="group__you"> ({tr.t('groupYou')})</span>}
              </span>
              <span className="group__status">
                {done ? <Icon name="check" /> : <span className="group__dots" aria-hidden="true" />}
                {done ? tr.t('groupDone') : tr.t('groupChoosing')}
              </span>
            </li>
          ))}
        </ul>
        <p className="group__progress">{tr.t('groupProgress', { done, total: group.players.length })}</p>
        {clock?.kind === 'response' && <TimerBar clock={clock} />}
        <div className="actions actions--center">
          <button type="button" onClick={onHide}>
            {tr.t('groupHide')}
          </button>
        </div>
      </div>
    </div>
  );
}
