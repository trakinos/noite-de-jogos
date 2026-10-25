import { useEffect, useRef, useState } from 'react';
import type { LocalClock } from '../../../net/guest';
import type { LobbyState } from '../../../net/protocol';
import { useLang } from '../../../i18n/LangProvider';
import { ConfirmDialog } from '../../../ui/components/ConfirmDialog';
import { Icon } from '../../../ui/components/Icon';
import { TimerBar } from '../../../ui/components/TimerBar';
import { playerColor } from '../../../ui/playerColor';
import { BAIRRO_DICTIONARIES } from '../i18n';
import type { BairroIntent } from '../types';
import type { BairroView } from '../view';
import { EscrituraDialog } from './EscrituraDialog';
import { escrituraFor } from './escritura';
import { MapBoard } from './MapBoard';
import { StreetBoard } from './StreetBoard';
import { useMediaQuery } from './useMediaQuery';

/** Computers get the neighborhood map; narrower screens get the street in focus. */
const WIDE = '(min-width: 900px)';
/** Refused-move toasts dismiss themselves after this long, as in Dominion. */
const TOAST_MS = 5000;

export interface BairroBoardProps {
  view: BairroView;
  lobby: LobbyState;
  code: string;
  error: string | null;
  /** The running turn or response clock, if the room has a turn timer. */
  clock: LocalClock | null;
  /** True while an intent is on its way to the host. */
  awaiting: boolean;
  onIntent(intent: BairroIntent): void;
  onDismissError(): void;
  /** Only passed to the host: ends the game for everyone. */
  onEndGame?(): void;
  /** Shows the Rules button when given. */
  onRules?(): void;
}

export function BairroBoard({ view, lobby, code, error, clock, awaiting, onIntent, onDismissError, onEndGame, onRules }: BairroBoardProps) {
  const { tr, lang } = useLang();
  const wide = useMediaQuery(WIDE);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const menu = useRef<HTMLDetailsElement>(null);
  const names = view.players.map(p => p.name);
  const colors = view.players.map(p => playerColor(lobby, p.id));
  // Tapping a square or an escritura opens its escritura; squares that are not deeds do nothing.
  const [deedPos, setDeedPos] = useState<number | null>(null);
  const onOpenSquare = (pos: number) => {
    if (escrituraFor(view, pos)) setDeedPos(pos);
  };

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(onDismissError, TOAST_MS);
    return () => clearTimeout(timer);
  }, [error]);

  const reasons = BAIRRO_DICTIONARIES[lang].reasons;
  const errorText = error && (Object.hasOwn(reasons, error) ? reasons[error] : tr.reason(error));
  const layout = { view, names, colors, awaiting, onIntent, onOpenSquare };

  return (
    <main className={`bboard ${wide ? 'bboard--wide' : 'bboard--narrow'}`}>
      <header className="board__top bboard__top">
        <div className="brand">
          {tr.t('gameBairroName')}
          <span className="room">{code}</span>
        </div>
        {clock && <TimerBar clock={clock} />}
        {onRules && (
          <button type="button" className="rules-btn" onClick={onRules} title={tr.t('rules')}>
            <Icon name="book" />
            <span>{tr.t('rules')}</span>
          </button>
        )}
        {onEndGame && (
          <details className="menu" ref={menu}>
            <summary aria-label={tr.t('moreOptions')} title={tr.t('moreOptions')}>
              <Icon name="more" />
            </summary>
            <div className="menu__list">
              <button
                type="button"
                className="danger"
                onClick={() => {
                  if (menu.current) menu.current.open = false;
                  setConfirmEnd(true);
                }}
              >
                <Icon name="x" />
                {tr.t('endGame')}…
              </button>
            </div>
          </details>
        )}
      </header>

      {wide ? <MapBoard {...layout} /> : <StreetBoard {...layout} />}

      {deedPos !== null && (
        <EscrituraDialog view={view} pos={deedPos} names={names} awaiting={awaiting} onIntent={onIntent} onClose={() => setDeedPos(null)} />
      )}

      {errorText && (
        <div className="toast bboard__toast" role="alert">
          <span className="toast__ic">
            <Icon name="alert" />
          </span>
          <span>{errorText}</span>
          <button type="button" onClick={onDismissError} aria-label={tr.t('dismiss')}>
            <Icon name="x" />
          </button>
        </div>
      )}

      {confirmEnd && onEndGame && (
        <ConfirmDialog
          title={tr.t('endGameTitle')}
          body={tr.t('endGameConfirm')}
          cancel={tr.t('keepPlaying')}
          confirm={tr.t('endGame')}
          onCancel={() => setConfirmEnd(false)}
          onConfirm={() => {
            setConfirmEnd(false);
            onEndGame();
          }}
        />
      )}
    </main>
  );
}
