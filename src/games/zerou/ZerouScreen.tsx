import { useEffect, useRef, useState } from 'react';
import { useLang } from '../../i18n/LangProvider';
import { Avatar } from '../../ui/components/Avatar';
import { playerColor } from '../../ui/playerColor';
import { EndActions, GameFrame, RulesSheet, useGameText, useReason, type GameScreenProps, type Texts, type TextFn } from '../shared/GameFrame';
import { playSound } from '../shared/sound';
import { asZerouView, CATCH_PENALTY, COLORS, HAND, type Card, type Color, type ZerouLog, type ZerouView } from './game';

export const ZEROU_RULES = ['rules1', 'rules2', 'rules3', 'rules4'];

export const ZEROU_TEXT: Texts = {
  pt: {
    rulesTitle: 'Regras do Zerou!',
    rules1: `Cada um recebe ${HAND} cartas. Na sua vez, jogue uma carta da mesma cor ou do mesmo número/símbolo da carta de cima. Sem jogada (ou se preferir), compre uma carta: se ela servir, pode jogá-la na hora; senão, passe.`,
    rules2: 'Pula: o próximo perde a vez. Inverte: troca o sentido (com dois jogadores, funciona como Pula). +2: o próximo compra 2 e perde a vez. Coringa: você escolhe a cor. Coringa +4: escolhe a cor e o próximo compra 4 e perde a vez, mas só vale se você não tiver nenhuma carta da cor atual.',
    rules3: `Ao ficar com uma carta, aperte Última! (antes de jogar a penúltima, ou logo depois). Quem esquecer pode ser pego por qualquer um até o próximo jogador agir, e compra ${CATCH_PENALTY}.`,
    rules4: 'Vence quem zerar a mão primeiro. Com o relógio ligado, quem deixa o tempo acabar compra uma carta e passa.',
    yourTurn: 'Sua vez',
    theirTurn: 'Vez de {name}',
    draw: 'Comprar',
    pass: 'Passar',
    drewPlayable: 'A carta comprada serve: jogue-a ou passe.',
    last: 'Última!',
    lastArmed: 'Última! marcada',
    lastHint: 'Aperte antes de jogar a penúltima carta.',
    catch: 'Pegar {name}! (+{n})',
    forgot: '{name} esqueceu de dizer Última!',
    pickColor: 'Escolha a cor',
    color_r: 'Vermelho',
    color_y: 'Amarelo',
    color_g: 'Verde',
    color_b: 'Azul',
    cards: '{n} cartas',
    one: '1 carta',
    direction: 'Sentido',
    pile: '{n} no monte',
    win: '{name} zerou!',
    log_play: '{name} jogou {card}',
    log_wild: '{name} jogou {card} e escolheu {color}',
    log_draw: '{name} comprou {n}',
    log_pass: '{name} passou',
    log_last: '{name}: Última!',
    log_caught: '{by} pegou {name}: +2',
    log_win: '{name} zerou a mão!',
    v_skip: 'Pula',
    v_rev: 'Inverte',
    v_draw2: '+2',
    v_wild: 'Coringa',
    v_wild4: 'Coringa +4',
    playAgain: 'Jogar de novo',
    'reason:Not your turn': 'Não é a sua vez.',
    'reason:That card does not match': 'Essa carta não combina com a de cima.',
    'reason:Coringa +4 only without the current color': 'O Coringa +4 só vale sem cartas da cor atual.',
    'reason:You can only play the card you drew': 'Agora só dá para jogar a carta comprada.',
    'reason:Draw a card first': 'Compre uma carta antes de passar.',
    'reason:Nobody to catch': 'Não há ninguém para pegar.',
  },
  en: {
    rulesTitle: 'Zerou! rules',
    rules1: `Everyone gets ${HAND} cards. On your turn, play a card matching the top card's color or number/symbol. With nothing to play (or if you'd rather), draw a card: if it fits you may play it at once; otherwise pass.`,
    rules2: 'Skip: the next player loses their turn. Reverse: switches direction (with two players it works as Skip). +2: the next player draws 2 and loses their turn. Wild: you pick the color. Wild +4: pick the color, and the next player draws 4 and loses their turn, but only when you have no card of the current color.',
    rules3: `When you get down to one card, press Última! (before playing your second-to-last card, or right after). Anyone can catch a player who forgot until the next player acts, and they draw ${CATCH_PENALTY}.`,
    rules4: 'First to empty their hand wins. With the timer on, running out of time draws a card and passes.',
    yourTurn: 'Your turn',
    theirTurn: "{name}'s turn",
    draw: 'Draw',
    pass: 'Pass',
    drewPlayable: 'The card you drew fits: play it or pass.',
    last: 'Última!',
    lastArmed: 'Última! called',
    lastHint: 'Press before playing your second-to-last card.',
    catch: 'Catch {name}! (+{n})',
    forgot: '{name} forgot to call Última!',
    pickColor: 'Pick a color',
    color_r: 'Red',
    color_y: 'Yellow',
    color_g: 'Green',
    color_b: 'Blue',
    cards: '{n} cards',
    one: '1 card',
    direction: 'Direction',
    pile: '{n} in the pile',
    win: '{name} is out!',
    log_play: '{name} played {card}',
    log_wild: '{name} played {card} and picked {color}',
    log_draw: '{name} drew {n}',
    log_pass: '{name} passed',
    log_last: '{name}: Última!',
    log_caught: '{by} caught {name}: +2',
    log_win: '{name} emptied their hand!',
    v_skip: 'Skip',
    v_rev: 'Reverse',
    v_draw2: '+2',
    v_wild: 'Wild',
    v_wild4: 'Wild +4',
    playAgain: 'Play again',
    'reason:Not your turn': "It's not your turn.",
    'reason:That card does not match': "That card doesn't match the top card.",
    'reason:Coringa +4 only without the current color': 'Wild +4 only when you have none of the current color.',
    'reason:You can only play the card you drew': 'You can only play the card you drew now.',
    'reason:Draw a card first': 'Draw a card before passing.',
    'reason:Nobody to catch': 'There is nobody to catch.',
  },
};

