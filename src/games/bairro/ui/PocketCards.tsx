import { useState } from 'react';
import type { ReactNode } from 'react';
import { BOARD } from '../board';
import { pocketKind } from '../deck';
import type { PocketKind } from '../deck';
import { caronaTargets } from '../engine';
import { BICHEIRO_BONUS, PRACINHA_BONUS } from '../skills';
import type { BairroIntent, SkillId } from '../types';
import type { BairroView } from '../view';
import { BairroDialog } from './BairroDialog';
import { Die } from './Die';
import { money } from './text';
import { useBairroText } from './useBairroText';
import { useLang } from '../../../i18n/LangProvider';

export const POCKET_ICONS: Record<PocketKind, string> = {
  dadoViciado: '🎲', marchaRe: '⏪', calote: '🙈', fiscal: '🕵️', carona: '🛺', seguro: '🛡️',
};
export const SKILL_ICONS: Record<SkillId, string> = {
  donoDaCasa: '🏠', reiDaPracinha: '👑', empreiteiro: '🧱', corretor: '🤝', malandro: '😎', bicheiro: '🦁',
};

/** When each kind of card is played, as a `ui` key. */
const WHEN: Record<PocketKind, string> = {
  dadoViciado: 'cardWhenRoll', marchaRe: 'cardWhenRoll', carona: 'cardWhenRoll', fiscal: 'cardWhenTurn', calote: 'cardWhenRent', seguro: 'cardAutomatic',
};

const PRACINHA_POS = BOARD.findIndex(sq => sq.kind === 'pracinha');
const posOf = (id: string) => BOARD.findIndex(sq => sq.id === id);

/** A skill's description, with the board's names and amounts filled in. */
export function useSkillHint(): (skill: SkillId) => string {
  const { lang } = useLang();
  const text = useBairroText();
  return skill =>
    text.ui(`skillHint_${skill}`, {
      pracinha: text.square(PRACINHA_POS), start: text.square(posOf('start')), iptu: text.square(posOf('iptu')), bolao: text.square(posOf('bolao')),
      amount: money(lang, skill === 'bicheiro' ? BICHEIRO_BONUS : PRACINHA_BONUS),
    });
}

/** Whether you can play the card from the hand now. The Calote is played from the rent buttons and the Seguro plays itself. */
export function cardPlayable(view: BairroView, kind: PocketKind): boolean {
  const me = view.players[view.you]!;
  const mayRoll = view.pending === 'roll' || (view.pending === 'manage' && view.phase.kind === 'manage' && view.phase.rollAgain);
  switch (kind) {
    case 'dadoViciado':
      return mayRoll;
    case 'marchaRe':
    case 'carona':
      return mayRoll && me.jailTurns === null;
    case 'fiscal':
      return view.pending === 'roll' || view.pending === 'manage';
    default:
      return false;
  }
}

interface HandProps {
  view: BairroView;
  names: string[];
  awaiting: boolean;
  /** The board is still moving: cards wait for it, like the buttons. */
  moving: boolean;
  onIntent(intent: BairroIntent): void;
}

/** Your kept cards as a row of chips; tapping one opens it, to read or to play. */
export function PocketHand({ view, names, awaiting, moving, onIntent }: HandProps) {
  const text = useBairroText();
  const [open, setOpen] = useState<string | null>(null);
  const hand = view.players[view.you]?.hand ?? [];
  if (hand.length === 0) return null;
  const shown = open !== null && hand.includes(open) ? open : null;
  return (
    <div className="bhand" aria-label={text.ui('cardsInHand')}>
      {hand.map(id => {
        const kind = pocketKind(id)!;
        const ready = !moving && cardPlayable(view, kind);
        return (
          <button key={id} type="button" className={`bhand__card${ready ? ' is-ready' : ''}`} onClick={() => setOpen(id)}>
            <span aria-hidden="true">{POCKET_ICONS[kind]}</span>
            {text.ui(`pocket_${kind}`)}
          </button>
        );
      })}
      {shown && (
        <CardDialog
          view={view}
          names={names}
          id={shown}
          enabled={!awaiting && !moving}
          onClose={() => setOpen(null)}
          onPlay={intent => {
            setOpen(null);
            onIntent(intent);
          }}
        />
      )}
    </div>
  );
}

