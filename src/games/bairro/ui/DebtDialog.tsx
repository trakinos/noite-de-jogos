import { useEffect, useRef, useState } from 'react';
import { useLang } from '../../../i18n/LangProvider';
import { ConfirmDialog } from '../../../ui/components/ConfirmDialog';
import type { BairroIntent } from '../types';
import type { BairroView } from '../view';
import { actionsFor } from './actions';
import { BairroDialog } from './BairroDialog';
import { escrituraFor } from './escritura';
import { money } from './text';
import { useBairroText } from './useBairroText';

interface Props {
  view: BairroView;
  names: string[];
  awaiting: boolean;
  onIntent(intent: BairroIntent): void;
}

/** Opens by itself while you owe: what you owe, to whom, and the ways out. It can't be dismissed. */
export function DebtDialog({ view, names, awaiting, onIntent }: Props) {
  const { tr } = useLang();
  const text = useBairroText();
  const [confirmBust, setConfirmBust] = useState(false);
  const bustButton = useRef<HTMLButtonElement>(null);
  const $ = (n: number) => money(tr.lang, n);

  // Escape closes only the confirmation; the dialog under it ignores it.
  useEffect(() => {
    if (!confirmBust) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setConfirmBust(false);
      bustButton.current?.focus();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [confirmBust]);

  const mine = view.debts.filter(d => d.debtor === view.you);
  const total = mine.reduce((sum, d) => sum + d.amount, 0);
  const cash = view.players[view.you]?.cash ?? 0;
  const raisers = Object.keys(view.owned).map(Number).sort((a, b) => a - b).flatMap(pos => {
    const buttons = escrituraFor(view, pos)?.buttons.filter(b => (b.id === 'sell' || b.id === 'mortgage') && b.enabled) ?? [];
    return buttons.length > 0 ? [{ pos, buttons }] : [];
  });
  const actions = actionsFor(view, awaiting);
  const pay = actions.find(a => a.id === 'payDebt');
  const bust = actions.find(a => a.id === 'goBankrupt');
  const creditor = (c: number | null) => (c === null ? text.term('prefeitura') : names[c] || text.ui('ownerFallback'));

  return (
    <BairroDialog title={text.ui('debtTitle')} onClose={() => undefined} dismissable={false} className="bdebt">
      <ul className="bdebt__list">
        {mine.map((d, i) => (
          <li key={i}>
            <b>{$(d.amount)}</b> {text.ui('debtOwesTo', { to: creditor(d.creditor) })}
          </li>
        ))}
      </ul>
      <p className="besc__meta">
        <span>{text.ui('debtTotal', { amount: $(total) })}</span>
        <span>{text.ui('debtCash', { amount: $(cash) })}</span>
      </p>

      <h3 className="bdebt__sub">{text.ui('debtRaise')}</h3>
      {raisers.length === 0 ? (
        <p className="muted">{text.ui('debtRaiseNone')}</p>
      ) : (
        <ul className="bdebt__assets">
          {raisers.map(({ pos, buttons }) => (
            <li key={pos}>
              <span className="bdebt__name">{text.square(pos)}</span>
              {buttons.map(b => (
                <button
                  key={b.id}
                  type="button"
                  disabled={awaiting}
                  onClick={() => onIntent(b.id === 'sell' ? { type: 'sellBuilding', pos } : { type: 'mortgage', pos })}
                >
                  {text.ui(b.id === 'sell' ? 'btnSell' : 'btnMortgage', { amount: $(b.amount) })}
                </button>
              ))}
            </li>
          ))}
        </ul>
      )}

      <div className="besc__actions">
        {pay && (
          <button type="button" className="primary" disabled={!pay.enabled} onClick={() => pay.intent && onIntent(pay.intent)}>
            {text.ui(pay.label, { amount: $(pay.amount ?? 0) })}
          </button>
        )}
        {bust && (
          <button type="button" className="danger" ref={bustButton} disabled={!bust.enabled} onClick={() => setConfirmBust(true)}>
            {text.ui(bust.label)}
          </button>
        )}
      </div>

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
    </BairroDialog>
  );
}
