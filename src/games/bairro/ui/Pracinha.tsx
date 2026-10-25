import { useState } from 'react';
import { useLang } from '../../../i18n/LangProvider';
import { ConfirmDialog } from '../../../ui/components/ConfirmDialog';
import { BOARD } from '../board';
import type { BairroIntent } from '../types';
import type { BairroView } from '../view';
import { actionsFor } from './actions';
import type { Action } from './actions';
import { money } from './text';
import { useBairroText } from './useBairroText';

const PRACINHA_POS = BOARD.findIndex(sq => sq.kind === 'pracinha');

interface Props {
  view: BairroView;
  names: string[];
  awaiting: boolean;
  onIntent(intent: BairroIntent): void;
}

/** The middle of the board: whose turn, the dice, the last move and your buttons. */
export function Pracinha({ view, names, awaiting, onIntent }: Props) {
  const { tr } = useLang();
  const text = useBairroText();
  const [confirmBust, setConfirmBust] = useState(false);
  const actions = actionsFor(view, awaiting);
  const last = view.log.at(-1);
  const label = (a: Action) => text.ui(a.label, a.amount === undefined ? undefined : { amount: money(tr.lang, a.amount) });

  function press(a: Action) {
    if (a.id === 'goBankrupt') setConfirmBust(true);
    else if (a.intent) onIntent(a.intent);
  }

  return (
    <div className="pracinha">
      <h2 className="pracinha__title">{text.square(PRACINHA_POS)}</h2>
      <p className="pracinha__turn">
        {view.current === view.you ? text.ui('yourTurn') : text.ui('turnOf', { name: names[view.current] ?? '' })}
      </p>
      {view.lastRoll ? (
        <div className="pracinha__dice" role="img" aria-label={text.ui('dice', { d1: view.lastRoll[0], d2: view.lastRoll[1] })}>
          <span className="bdie">{view.lastRoll[0]}</span>
          <span className="bdie">{view.lastRoll[1]}</span>
        </div>
      ) : (
        <p className="pracinha__log">{text.ui('noRollYet')}</p>
      )}
      {last && <p className="pracinha__log" aria-live="polite">{text.logLine(last, names)}</p>}
      {actions.length > 0 && (
        <div className="pracinha__actions">
          {actions.map((a, i) => (
            <button
              key={a.id}
              type="button"
              className={a.id === 'goBankrupt' ? 'danger' : i === 0 ? 'primary' : ''}
              disabled={!a.enabled}
              onClick={() => press(a)}
            >
              {label(a)}
            </button>
          ))}
        </div>
      )}
      {confirmBust && (
        <ConfirmDialog
          title={text.ui('bankruptTitle')}
          body={text.ui('bankruptBody')}
          cancel={text.ui('bankruptCancel')}
          confirm={text.ui('actGoBankrupt')}
          onCancel={() => setConfirmBust(false)}
          onConfirm={() => {
            setConfirmBust(false);
            onIntent({ type: 'goBankrupt' });
          }}
        />
      )}
    </div>
  );
}
