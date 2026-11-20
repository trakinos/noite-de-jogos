import { useEffect, useRef, useState } from 'react';
import { useLang } from '../../i18n/LangProvider';
import { Avatar } from '../../ui/components/Avatar';
import { playerColor } from '../../ui/playerColor';
import { EndActions, GameFrame, RulesSheet, useGameText, useReason, type GameScreenProps, type Texts, type TextFn } from '../shared/GameFrame';
import { playSound } from '../shared/sound';
import {
  ACCUSE_PENALTY, asZerouView, BAD_LAST_PENALTY, COLORS, FALSE_ACCUSE_PENALTY, HAND, RACE_MS, RACE_PENALTY, type Card, type Color, type ZerouLog, type ZerouView,
} from './game';

export const ZEROU_RULES = ['rules1', 'rules2', 'rulesSwap', 'rulesPairs', 'rulesCut', 'rulesNine', 'rules3', 'rules4'];

export const ZEROU_TEXT: Texts = {
  pt: {
    rulesTitle: 'Regras do Zerou!',
    rules1: `Cada um recebe ${HAND} cartas. Na sua vez, jogue uma carta da mesma cor ou do mesmo número/símbolo da carta de cima. Sem jogada (ou se preferir), compre: você compra até vir uma carta que sirva, e pode jogá-la na hora ou passar.`,
    rules2: 'Cartas especiais. Pula: o próximo perde a vez. Inverte: troca o sentido (com dois jogadores, funciona como Pula). +2: o próximo compra 2 e perde a vez, a não ser que responda com outro +2, e a compra soma e passa adiante. Coringa: você escolhe a cor. Coringa +4: escolhe a cor e o próximo compra 4 e perde a vez, mas só vale se você não tiver nenhuma carta da cor atual; ele também pode ser respondido com outro +4, mesmo tendo a cor.',
    rulesSwap: 'Troca-Troca: escolha a cor e um jogador, e vocês trocam a mão inteira. Quem recebe uma mão de uma carta só não precisa dizer Última!. Se for a sua última carta, você simplesmente zera.',
    rulesPairs: 'Pares: tendo duas ou mais cartas do mesmo número ou símbolo, mesmo de cores diferentes, você pode jogá-las juntas, desde que a primeira sirva na mesa. Toque nelas na ordem e aperte Jogar: a última fica por cima e define a cor. Os efeitos somam: dois +2 fazem o próximo comprar 4, dois Pula pulam dois jogadores, dois Inverte se anulam. Coringas e Troca-Troca não fazem par, e depois de comprar só vale a carta comprada.',
    rulesCut: 'Corte: quem tiver uma carta idêntica à de cima (mesma cor e mesmo número ou símbolo) pode jogá-la fora da vez, desde que o jogador da vez ainda não tenha jogado nem comprado. O efeito da carta vale normalmente e o jogo segue a partir de quem cortou. Compras já feitas não voltam. Coringas não cortam.',
    rulesNine: `Corrida do 9: quando sai um 9, o jogo para e todo mundo, inclusive quem jogou, tem que tocar na carta da mesa. O último a tocar compra ${RACE_PENALTY} (por 9 jogado). Depois de ${RACE_MS / 1000} segundos, todos os que não tocaram compram.`,
    rules3: `Ao ficar com uma carta, aperte Última! (antes de jogar a penúltima, ou depois, enquanto ninguém acusar). O botão pode ser apertado a qualquer hora, mas se você apertar e jogar sem ficar com exatamente uma carta, compra ${BAD_LAST_PENALTY}. Nada acontece sozinho: qualquer um pode acusar qualquer adversário, a qualquer momento. Se o acusado estiver com uma carta só e não tiver dito Última!, ele compra ${ACCUSE_PENALTY}, e isso vale enquanto ele continuar com essa carta sem avisar. Se a acusação for errada, quem acusou compra ${FALSE_ACCUSE_PENALTY}.`,
    rules4: 'Vence quem zerar a mão primeiro. Com o relógio ligado, quem deixa o tempo acabar compra uma carta e passa.',
    yourTurn: 'Sua vez',
    theirTurn: 'Vez de {name}',
    draw: 'Comprar',
    pass: 'Passar',
    drewPlayable: 'A carta comprada serve: jogue-a ou passe.',
    stackHint: 'Responda com {kind} ou compre {n}.',
    drawN: 'Comprar {n}',
    nextUp: 'Próximo: {name}',
    nextYou: 'Próximo: você',
    last: 'Última!',
    lastArmed: 'Última! marcada',
    lastHint: 'Aperte antes de jogar a penúltima carta.',
    accuse: 'Acusar',
    accuseHint: 'Acusar {name} de não ter dito Última!: se estiver certo, {name} compra {n}; se não, você compra {m}.',
    play: 'Jogar {n} cartas',
    playOne: 'Jogar só esta',
    cancel: 'Cancelar',
    selectHint: 'Toque nas cartas iguais para jogar junto; toque numa escolhida para desmarcar.',
    cutHint: 'Você tem a carta idêntica: toque nela para cortar!',
    raceTap: 'Corrida do 9! Toque na carta da mesa!',
    raceWait: 'Você tocou! Esperando os outros…',
    raceTapped: 'Tocou',
    tapCard: 'Tocar na carta',
    pickPlayer: 'Trocar de mão com quem?',
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
    log_cut: '{name} cortou com {card}',
    log_accuse: '{by} acusou {name}, que não disse Última!: {name} comprou {n}',
    log_accuseWrong: '{by} acusou {name} à toa e comprou {n}',
    log_swap: '{name} trocou de mão com {other}',
    log_race: 'Corrida do 9!',
    log_slow: '{name} demorou no 9 e comprou {n}',
    log_win: '{name} zerou a mão!',
    log_badlast: '{name} apertou Última! sem ficar com uma carta e comprou {n}',
    v_skip: 'Pula',
    v_rev: 'Inverte',
    v_draw2: '+2',
    v_wild: 'Coringa',
    v_wild4: 'Coringa +4',
    v_swap: 'Troca-Troca',
    playAgain: 'Jogar de novo',
    'reason:Not your turn': 'Não é a sua vez.',
    'reason:That card does not match': 'Essa carta não combina com a de cima.',
    'reason:Coringa +4 only without the current color': 'O Coringa +4 só vale sem cartas da cor atual.',
    'reason:You can only play the card you drew': 'Agora só dá para jogar a carta comprada.',
    'reason:Draw a card first': 'Compre uma carta antes de passar.',
    'reason:Nobody to accuse': 'Não há ninguém para acusar.',
    'reason:Too late to cut in': 'Tarde demais para cortar: o jogador da vez já comprou.',
    'reason:Tap the 9 first': 'Corrida do 9: toque na carta da mesa primeiro.',
    'reason:Pick a player': 'Escolha com quem trocar de mão.',
    'reason:Pick a color': 'Escolha a cor.',
    'reason:Answer with the same kind of card, or draw': 'Responda com a mesma carta (+2 ou +4) ou compre.',
    'reason:Only cards of the same number go together': 'Só cartas do mesmo número ou símbolo vão juntas (coringas não).',
  },
  en: {
    rulesTitle: 'Zerou! rules',
    rules1: `Everyone gets ${HAND} cards. On your turn, play a card matching the top card's color or number/symbol. With nothing to play (or if you'd rather), draw: you keep drawing until a card fits, and may play it at once or pass.`,
    rules2: 'Special cards. Skip: the next player loses their turn. Reverse: switches direction (with two players it works as Skip). +2: the next player draws 2 and loses their turn, unless they answer with another +2, which adds up and moves on. Wild: you pick the color. Wild +4: pick the color, and the next player draws 4 and loses their turn, but only when you have no card of the current color; it can also be answered with another +4, even holding the color.',
    rulesSwap: "Hand Swap (Troca-Troca): pick the color and a player, and the two of you swap whole hands. Whoever receives a one-card hand doesn't need to call Última!. As your last card it simply wins.",
    rulesPairs: 'Pairs: holding two or more cards of the same number or symbol, even in different colors, you may play them together as long as the first one fits the pile. Tap them in order and press Play: the last one ends up on top and sets the color. Effects add up: two +2s make the next player draw 4, two Skips skip two players, two Reverses cancel out. Wilds and Hand Swaps never pair, and after drawing only the drawn card can be played.',
    rulesCut: "Cutting in: if you hold a card identical to the top card (same color and same number or symbol) you may play it out of turn, as long as the current player hasn't played or drawn yet. The card's effect applies as usual and play continues from whoever cut in. Cards already drawn stay drawn. Wilds can't cut in.",
    rulesNine: `The 9 race: when a 9 is played the game stops and everyone, including whoever played it, has to tap the card on the table. The last to tap draws ${RACE_PENALTY} (per 9 played). After ${RACE_MS / 1000} seconds, everyone who hasn't tapped draws.`,
    rules3: `When you get down to one card, press Última! (before playing your second-to-last card, or later, while nobody has accused you). The button can be pressed any time, but if you press it and play without being left with exactly one card, you draw ${BAD_LAST_PENALTY}. Nothing happens by itself: anyone can accuse any opponent at any time. If the accused holds exactly one card and hasn't called Última!, they draw ${ACCUSE_PENALTY}, and that stays true for as long as they hold that card uncalled. If the accusation is wrong, the accuser draws ${FALSE_ACCUSE_PENALTY}.`,
    rules4: 'First to empty their hand wins. With the timer on, running out of time draws a card and passes.',
    yourTurn: 'Your turn',
    theirTurn: "{name}'s turn",
    draw: 'Draw',
    pass: 'Pass',
    drewPlayable: 'The card you drew fits: play it or pass.',
    stackHint: 'Answer with {kind} or draw {n}.',
    drawN: 'Draw {n}',
    nextUp: 'Next: {name}',
    nextYou: 'Next: you',
    last: 'Última!',
    lastArmed: 'Última! called',
    lastHint: 'Press before playing your second-to-last card.',
    accuse: 'Accuse',
    accuseHint: 'Accuse {name} of not calling Última!: if you are right, {name} draws {n}; if not, you draw {m}.',
    play: 'Play {n} cards',
    playOne: 'Play just this one',
    cancel: 'Cancel',
    selectHint: 'Tap matching cards to play them together; tap a chosen one to unselect it.',
    cutHint: 'You hold the identical card: tap it to cut in!',
    raceTap: 'The 9 race! Tap the card on the table!',
    raceWait: 'You tapped! Waiting for the others…',
    raceTapped: 'Tapped',
    tapCard: 'Tap the card',
    pickPlayer: 'Swap hands with whom?',
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
    log_cut: '{name} cut in with {card}',
    log_accuse: "{by} accused {name}, who hadn't called Última!: {name} drew {n}",
    log_accuseWrong: '{by} wrongly accused {name} and drew {n}',
    log_swap: '{name} swapped hands with {other}',
    log_race: 'The 9 race!',
    log_slow: '{name} was slow on the 9 and drew {n}',
    log_win: '{name} emptied their hand!',
    log_badlast: '{name} pressed Última! without being left with one card and drew {n}',
    v_skip: 'Skip',
    v_rev: 'Reverse',
    v_draw2: '+2',
    v_wild: 'Wild',
    v_wild4: 'Wild +4',
    v_swap: 'Hand Swap',
    playAgain: 'Play again',
    'reason:Not your turn': "It's not your turn.",
    'reason:That card does not match': "That card doesn't match the top card.",
    'reason:Coringa +4 only without the current color': 'Wild +4 only when you have none of the current color.',
    'reason:You can only play the card you drew': 'You can only play the card you drew now.',
    'reason:Draw a card first': 'Draw a card before passing.',
    'reason:Nobody to accuse': 'There is nobody to accuse.',
    'reason:Too late to cut in': 'Too late to cut in: the current player has already drawn.',
    'reason:Tap the 9 first': 'The 9 race: tap the card on the table first.',
    'reason:Pick a player': 'Pick who to swap hands with.',
    'reason:Pick a color': 'Pick a color.',
    'reason:Answer with the same kind of card, or draw': 'Answer with the same card (+2 or +4), or draw.',
    'reason:Only cards of the same number go together': 'Only cards of the same number or symbol go together (no wilds).',
  },
};

