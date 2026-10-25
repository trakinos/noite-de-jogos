import { useLang } from '../../../i18n/LangProvider';
import { playerColor } from '../../../ui/playerColor';
import type { LobbyState } from '../../../net/protocol';
import { Avatar } from '../../../ui/components/Avatar';
import { Icon } from '../../../ui/components/Icon';
import type { BairroView } from '../view';
import { ranking } from './ranking';
import { useBairroText } from './useBairroText';

interface Props {
  view: BairroView;
  lobby: LobbyState;
  isHost: boolean;
  onPlayAgain(): void;
  onBackToLobby(): void;
  onLeave(): void;
}

/** Game over: the finishing order, the Dono do Bairro on top, and the same three exits as Dominion's end screen. */
export function BairroEnd({ view, lobby, isHost, onPlayAgain, onBackToLobby, onLeave }: Props) {
  const { tr } = useLang();
  const text = useBairroText();
  const order = ranking(view);
  const winner = view.winner === null ? null : view.players[view.winner];
  return (
    <main className="screen end bend">
      <div className="end__reveal">
        <div className="trophy" aria-hidden="true">
          <Icon name="trophy" />
        </div>
        <h1>{winner ? text.ui('endTitle', { name: winner.name }) : text.ui('endNoWinner')}</h1>
        <ol className="bend__list">
          {order.map((seat, place) => {
            const p = view.players[seat];
            const won = seat === view.winner;
            return (
              <li key={seat} className={`bend__row${won ? ' is-winner' : ''}`}>
                <span className="bend__place">
                  <span className="sr-only">{text.ui('endPlace', { n: place + 1 })}</span>
                  <span aria-hidden="true">{place + 1}</span>
                </span>
                <Avatar name={p.name} color={playerColor(lobby, p.id)} />
                <span className="bend__name">{p.name}</span>
                {won && (
                  <span className="pill pill--gold">
                    <Icon name="trophy" />
                    {text.term('dono-do-bairro')}
                  </span>
                )}
                {p.bankrupt && <span className="pill">{text.ui('endBust')}</span>}
              </li>
            );
          })}
        </ol>
        <div className="actions actions--center">
          {isHost ? (
            <>
              <button type="button" className="primary lg" onClick={onPlayAgain}>
                <Icon name="refresh" />
                {text.ui('endPlayAgain')}
              </button>
              <button type="button" className="lg" onClick={onBackToLobby}>
                {tr.t('backToLobby')}
              </button>
            </>
          ) : (
            <span className="muted">{tr.t('waitingHost')}</span>
          )}
          <button type="button" className="ghost lg" onClick={onLeave}>
            <Icon name="door" />
            {tr.t('leave')}
          </button>
        </div>
      </div>
    </main>
  );
}
