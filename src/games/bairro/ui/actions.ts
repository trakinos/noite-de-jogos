import { liquidationValue } from '../assets';
import { JAIL_FINE } from '../board';
import { pocketKind } from '../deck';
import { buyPrice } from '../skills';
import type { BairroIntent } from '../types';
import type { BairroView } from '../view';
import { tradePartners, tradesLeft } from './trade';

export type ActionId =
  | 'roll' | 'buy' | 'decline' | 'endTurn' | 'payJailFine' | 'useLawyer' | 'payDebt' | 'goBankrupt' | 'trade'
  | 'payRent' | 'calote' | 'useSkill';

export interface Action {
  id: ActionId;
  /** null for `trade`: it opens the trade dialog, which sends the intent itself. */
  intent: BairroIntent | null;
  enabled: boolean;
  /** A key of the bairro `ui` strings; `amount`, when set, fills its `{amount}`. */
  label: string;
  amount?: number;
  /** A key of the bairro `reasons`, when disabled for a reason the player can fix or wait out. */
  reason?: string;
}

const act = (id: ActionId, label: string, enabled = true, amount?: number): Action => ({
  id, intent: { type: id } as BairroIntent, enabled, label, ...(amount === undefined ? {} : { amount }),
});

/** Trading is open on your own turn before and after the move, with someone to trade with; disabled once the turn's proposals are used. */
const tradeAction = (view: BairroView): Action[] => {
  if (tradePartners(view).length === 0) return [];
  const enabled = tradesLeft(view) > 0;
  return [{ id: 'trade', intent: null, enabled, label: 'actTrade', ...(enabled ? {} : { reason: 'tooManyTrades' }) }];
};

/** The main buttons for this player now. */
function available(view: BairroView): Action[] {
  const me = view.players[view.you]!;
  switch (view.pending) {
    case 'roll': {
      const list = [act('roll', 'actRoll')];
      if (me.jailTurns !== null) {
        list.push(act('payJailFine', 'actPayJailFine', me.cash >= JAIL_FINE, JAIL_FINE));
        if (me.lawyerCards > 0) list.push(act('useLawyer', 'actUseLawyer'));
      }
      return [...list, ...tradeAction(view)];
    }
    case 'buy': {
      const price = view.phase.kind === 'buy' ? buyPrice(view, view.you, view.phase.square) : 0;
      const buy = act('buy', 'actBuy', me.cash >= price && !me.fiscal, price);
      return [me.fiscal ? { ...buy, reason: 'fiscalBlocked' } : buy, act('decline', 'actDecline')];
    }
    case 'rent': {
      const amount = view.phase.kind === 'rent' ? view.phase.amount : 0;
      const card = me.hand.find(id => pocketKind(id) === 'calote');
      const list = [act('payRent', 'actPayRent', true, amount)];
      if (card) list.push({ id: 'calote', intent: { type: 'playCard', card }, enabled: true, label: 'actCalote' });
      return list;
    }
    case 'manage': {
      const again = view.phase.kind === 'manage' && view.phase.rollAgain;
      const main = again ? act('roll', 'actRollAgain') : act('endTurn', 'actEndTurn');
      const malandro = !again && me.skill === 'malandro' && !me.skillUsed && me.jailTurns === null ? [act('useSkill', 'actMalandro')] : [];
      return [main, ...malandro, ...tradeAction(view)];
    }
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