const SYMBOL: Partial<Record<Card['value'], string>> = { skip: '⊘', rev: '⇄', draw2: '+2', wild: '★', wild4: '+4', swap: '🤝' };

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

/** Colored cards of the same number or symbol can go down together. */
function pairs(a: Card, b: Card): boolean {
  return a.color !== null && b.color !== null && a.value === b.value;
}

export function ZerouScreen(props: GameScreenProps) {
  const view = asZerouView(props.view);
  const t = useGameText(ZEROU_TEXT);
  const reason = useReason(t);
  const [rules, setRules] = useState(false);
  /** Cards picked to go down together, in order. */
  const [sel, setSel] = useState<number[]>([]);
  /** A Coringa or Troca-Troca waiting for its color (and player). */
  const [picker, setPicker] = useState<{ card: number; needsTarget: boolean; target: number | null } | null>(null);
  const [armed, setArmed] = useState(false);
  const { lobby, awaiting, onIntent } = props;
  const over = view.winner !== null;
  const race = over ? null : view.race;
  const myTurn = !over && !race && view.current === view.me;
  const me = view.players[view.me]!;
  const byId = new Map(view.hand.map(c => [c.id, c]));
  const picked = sel.map(id => byId.get(id)).filter((c): c is Card => c !== undefined);
  const first = picked[0];
  useZerouSounds(view);
  const fx = useZerouFx(view);
  useRaceTimeout(view, onIntent);

  // Arming Última! and picking cards only last for the turn they were made in.
  useEffect(() => {
    setArmed(false);
    setSel([]);
    setPicker(null);
  }, [view.current, view.hand.length, race?.id]);

  // Seats around the table, starting after me, in play order.
  const others = view.players.map((p, i) => ({ p, i })).filter(x => x.i !== view.me);
  others.sort((a, b) => ((a.i - view.me + view.players.length) % view.players.length) - ((b.i - view.me + view.players.length) % view.players.length));

  function send(ids: number[]) {
    const card = byId.get(ids[0]!);
    if (!card) return;
    setSel([]);
    if (card.color === null) {
      // The Troca-Troca as a last card just wins: nobody to pick.
      const needsTarget = card.value === 'swap' && view.hand.length > 1;
      return setPicker({ card: card.id, needsTarget, target: needsTarget && others.length === 1 ? others[0]!.i : null });
    }
    onIntent({ type: 'play', cards: ids, last: armed });
  }

  function tap(card: Card) {
    if (awaiting || over || race) return;
    if (!myTurn) {
      if (view.cut.includes(card.id)) onIntent({ type: 'play', card: card.id, last: armed });
      return;
    }
    if (first) {
      // Tapping a chosen card again unselects it; a matching card joins the selection.
      if (sel.includes(card.id)) return setSel(sel.filter(id => id !== card.id));
      if (pairs(first, card)) return setSel([...sel, card.id]);
    }
    if (!view.playable.includes(card.id)) return;
    const hasMate = view.drawn === null && view.hand.some(c => c.id !== card.id && pairs(card, c));
    if (hasMate) setSel([card.id]);
    else send([card.id]);
  }

  const tappable = (card: Card) =>
    myTurn ? view.playable.includes(card.id) || (first !== undefined && (sel.includes(card.id) || pairs(first, card))) : view.cut.includes(card.id);
  const canCall = !over && view.hand.length === 1 && !me.called;
  const nextSeat = (view.current + view.dir + view.players.length) % view.players.length;

  return (
    <GameFrame
      title={useLang().tr.t('gameZerouName')}
      code={props.code}
      clock={over || race ? null : props.clock}
      error={props.error}
      reason={reason}
      onDismissError={props.onDismissError}
      onEndGame={over ? undefined : props.onEndGame}
      onRules={() => setRules(true)}
      className="zerou"
    >
      <div className={`zerou__table${myTurn ? ' is-myturn' : ''}`}>
        <div className="zerou__others">
          {others.map(({ p, i }) => (
            <div key={p.id} className={`zerou__opp${view.current === i && !over && !race ? ' is-turn' : ''}${view.winner === i ? ' is-winner' : ''}`}>
              {fx.draws[i] !== undefined && (
                <span key={fx.drawKey} className="zerou__drewfx" aria-hidden="true">
                  <span className="zerou__drewcards">
                    {Array.from({ length: Math.min(fx.draws[i]!, 8) }, (_, k) => (
                      <i key={k} className="zerou__drewcard" style={{ ['--i' as string]: k }} />
                    ))}
                  </span>
                  <b>+{fx.draws[i]}</b>
                </span>
              )}
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
              {race && race.tapped[i] && <span className="pill zerou__tapped">✓ {t('raceTapped')}</span>}
              {!over && (
                <button
                  type="button"
                  className="zerou__accuse"
                  disabled={awaiting}
                  title={t('accuseHint', { name: p.name, n: ACCUSE_PENALTY, m: FALSE_ACCUSE_PENALTY })}
                  onClick={() => onIntent({ type: 'accuse', target: i })}
                >
                  ☝ {t('accuse')}
                </button>
              )}
            </div>
          ))}
        </div>

        <div className={`zerou__center is-${view.color}${race ? ' is-race' : ''}`}>
          <button type="button" key={`pile${fx.drawKey}`} className={`zerou__pile${fx.drawKey > 0 ? ' is-drawing' : ''}`} disabled={!myTurn || view.drawn !== null || awaiting} onClick={() => onIntent({ type: 'draw' })}>
            <span className="zcard zcard--back" aria-hidden="true">
              <span className="zcard__mid">Z!</span>
            </span>
            <span>{view.pending && myTurn ? t('drawN', { n: view.pending.n }) : t('draw')}</span>
            <span className="muted">{t('pile', { n: view.drawPile })}</span>
          </button>
          {race ? (
            <button
              type="button"
              key={`race${race.id}`}
              className={`zerou__discard zerou__racecard${race.tapped[view.me] ? ' is-tapped' : ''}`}
              disabled={race.tapped[view.me] || awaiting}
              onClick={() => onIntent({ type: 'tap' })}
              aria-label={t('tapCard')}
            >
              <CardFace card={view.top} color={view.color} />
              <span className="zerou__racebar" aria-hidden="true">
                <i style={{ animationDuration: `${race.total}ms`, animationDelay: `${race.left - race.total}ms` }} />
              </span>
            </button>
          ) : (
            <div className="zerou__discard" key={view.top.id}>
              {fx.flight && fx.flight.cards.length === 1 ? (
                <span className={`zerou__top ${fx.flight.cards[0]!.seat === view.me ? 'is-mine' : 'is-theirs'}`}>
                  <CardFace card={view.top} color={view.color} />
                </span>
              ) : (
                <CardFace card={view.top} color={view.color} />
              )}
              {fx.flight && fx.flight.cards.length > 1 && (
                <div className="zerou__flight" key={fx.flight.key} aria-hidden="true">
                  {fx.flight.cards.map((f, i) => (
                    <span
                      key={i}
                      className={`zerou__flying${f.seat === view.me ? ' is-mine' : ''}`}
                      style={{ ['--i' as string]: i, ['--of' as string]: fx.flight!.cards.length - 1 }}
                    >
                      <CardFace card={f.card} color={f.color} />
                    </span>
                  ))}
                  <b className="zerou__flightname">{view.players[fx.flight.cards[0]!.seat]?.name}</b>
                </div>
              )}
            </div>
          )}
          <div className="zerou__info">
            <span className={`zerou__colordot is-${view.color}`} title={t(`color_${view.color}`)} />
            <b>{t(`color_${view.color}`)}</b>
            <span className="muted">
              {t('direction')} {view.dir === 1 ? '↻' : '↺'}
            </span>
            {!over && !race && (
              <span className="zerou__next">{nextSeat === view.me ? t('nextYou') : t('nextUp', { name: view.players[nextSeat]!.name })}</span>
            )}
          </div>
        </div>

        <p className={`zerou__status${myTurn || (race && !race.tapped[view.me]) ? ' is-mine' : ''}`} role="status">
          {over
            ? t('win', { name: view.players[view.winner!]!.name })
            : race
              ? t(race.tapped[view.me] ? 'raceWait' : 'raceTap')
              : myTurn
                ? t('yourTurn')
                : t('theirTurn', { name: view.players[view.current]!.name })}
          {myTurn && view.pending && <span className="muted"> · {t('stackHint', { kind: t(`v_${view.pending.kind}`), n: view.pending.n })}</span>}
          {myTurn && view.drawn !== null && <span className="muted"> · {t('drewPlayable')}</span>}
          {myTurn && sel.length > 0 && <span className="muted"> · {t('selectHint')}</span>}
          {!myTurn && !race && !over && view.cut.length > 0 && <span className="zerou__cuthint"> · {t('cutHint')}</span>}
        </p>

        {over ? (
          <EndActions isHost={props.isHost} onPlayAgain={props.onPlayAgain} onBackToLobby={props.onBackToLobby} onLeave={props.onLeave} playAgain={t('playAgain')} />
        ) : (
          <div className="actions actions--center zerou__actions">
            {myTurn && sel.length > 0 && (
              <>
                <button type="button" className="primary" disabled={awaiting} onClick={() => send(sel)}>
                  {sel.length === 1 ? t('playOne') : t('play', { n: sel.length })}
                </button>
                <button type="button" className="ghost" onClick={() => setSel([])}>
                  {t('cancel')}
                </button>
              </>
            )}
            {myTurn && view.pending && <span className="muted"> · {t('stackHint', { kind: t(`v_${view.pending.kind}`), n: view.pending.n })}</span>}
          {myTurn && view.drawn !== null && (
              <button type="button" disabled={awaiting} onClick={() => onIntent({ type: 'pass' })}>
                {t('pass')}
              </button>
            )}
            <button
              type="button"
              className={`zerou__last${armed ? ' is-armed' : ''}${me.called && view.hand.length === 1 ? ' is-armed' : ''}`}
              disabled={awaiting && canCall}
              title={t('lastHint')}
              onClick={() => (canCall ? onIntent({ type: 'last' }) : setArmed(!armed))}
            >
              📣 {armed || (me.called && view.hand.length === 1) ? t('lastArmed') : t('last')}
            </button>
          </div>
        )}

        <div className={`zerou__hand${myTurn || view.cut.length > 0 ? ' is-mine' : ''}`} style={{ ['--n' as string]: view.hand.length }}>
          {view.hand.map(card => {
            const can = !over && !race && tappable(card);
            const order = sel.indexOf(card.id);
            return (
              <button
                key={card.id}
                type="button"
                className={`zerou__card${fx.fresh.has(card.id) ? ' is-new' : ''}${can ? ' is-playable' : ''}${view.drawn === card.id ? ' is-drawn' : ''}${order >= 0 ? ' is-picked' : ''}${!myTurn && can ? ' is-cut' : ''}`}
                disabled={!can || awaiting}
                style={fx.fresh.has(card.id) ? { ['--k' as string]: [...fx.fresh].indexOf(card.id) } : undefined}
                onClick={() => tap(card)}
                aria-label={cardName(card, t)}
                aria-pressed={order >= 0}
              >
                <CardFace card={card} />
                {order >= 0 && sel.length > 1 && <span className="zerou__order">{order + 1}</span>}
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

      {picker !== null && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label={t(picker.needsTarget && picker.target === null ? 'pickPlayer' : 'pickColor')} onClick={() => setPicker(null)}>
          <div className="panel zerou__picker" onClick={e => e.stopPropagation()}>
            {picker.needsTarget && picker.target === null ? (
              <>
                <h2>{t('pickPlayer')}</h2>
                <div className="zerou__targets">
                  {others.map(({ p, i }) => (
                    <button key={p.id} type="button" onClick={() => setPicker({ ...picker, target: i })}>
                      <Avatar name={p.name} color={playerColor(lobby, p.id)} />
                      <b>{p.name}</b>
                      <span className="muted">{p.cards === 1 ? t('one') : t('cards', { n: p.cards })}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <h2>{t('pickColor')}</h2>
                <div>
                  {COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      className={`zerou__pick is-${c}`}
                      onClick={() => {
                        onIntent({ type: 'play', card: picker.card, color: c, last: armed, ...(picker.target === null ? {} : { target: picker.target }) });
                        setPicker(null);
                      }}
                    >
                      {t(`color_${c}`)}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {rules && <RulesSheet game="zerou" title={t('rulesTitle')} paragraphs={ZEROU_RULES.map(k => t(k))} onClose={() => setRules(false)} />}
    </GameFrame>
  );
}

function logLine(e: ZerouLog, view: ZerouView, t: TextFn): string {
  const name = view.players[e.seat]?.name ?? '—';
  switch (e.k) {
    case 'play':
      if (e.cut) return t('log_cut', { name, card: cardName(e.card, t) });
      return e.color ? t('log_wild', { name, card: cardName(e.card, t), color: t(`color_${e.color}`).toLowerCase() }) : t('log_play', { name, card: cardName(e.card, t) });
    case 'draw':
      return t('log_draw', { name, n: e.n });
    case 'pass':
      return t('log_pass', { name });
    case 'last':
      return t('log_last', { name });
    case 'accuse':
      return t(e.right ? 'log_accuse' : 'log_accuseWrong', { name, by: view.players[e.by]?.name ?? '—', n: e.n });
    case 'swap':
      return t('log_swap', { name, other: view.players[e.with]?.name ?? '—' });
    case 'race':
      return t('log_race');
    case 'slow':
      return t('log_slow', { name, n: e.n });
    case 'win':
      return t('log_win', { name });
    case 'badlast':
      return t('log_badlast', { name, n: e.n });
  }
}

interface Flight {
  key: number;
  cards: { card: Card; seat: number; color?: Color }[];
}

/** Short-lived effects built from the newest log entries: the cards just played, who drew, and which of my cards are new. */
function useZerouFx(view: ZerouView) {
  const seen = useRef(view.logTotal);
  const prevHand = useRef(new Set(view.hand.map(c => c.id)));
  const [flight, setFlight] = useState<Flight | null>(null);
  const [draws, setDraws] = useState<Record<number, number>>({});
  const [drawKey, setDrawKey] = useState(0);
  const [fresh, setFresh] = useState<Set<number>>(new Set());

  useEffect(() => {
    const added = view.logTotal - seen.current;
    seen.current = view.logTotal;
    if (added <= 0) return;
    const entries = view.log.slice(-Math.min(added, view.log.length));
    const plays = entries.filter((e): e is Extract<ZerouLog, { k: 'play' }> => e.k === 'play');
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (plays.length > 0) {
      setFlight({ key: view.logTotal, cards: plays.map(e => ({ card: e.card, seat: e.seat, ...(e.color ? { color: e.color } : {}) })) });
      timer = setTimeout(() => setFlight(null), 450 + plays.length * 350);
    }
    const drew: Record<number, number> = {};
    for (const e of entries) if (e.k === 'draw' || (e.k === 'slow') || (e.k === 'accuse') || e.k === 'badlast') {
      const seat = e.k === 'accuse' ? (e.right ? e.seat : e.by) : e.seat;
      drew[seat] = (drew[seat] ?? 0) + e.n;
    }
    let timer2: ReturnType<typeof setTimeout> | undefined;
    if (Object.keys(drew).length > 0) {
      setDraws(drew);
      setDrawKey(k => k + 1);
      timer2 = setTimeout(() => setDraws({}), 900 + Math.min(Math.max(...Object.values(drew)), 8) * 260);
    }
    return () => {
      clearTimeout(timer);
      clearTimeout(timer2);
    };
  }, [view.logTotal]);

  useEffect(() => {
    const now = new Set(view.hand.map(c => c.id));
    const added = [...now].filter(id => !prevHand.current.has(id));
    prevHand.current = now;
    if (added.length === 0 || added.length === now.size) return;
    setFresh(new Set(added));
    const timer = setTimeout(() => setFresh(new Set()), 600 + added.length * 260);
    return () => clearTimeout(timer);
  }, [view.hand.map(c => c.id).join(',')]);

  return { flight, draws, drawKey, fresh };
}

function useZerouSounds(view: ZerouView) {
  const seen = useRef(view.logTotal);
  useEffect(() => {
    const added = view.logTotal - seen.current;
    seen.current = view.logTotal;
    if (added <= 0) return;
    const fresh = view.log.slice(-Math.min(added, view.log.length));
    if (fresh.some(e => e.k === 'win')) return playSound(view.winner === view.me ? 'win' : 'lose');
    // The 9 race has to be noticed by everyone, whatever else happened.
    if (fresh.some(e => e.k === 'race')) return playSound('alert');
    if (fresh.some(e => e.k === 'slow' || e.k === 'badlast' || (e.k === 'draw' && e.forced))) return playSound('wrong');
    if (fresh.some(e => e.k === 'accuse' || e.k === 'last')) return playSound('alert');
    if (fresh.some(e => e.k === 'swap')) return playSound('spin');
    // Playing snaps a card down; drawing (by choice) slides one off the pile.
    if (fresh.some(e => e.k === 'draw') && !fresh.some(e => e.k === 'play')) return playSound('draw');
    playSound('card');
  }, [view.logTotal]);
}

/** Every screen tells the host when the race's time is up, so it ends even without a turn timer; the host checks its own clock. */
function useRaceTimeout(view: ZerouView, onIntent: (intent: unknown) => void) {
  const send = useRef(onIntent);
  send.current = onIntent;
  const raceId = view.winner === null ? view.race?.id : undefined;
  useEffect(() => {
    if (raceId === undefined || !view.race) return;
    let timer: ReturnType<typeof setTimeout>;
    // Asks again in case the first one was lost or arrived a moment early.
    const ask = () => {
      send.current({ type: 'raceEnd' });
      timer = setTimeout(ask, 1500);
    };
    timer = setTimeout(ask, view.race.left + 250);
    return () => clearTimeout(timer);
  }, [raceId]);
}