const SYMBOL: Partial<Record<Card['value'], string>> = { skip: '⊘', rev: '⇄', draw2: '+2', wild: '★', wild4: '+4' };

function cardName(c: Card, t: TextFn): string {
  const value = /^\d$/.test(c.value) ? c.value : t(`v_${c.value}`);
  return c.color ? `${value} ${t(`color_${c.color}`).toLowerCase()}` : value;
}

export function CardFace({ card, small, color }: { card: Card; small?: boolean; color?: Color }) {
  const sym = SYMBOL[card.value] ?? card.value;
  const shown = card.color ?? color ?? null;
  return (
    <span className={`zcard zcard--${card.color ?? 'wild'}${small ? ' is-small' : ''}${shown && !card.color ? ` shows-${shown}` : ''}`}>
      <span className="zcard__corner">{sym}</span>
      <span className="zcard__mid">{sym}</span>
      <span className="zcard__corner zcard__corner--end">{sym}</span>
    </span>
  );
}

export function ZerouScreen(props: GameScreenProps) {
  const view = asZerouView(props.view);
  const t = useGameText(ZEROU_TEXT);
  const reason = useReason(t);
  const [rules, setRules] = useState(false);
  const [wild, setWild] = useState<number | null>(null);
  const [armed, setArmed] = useState(false);
  const { lobby, awaiting, onIntent } = props;
  const over = view.winner !== null;
  const myTurn = !over && view.current === view.me;
  const me = view.players[view.me]!;
  useZerouSounds(view);

  // Arming Última! only lasts for the turn it was pressed in.
  useEffect(() => setArmed(false), [view.current, view.hand.length]);

  function play(card: Card) {
    if (!myTurn || awaiting || !view.playable.includes(card.id)) return;
    if (card.color === null) return setWild(card.id);
    onIntent({ type: 'play', card: card.id, last: armed });
  }

  // Seats around the table, starting after me, in play order.
  const others = view.players.map((p, i) => ({ p, i })).filter(x => x.i !== view.me);
  others.sort((a, b) => ((a.i - view.me + view.players.length) % view.players.length) - ((b.i - view.me + view.players.length) % view.players.length));

  return (
    <GameFrame
      title={useLang().tr.t('gameZerouName')}
      code={props.code}
      clock={over ? null : props.clock}
      error={props.error}
      reason={reason}
      onDismissError={props.onDismissError}
      onEndGame={over ? undefined : props.onEndGame}
      onRules={() => setRules(true)}
      className="zerou"
    >
      <div className="zerou__table">
        <div className="zerou__others">
          {others.map(({ p, i }) => (
            <div key={p.id} className={`zerou__opp${view.current === i && !over ? ' is-turn' : ''}${view.winner === i ? ' is-winner' : ''}`}>
              <Avatar name={p.name} color={playerColor(lobby, p.id)} />
              <div>
                <b>{p.name}</b>
                <span className="muted">{p.cards === 1 ? t('one') : t('cards', { n: p.cards })}</span>
              </div>
              <span className="zerou__backs" aria-hidden="true">
                {Array.from({ length: Math.min(p.cards, 10) }, (_, k) => (
                  <i key={k} />
                ))}
              </span>
              {p.called && p.cards === 1 && <span className="pill pill--gold">{t('last')}</span>}
              {view.exposed === i && (
                <button type="button" className="danger-fill zerou__catch" disabled={awaiting} onClick={() => onIntent({ type: 'catch', target: i })}>
                  {t('catch', { name: p.name, n: CATCH_PENALTY })}
                </button>
              )}
            </div>
          ))}
        </div>

        <div className={`zerou__center is-${view.color}`}>
          <button type="button" className="zerou__pile" disabled={!myTurn || view.drawn !== null || awaiting} onClick={() => onIntent({ type: 'draw' })}>
            <span className="zcard zcard--back" aria-hidden="true">
              <span className="zcard__mid">Z!</span>
            </span>
            <span>{t('draw')}</span>
            <span className="muted">{t('pile', { n: view.drawPile })}</span>
          </button>
          <div className="zerou__discard" key={view.top.id}>
            <CardFace card={view.top} color={view.color} />
          </div>
          <div className="zerou__info">
            <span className={`zerou__colordot is-${view.color}`} title={t(`color_${view.color}`)} />
            <b>{t(`color_${view.color}`)}</b>
            <span className="muted">
              {t('direction')} {view.dir === 1 ? '↻' : '↺'}
            </span>
          </div>
        </div>

        <p className={`zerou__status${myTurn ? ' is-mine' : ''}`}>
          {over ? t('win', { name: view.players[view.winner!]!.name }) : myTurn ? t('yourTurn') : t('theirTurn', { name: view.players[view.current]!.name })}
          {myTurn && view.drawn !== null && <span className="muted"> · {t('drewPlayable')}</span>}
          {view.exposed !== null && view.exposed !== view.me && <span className="muted"> · {t('forgot', { name: view.players[view.exposed]!.name })}</span>}
        </p>

        {over ? (
          <EndActions isHost={props.isHost} onPlayAgain={props.onPlayAgain} onBackToLobby={props.onBackToLobby} onLeave={props.onLeave} playAgain={t('playAgain')} />
        ) : (
          <div className="actions actions--center zerou__actions">
            {myTurn && view.drawn !== null && (
              <button type="button" disabled={awaiting} onClick={() => onIntent({ type: 'pass' })}>
                {t('pass')}
              </button>
            )}
            {((myTurn && view.hand.length === 2) || view.exposed === view.me) && (
              <button
                type="button"
                className={`zerou__last${armed ? ' is-armed' : ''}`}
                disabled={awaiting}
                title={t('lastHint')}
                onClick={() => (view.exposed === view.me ? onIntent({ type: 'last' }) : setArmed(!armed))}
              >
                📣 {armed ? t('lastArmed') : t('last')}
              </button>
            )}
          </div>
        )}

        <div className={`zerou__hand${myTurn ? ' is-mine' : ''}`} style={{ ['--n' as string]: view.hand.length }}>
          {view.hand.map(card => {
            const can = view.playable.includes(card.id);
            return (
              <button
                key={card.id}
                type="button"
                className={`zerou__card${can ? ' is-playable' : ''}${view.drawn === card.id ? ' is-drawn' : ''}`}
                disabled={!can || awaiting}
                onClick={() => play(card)}
                aria-label={cardName(card, t)}
              >
                <CardFace card={card} />
              </button>
            );
          })}
        </div>
        <p className="muted zerou__me">
          {me.name} · {view.hand.length === 1 ? t('one') : t('cards', { n: view.hand.length })}
        </p>

        <ol className="zerou__log">
          {view.log.slice(-6).reverse().map((e, i) => (
            <li key={i}>{logLine(e, view, t)}</li>
          ))}
        </ol>
      </div>

      {wild !== null && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label={t('pickColor')} onClick={() => setWild(null)}>
          <div className="panel zerou__picker" onClick={e => e.stopPropagation()}>
            <h2>{t('pickColor')}</h2>
            <div>
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`zerou__pick is-${c}`}
                  onClick={() => {
                    onIntent({ type: 'play', card: wild, color: c, last: armed });
                    setWild(null);
                  }}
                >
                  {t(`color_${c}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {rules && <RulesSheet title={t('rulesTitle')} paragraphs={ZEROU_RULES.map(k => t(k))} onClose={() => setRules(false)} />}
    </GameFrame>
  );
}

function logLine(e: ZerouLog, view: ZerouView, t: TextFn): string {
  const name = view.players[e.seat]?.name ?? '—';
  switch (e.k) {
    case 'play':
      return e.color ? t('log_wild', { name, card: cardName(e.card, t), color: t(`color_${e.color}`).toLowerCase() }) : t('log_play', { name, card: cardName(e.card, t) });
    case 'draw':
      return t('log_draw', { name, n: e.n });
    case 'pass':
      return t('log_pass', { name });
    case 'last':
      return t('log_last', { name });
    case 'caught':
      return t('log_caught', { name, by: view.players[e.by]?.name ?? '—' });
    case 'win':
      return t('log_win', { name });
  }
}

function useZerouSounds(view: ZerouView) {
  const seen = useRef(view.logTotal);
  useEffect(() => {
    const added = view.logTotal - seen.current;
    seen.current = view.logTotal;
    if (added <= 0) return;
    const fresh = view.log.slice(-Math.min(added, view.log.length));
    if (fresh.some(e => e.k === 'win')) return playSound(view.winner === view.me ? 'win' : 'lose');
    if (fresh.some(e => e.k === 'caught' || e.k === 'last')) return playSound('alert');
    if (fresh.some(e => e.k === 'draw' && e.forced)) return playSound('wrong');
    playSound('card');
  }, [view.logTotal]);
}