interface DialogProps {
  view: BairroView;
  names: string[];
  id: string;
  enabled: boolean;
  onClose(): void;
  onPlay(intent: BairroIntent): void;
}

/** One kept card: what it does, and for the ones played from the hand, the choice it needs and the button to play it. */
function CardDialog({ view, names, id, enabled, onClose, onPlay }: DialogProps) {
  const text = useBairroText();
  const kind = pocketKind(id)!;
  const me = view.players[view.you]!;
  const [choice, setChoice] = useState<number | null>(null);
  const name = text.ui(`pocket_${kind}`);
  const playable = cardPlayable(view, kind);

  /** `name` is what a screen reader says for the option (the dice are drawn, not written). */
  let options: { value: number; label: ReactNode; name: string; note?: string }[] = [];
  let prompt = '';
  if (kind === 'dadoViciado') {
    prompt = text.ui('cardPickDie');
    options = [1, 2, 3, 4, 5, 6].map(n => ({ value: n, label: <Die face={n} rolling={false} />, name: String(n) }));
  } else if (kind === 'marchaRe') {
    prompt = text.ui('cardPickSteps');
    options = [1, 2, 3].map(n => {
      const label = n === 1 ? text.ui('cardStepOne') : text.ui('cardSteps', { n });
      return { value: n, label, name: label, note: text.square((me.pos - n + BOARD.length) % BOARD.length) };
    });
  } else if (kind === 'carona') {
    prompt = text.ui('cardPickSquare');
    options = caronaTargets(me.pos).map(pos => ({ value: pos, label: text.square(pos), name: text.square(pos) }));
  } else if (kind === 'fiscal') {
    prompt = text.ui('cardPickTarget');
    options = view.players.flatMap((p, i) => {
      if (i === view.you || p.bankrupt) return [];
      const guarded = p.hand.some(c => pocketKind(c) === 'seguro');
      const name = names[i] ?? '';
      return [{ value: i, label: name, name, note: guarded ? text.ui('cardHasGuard', { name: text.ui('pocket_seguro') }) : undefined }];
    });
  }

  const intent = (value: number): BairroIntent => {
    const field = { dadoViciado: 'die', marchaRe: 'steps', carona: 'pos', fiscal: 'target' }[kind as 'dadoViciado'];
    return { type: 'playCard', card: id, [field]: value };
  };

  return (
    <BairroDialog title={`${POCKET_ICONS[kind]} ${name}`} onClose={onClose} className="bcarddlg">
      <p>{text.ui(`pocketHint_${kind}`)}</p>
      <p className="muted">{text.ui(WHEN[kind])}</p>
      {playable && options.length > 0 && (
        <>
          <p className="bcarddlg__prompt">{prompt}</p>
          <div className={`bcarddlg__options bcarddlg__options--${kind}`} role="radiogroup" aria-label={prompt}>
            {options.map(o => (
              <button key={o.value} type="button" role="radio" aria-checked={choice === o.value} aria-label={o.note ? `${o.name}, ${o.note}` : o.name} className={choice === o.value ? 'is-picked' : ''} onClick={() => setChoice(o.value)}>
                <span>{o.label}</span>
                {o.note && <small className="muted">{o.note}</small>}
              </button>
            ))}
          </div>
        </>
      )}
      <div className="besc__actions">
        {playable && options.length > 0 && (
          <button type="button" className="primary" disabled={!enabled || choice === null} onClick={() => choice !== null && onPlay(intent(choice))}>
            {text.ui('cardSend', { name })}
          </button>
        )}
        <button type="button" onClick={onClose}>
          {text.ui('cardBack')}
        </button>
      </div>
    </BairroDialog>
  );
}
