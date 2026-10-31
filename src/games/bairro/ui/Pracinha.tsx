import type { CSSProperties } from 'react';
import { useLang } from '../../../i18n/LangProvider';
import { BOARD } from '../board';
import type { BairroIntent } from '../types';
import type { BairroView } from '../view';
import { actionsFor } from './actions';
import type { Action } from './actions';
import { useDiceFaces, useDoublesBurst } from './useBairroMotion';
import { Cigarette } from './Cigarette';
import { Die } from './Die';
import { money } from './text';
import { useBairroText } from './useBairroText';
import { waitingFor } from './waiting';
import { PocketHand, SKILL_ICONS, useSkillHint } from './PocketCards';

const PRACINHA_POS = BOARD.findIndex(sq => sq.kind === 'pracinha');

interface Props {
  /** The board as it stands once the motion is done; the dice come from `live`. */
  view: BairroView;
  /** The latest view: the dice roll and land on it. */
  live?: BairroView;
  /** The dice, a walk or a scene is under way: the buttons wait for it. */
  moving?: boolean;
  names: string[];
  awaiting: boolean;
  onIntent(intent: BairroIntent): void;
  /** The Trade button opens the trade dialog. */
  onTrade(): void;
  /** Phones: no title, smaller dice, full-width buttons. */
  compact?: boolean;
}

/** The middle of the board: whose turn, the dice, the last move and your buttons. */
export function Pracinha({ view, live = view, moving = false, names, awaiting, onIntent, onTrade, compact = false }: Props) {
  const { tr } = useLang();
  const text = useBairroText();
  // The debt dialog owns Pay and Faliu while you owe.
  const actions = view.pending === 'debt' || moving ? [] : actionsFor(view, awaiting);
  const waiting = waitingFor(view, names, tr.lang);
  const last = [...view.log].reverse().find(e => e.key !== 'turnStarted');
  const faces = useDiceFaces(live);
  const burst = useDoublesBurst(live);
  const skillHint = useSkillHint();
  const me = view.players[view.you];
  const rent = view.pending === 'rent' && view.phase.kind === 'rent' ? view.phase : null;
  const label = (a: Action) => text.ui(a.label, a.amount === undefined ? undefined : { amount: money(tr.lang, a.amount) });

  return (
    <div className={`pracinha${compact ? ' pracinha--compact' : ''}`}>
      {compact && <Cigarette small />}
      {!compact && <h2 className="pracinha__title">{text.square(PRACINHA_POS)}</h2>}
      <p className="pracinha__turn">
        {view.current === view.you ? text.ui('yourTurn') : text.ui('turnOf', { name: names[view.current] ?? '' })}
      </p>
      {live.lastRoll && faces ? (
        <div className={`pracinha__dice${burst ? ` pracinha__dice--${burst}` : ''}`}>
          <div className="pracinha__dicepair" role="img" aria-label={text.ui('dice', { d1: live.lastRoll[0], d2: live.lastRoll[1] })}>
            <Die face={faces[0]} rolling={faces !== live.lastRoll} />
            <Die face={faces[1]} rolling={faces !== live.lastRoll} />
          </div>
          {/* The numbers come in once the dice have landed; the pair's label already says them. */}
          {faces === live.lastRoll && (
            <p key={live.logTotal} className="pracinha__sum" aria-hidden="true">
              {text.ui('diceSum', { d1: faces[0], d2: faces[1], sum: faces[0] + faces[1] })}
            </p>
          )}
          {burst && (
            <div className={`bburst bburst--${burst}`} role="status">
              <span className="bburst__sparks" aria-hidden="true">
                {Array.from({ length: 10 }, (_, i) => <span key={i} style={{ '--i': i } as CSSProperties} />)}
              </span>
              <strong className="bburst__title">{text.ui(burst === 'third' ? 'doublesThirdTitle' : 'doublesTitle')}</strong>
              <span className="bburst__sub">{text.ui(`doubles_${burst}`)}</span>
            </div>
          )}
        </div>
      ) : (
        <p className="pracinha__log">{text.ui('noRollYet')}</p>
      )}
      {last && <p className="pracinha__log" aria-live={compact ? 'polite' : undefined}>{text.logLine(last, names)}</p>}
      {waiting && <p className="pracinha__log" role="status">{text.ui(waiting.key, waiting.params)}</p>}
      {view.pending === 'debt' && <p className="pracinha__log" role="status">{text.ui('debtOpenHint')}</p>}
      {rent && (
        <p className="pracinha__log pracinha__ask" role="status">
          {text.ui('rentOwed', { amount: money(tr.lang, rent.amount), name: names[view.owned[rent.square]?.owner ?? -1] ?? '', pos: text.square(rent.square) })}
        </p>
      )}
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
          {actions.map(a => a.reason && <small key={a.id} className="besc__reason">{text.reason(a.reason)}</small>)}
        </div>
      )}
      {me && !me.bankrupt && <PocketHand view={view} names={names} awaiting={awaiting} moving={moving} onIntent={onIntent} />}
      {me?.skill && !me.bankrupt && (
        <p className={`pracinha__skill${me.skillUsed ? ' is-spent' : ''}`} title={skillHint(me.skill)}>
          <span aria-hidden="true">{SKILL_ICONS[me.skill]}</span> {text.ui('yourSkill')}: <b>{text.ui(`skill_${me.skill}`)}</b>
          {me.skillUsed && <span className="muted"> · {text.ui('skillSpent')}</span>}
          <small className="muted pracinha__skillhint">{skillHint(me.skill)}</small>
        </p>
      )}
    </div>
  );
}
