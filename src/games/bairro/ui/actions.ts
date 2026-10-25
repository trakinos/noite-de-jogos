import { liquidationValue } from '../assets';
import { BOARD, JAIL_FINE } from '../board';
import type { BairroIntent } from '../types';
import type { BairroView } from '../view';

export type ActionId = 'roll' | 'buy' | 'decline' | 'endTurn' | 'payJailFine' | 'useLawyer' | 'payDebt' | 'goBankrupt' | 'trade';

export interface Action {
  id: ActionId;
  intent: BairroIntent | null;
  enabled: boolean;
  /** A key of the bairro `ui` strings; `amount`, when set, fills its `{amount}`. */
  label: string;
  amount?: number;
}

const act = (id: ActionId, label: string, enabled = true, amount?: number): Action => ({
  id, intent: { type: id } as BairroIntent, enabled, label, ...(amount === undefined ? {} : { amount }),
});

/** The main buttons for this player now. Trades join in when they land. */
function available(view: BairroView): Action[] {
  const me = view.players[view.you]!;
  switch (view.pending) {
    case 'roll': {
      const list = [act('roll', 'actRoll')];
      if (me.jailTurns !== null) {
        list.push(act('payJailFine', 'actPayJailFine', me.cash >= JAIL_FINE, JAIL_FINE));
        if (me.lawyerCards > 0) list.push(act('useLawyer', 'actUseLawyer'));
      }
      return list;
    }
    case 'buy': {
      const sq = view.phase.kind === 'buy' ? BOARD[view.phase.square] : undefined;
      const price = sq && (sq.kind === 'ponto' || sq.kind === 'servico') ? sq.price : 0;
      return [act('buy', 'actBuy', me.cash >= price, price), act('decline', 'actDecline')];
    }
    case 'manage':
      return view.phase.kind === 'manage' && view.phase.rollAgain ? [act('roll', 'actRollAgain')] : [act('endTurn', 'actEndTurn')];
    case 'debt': {
      const mine = view.debts.filter(d => d.debtor === view.you);
      const oldest = mine[0]!.amount;
      const owed = mine.reduce((sum, d) => sum + d.amount, 0);
      const list = [act('payDebt', 'actPayDebt', me.cash >= oldest, oldest)];
      if (liquidationValue(view, view.you) < owed) list.push(act('goBankrupt', 'actGoBankrupt'));
      return list;
    }
    default:
      return [];
  }
}

/** Everything is disabled while an intent is in flight, so a double tap can't act twice. */
export function actionsFor(view: BairroView, awaiting: boolean): Action[] {
  const list = available(view);
  return awaiting ? list.map(a => ({ ...a, enabled: false })) : list;
}
