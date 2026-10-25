import { useLang } from '../../../i18n/LangProvider';
import { BOARD } from '../board';
import type { BairroIntent } from '../types';
import type { BairroView } from '../view';
import { actionsFor } from './actions';
import type { Action } from './actions';
import { useDiceFaces } from './useBairroMotion';
import { money } from './text';
import { useBairroText } from './useBairroText';
import { waitingFor } from './waiting';

const PRACINHA_POS = BOARD.findIndex(sq => sq.kind === 'pracinha');

interface Props {
  view: BairroView;
  names: string[];
  awaiting: boolean;
  onIntent(intent: BairroIntent): void;
  /** The Trade button opens the trade dialog. */
  onTrade(): void;
  /** Phones: no title, smaller dice, full-width buttons. */
  compact?: boolean;
}

/** The middle of the board: whose turn, the dice, the last move and your buttons. */
export function Pracinha({ view, names, awaiting, onIntent, onTrade, compact = false }: Props) {
  const { tr } = useLang();
  const text = useBairroText();
  // The debt dialog owns Pay and Faliu while you owe.
  const actions = view.pending === 'debt' ? [] : actionsFor(view, awaiting);
  const waiting = waitingFor(view, names, tr.lang);
  const last = [...view.log].reverse().find(e => e.key !== 'turnStarted');
  const faces = useDiceFaces(view);
  const label = (a: Action) => text.ui(a.label, a.amount === undefined ? undefined : { amount: money(tr.lang, a.amount) });

  return (
    <div className={`pracinha${compact ? ' pracinha--compact' : ''}`}>
      {!compact && <h2 className="pracinha__title">{text.square(PRACINHA_POS)}</h2>}
      <p className="pracinha__turn">
        {view.current === view.you ? text.ui('yourTurn') : text.ui('turnOf', { name: names[view.current] ?? '' })}
      </p>
      {view.lastRoll && faces ? (
        <div className="pracinha__dice" role="img" aria-label={text.ui('dice', { d1: view.lastRoll[0], d2: view.lastRoll[1] })}>
          <span className={`bdie${faces !== view.lastRoll ? ' bdie--shake' : ''}`}>{faces[0]}</span>
          <span className={`bdie${faces !== view.lastRoll ? ' bdie--shake' : ''}`}>{faces[1]}</span>
        </div>
      ) : (
        <p className="pracinha__log">{text.ui('noRollYet')}</p>
      )}
      {last && <p className="pracinha__log" aria-live={compact ? 'polite' : undefined}>{text.logLine(last, names)}</p>}
      {waiting && <p className="pracinha__log" role="status">{text.ui(waiting.key, waiting.params)}</p>}
      {view.pending === 'debt' && <p className="pracinha__log" role="status">{text.ui('debtOpenHint')}</p>}
      {actions.length > 0 && (
        <div className="pracinha__actions">
          {actions.map((a, i) => (
            <button
              key={a.id}
              type="button"
              className={i === 0 ? 'primary' : ''}
              disabled={!a.enabled}
              onClick={() => (a.id === 'trade' ? onTrade() : a.intent && onIntent(a.intent))}
            >
              {label(a)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
