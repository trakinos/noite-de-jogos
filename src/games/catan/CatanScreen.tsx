import { useEffect, useRef, useState } from 'react';
import { useLang } from '../../i18n/LangProvider';
import { Avatar } from '../../ui/components/Avatar';
import { playerColor } from '../../ui/playerColor';
import { EndActions, GameFrame, RulesSheet, useGameText, useReason, type GameScreenProps, type Texts, type TextFn } from '../shared/GameFrame';
import { SimpleLobby, type LobbyProps } from '../shared/SimpleLobby';
import { playSound } from '../shared/sound';
import { EDGE_VERTS, HEX_CENTERS, HEX_VERTS, RES, VERTEX_POS, pips, type Res } from './board';
import { asCatanView, COSTS, emptyHand, total, WIN_POINTS, type CatanLog, type CatanView, type Hand } from './game';

export const CATAN_RULES = ['rules1', 'rules2', 'rules3', 'rules4'];

export const CATAN_TEXT: Texts = {
  pt: {
    rulesTitle: 'Regras de Catan',
    rules1: 'Cada jogador começa com duas colônias e duas estradas na ilha. Os hexágonos produzem recursos quando sai o número do dado: cada colônia vizinha rende 1 carta, cada cidade rende 2.',
    rules2: 'No seu turno: role os dados, negocie (com os outros jogadores ou com o banco, 4 por 1, ou 3 por 1 / 2 por 1 com portos) e construa. Estrada: madeira + tijolo. Colônia: madeira + tijolo + lã + trigo. Cidade: 2 trigo + 3 minério. Carta de desenvolvimento: lã + trigo + minério.',
    rules3: 'Tirou 7: quem tem mais de 7 cartas descarta metade; depois você move o ladrão para outro hexágono (ele bloqueia a produção ali) e rouba uma carta de um vizinho. Cavaleiros movem o ladrão do mesmo jeito.',
    rules4: `Pontos: colônia 1, cidade 2, estrada mais longa (5 ou mais) 2, maior exército (3 ou mais cavaleiros) 2 e cartas de pontos de vitória 1 cada. Quem chegar a ${WIN_POINTS} pontos no seu turno vence. Colônias só podem ser construídas a pelo menos duas estradas de outra, e ligadas à sua rede.`,
    yourTurn: 'Sua vez',
    theirTurn: 'Vez de {name}',
    setupSettlement: 'Coloque uma colônia',
    setupRoad: 'Agora coloque uma estrada ao lado dela',
    roll: 'Jogar dados',
    end: 'Terminar turno',
    waitRoll: 'Aguardando {name} jogar os dados',
    moveRobber: 'Mova o ladrão para outro hexágono',
    stealFrom: 'Roube de quem?',
    discardTitle: 'Descarte {n} cartas',
    discardWait: 'Aguardando descartes…',
    discardBtn: 'Descartar',
    buildRoad: 'Estrada',
    buildSettlement: 'Colônia',
    buildCity: 'Cidade',
    buyDev: 'Comprar carta',
    trade: 'Negociar',
    freeRoads: 'Estrada grátis: coloque mais {n}',
    hand: 'Sua mão',
    cards: 'cartas',
    devHand: 'Cartas de desenvolvimento',
    devNew: 'nova',
    dev_knight: 'Cavaleiro',
    dev_vp: 'Ponto de vitória',
    dev_road: 'Construção de estradas',
    dev_plenty: 'Invenção',
    dev_monopoly: 'Monopólio',
    pickRes: 'Escolha o recurso',
    pickRes2: 'Escolha dois recursos',
    play: 'Jogar',
    res_wood: 'Madeira',
    res_brick: 'Tijolo',
    res_sheep: 'Lã',
    res_wheat: 'Trigo',
    res_ore: 'Minério',
    bankTrade: 'Banco',
    playerTrade: 'Jogadores',
    give: 'Você dá',
    get: 'Você recebe',
    ratio: '{n}:1',
    doBank: 'Trocar com o banco',
    offerBtn: 'Oferecer a todos',
    offerFrom: '{name} oferece',
    offerFor: 'por',
    accept: 'Aceitar',
    decline: 'Recusar',
    accepted: 'aceitou',
    declined: 'recusou',
    waiting: 'esperando',
    confirmWith: 'Trocar com {name}',
    cancelOffer: 'Cancelar oferta',
    close: 'Fechar',
    points: 'pontos',
    knights: 'cavaleiros',
    roadLen: 'estrada {n}',
    longest: 'Estrada mais longa',
    army: 'Maior exército',
    bank: 'Banco',
    deck: 'Baralho: {n}',
    win: '{name} venceu com {n} pontos!',
    playAgain: 'Jogar de novo',
    lastRoll: 'Dados',
    'log:roll': '{name} tirou {n}',
    'log:road': '{name} construiu uma estrada',
    'log:settlement': '{name} construiu uma colônia',
    'log:city': '{name} construiu uma cidade',
    'log:dev': '{name} comprou uma carta de desenvolvimento',
    'log:play_knight': '{name} jogou um Cavaleiro',
    'log:play_road': '{name} jogou Construção de estradas',
    'log:play_plenty': '{name} jogou Invenção',
    'log:play_monopoly': '{name} jogou Monopólio de {res}',
    'log:discard': '{name} descartou {n} cartas',
    'log:robber': '{name} moveu o ladrão',
    'log:steal': '{name} roubou uma carta de {from}',
    'log:bank': '{name} trocou {n} {give} por 1 {get} com o banco',
    'log:trade': '{name} negociou com {with}',
    'log:longest': '{name} ficou com a estrada mais longa',
    'log:longestNone': 'Ninguém tem a estrada mais longa',
    'log:army': '{name} ficou com o maior exército',
    'log:win': '{name} venceu!',
    'reason:Not your turn': 'Não é a sua vez.',
    'reason:Not now': 'Agora não.',
    'reason:You cannot build there': 'Não dá para construir aí.',
    'reason:Not enough resources': 'Faltam recursos.',
    'reason:You already rolled': 'Você já jogou os dados.',
    'reason:Place your road': 'Coloque a estrada primeiro.',
    'reason:Place a settlement first': 'Coloque a colônia primeiro.',
    'reason:Place your free roads first': 'Coloque as estradas grátis primeiro.',
    'reason:No cards left': 'Acabaram as cartas.',
    'reason:The bank is out of that': 'O banco ficou sem isso.',
    'reason:The robber must move': 'O ladrão precisa mudar de lugar.',
    'reason:Cannot steal from them': 'Não dá para roubar dessa pessoa.',
    'reason:You cannot play that': 'Você não pode jogar essa carta agora.',
    'reason:Bad discard': 'Descarte inválido.',
    'reason:Bad offer': 'Oferta inválida.',
    'reason:They have not accepted': 'Essa pessoa não aceitou.',
    'reason:No settlements left': 'Acabaram as colônias.',
    'reason:No roads left': 'Acabaram as estradas.',
    'reason:No cities left': 'Acabaram as cidades.',
  },
  en: {
    rulesTitle: 'Catan rules',
    rules1: 'Everyone starts with two settlements and two roads on the island. Hexes produce resources when their number is rolled: each adjacent settlement earns 1 card, each city 2.',
    rules2: 'On your turn: roll the dice, trade (with other players or the bank at 4 for 1, or 3 for 1 / 2 for 1 with harbors) and build. Road: wood + brick. Settlement: wood + brick + wool + grain. City: 2 grain + 3 ore. Development card: wool + grain + ore.',
    rules3: 'Roll a 7: anyone holding more than 7 cards discards half; then you move the robber to another hex (it blocks production there) and steal a card from a neighbor. Knights move the robber the same way.',
    rules4: `Points: settlement 1, city 2, longest road (5 or more) 2, largest army (3 or more knights) 2, and victory point cards 1 each. Reach ${WIN_POINTS} points on your own turn to win. Settlements must be at least two roads from another one and connected to your network.`,
    yourTurn: 'Your turn',
    theirTurn: "{name}'s turn",
    setupSettlement: 'Place a settlement',
    setupRoad: 'Now place a road next to it',
    roll: 'Roll dice',
    end: 'End turn',
    waitRoll: 'Waiting for {name} to roll',
    moveRobber: 'Move the robber to another hex',
    stealFrom: 'Steal from whom?',
    discardTitle: 'Discard {n} cards',
    discardWait: 'Waiting for discards…',
    discardBtn: 'Discard',
    buildRoad: 'Road',
    buildSettlement: 'Settlement',
    buildCity: 'City',
    buyDev: 'Buy card',
    trade: 'Trade',
    freeRoads: 'Free road: place {n} more',
    hand: 'Your hand',
    cards: 'cards',
    devHand: 'Development cards',
    devNew: 'new',
    dev_knight: 'Knight',
    dev_vp: 'Victory point',
    dev_road: 'Road Building',
    dev_plenty: 'Year of Plenty',
    dev_monopoly: 'Monopoly',
    pickRes: 'Pick a resource',
    pickRes2: 'Pick two resources',
    play: 'Play',
    res_wood: 'Wood',
    res_brick: 'Brick',
    res_sheep: 'Wool',
    res_wheat: 'Grain',
    res_ore: 'Ore',
    bankTrade: 'Bank',
    playerTrade: 'Players',
    give: 'You give',
    get: 'You get',
    ratio: '{n}:1',
    doBank: 'Trade with the bank',
    offerBtn: 'Offer to everyone',
    offerFrom: '{name} offers',
    offerFor: 'for',
    accept: 'Accept',
    decline: 'Decline',
    accepted: 'accepted',
    declined: 'declined',
    waiting: 'waiting',
    confirmWith: 'Trade with {name}',
    cancelOffer: 'Cancel offer',
    close: 'Close',
    points: 'points',
    knights: 'knights',
    roadLen: 'road {n}',
    longest: 'Longest road',
    army: 'Largest army',
    bank: 'Bank',
    deck: 'Deck: {n}',
    win: '{name} wins with {n} points!',
    playAgain: 'Play again',
    lastRoll: 'Dice',
    'log:roll': '{name} rolled {n}',
    'log:road': '{name} built a road',
    'log:settlement': '{name} built a settlement',
    'log:city': '{name} built a city',
    'log:dev': '{name} bought a development card',
    'log:play_knight': '{name} played a Knight',
    'log:play_road': '{name} played Road Building',
    'log:play_plenty': '{name} played Year of Plenty',
    'log:play_monopoly': '{name} played Monopoly on {res}',
    'log:discard': '{name} discarded {n} cards',
    'log:robber': '{name} moved the robber',
    'log:steal': '{name} stole a card from {from}',
    'log:bank': '{name} traded {n} {give} for 1 {get} with the bank',
    'log:trade': '{name} traded with {with}',
    'log:longest': '{name} took the longest road',
    'log:longestNone': 'Nobody holds the longest road',
    'log:army': '{name} took the largest army',
    'log:win': '{name} won!',
    'reason:Not your turn': "It's not your turn.",
    'reason:Not now': 'Not now.',
    'reason:You cannot build there': "You can't build there.",
    'reason:Not enough resources': 'Not enough resources.',
    'reason:You already rolled': 'You already rolled.',
    'reason:Place your road': 'Place your road first.',
    'reason:Place a settlement first': 'Place a settlement first.',
    'reason:Place your free roads first': 'Place your free roads first.',
    'reason:No cards left': 'The deck is empty.',
    'reason:The bank is out of that': 'The bank is out of that.',
    'reason:The robber must move': 'The robber has to move.',
    'reason:Cannot steal from them': "You can't steal from them.",
    'reason:You cannot play that': "You can't play that card now.",
    'reason:Bad discard': 'Invalid discard.',
    'reason:Bad offer': 'Invalid offer.',
    'reason:They have not accepted': "They haven't accepted.",
    'reason:No settlements left': 'No settlements left.',
    'reason:No roads left': 'No roads left.',
    'reason:No cities left': 'No cities left.',
  },
};

export function CatanLobby(props: LobbyProps) {
  const t = useGameText(CATAN_TEXT);
  return <SimpleLobby {...props} rules={{ title: t('rulesTitle'), paragraphs: CATAN_RULES.map(k => t(k)) }} />;
}

const TERRAIN_FILL: Record<string, string> = { wood: '#3f7d3a', brick: '#b5523b', sheep: '#9bcf5f', wheat: '#e3c04a', ore: '#8a8f98', desert: '#d9c79a' };
export const RES_ICON: Record<Res, string> = { wood: '🌲', brick: '🧱', sheep: '🐑', wheat: '🌾', ore: '⛰️' };

type Build = 'road' | 'settlement' | 'city' | null;

export function CatanScreen(props: GameScreenProps) {
  const v = asCatanView(props.view);
  const t = useGameText(CATAN_TEXT);
  const reason = useReason(t);
  const { lobby, awaiting, onIntent } = props;
  const [rules, setRules] = useState(false);
  const [build, setBuild] = useState<Build>(null);
  const [trading, setTrading] = useState(false);
  const [pick, setPick] = useState<'plenty' | 'monopoly' | null>(null);
  const [plenty, setPlenty] = useState<Res[]>([]);
  const me = v.me;
  const myTurn = v.current === me;
  const over = v.phase === 'over';
  const name = (i: number) => v.players[i]!.name;
  const color = (i: number) => playerColor(lobby, v.players[i]!.id);

  // Sounds: dice, income, robber, end.
  const heard = useRef({ dice: v.dice?.join(), cards: total(v.hand), phase: v.phase });
  useEffect(() => {
    const before = heard.current;
    heard.current = { dice: v.dice?.join(), cards: total(v.hand), phase: v.phase };
    if (v.dice && v.dice.join() !== before.dice) playSound('spin');
    else if (total(v.hand) > before.cards) playSound('coin');
    if (v.phase === 'robber' && before.phase !== 'robber') playSound('alert');
    if (v.phase === 'over' && before.phase !== 'over') playSound(v.winner === me ? 'win' : 'lose');
  }, [v.dice?.join(), total(v.hand), v.phase]);
  useEffect(() => setBuild(null), [v.phase, v.current]);

  const setup = v.phase === 'setup';
  const auto: Build = setup ? (v.can.settlement.length ? 'settlement' : v.can.road.length ? 'road' : null) : v.freeRoads > 0 && myTurn ? 'road' : null;
  const mode = auto ?? build;
  const spots = {
    settlement: mode === 'settlement' ? v.can.settlement : [],
    city: mode === 'city' ? v.can.city : [],
    road: mode === 'road' ? v.can.road : [],
  };
  const clickVertex = (i: number) => {
    if (awaiting) return;
    if (spots.settlement.includes(i)) onIntent({ type: 'settlement', vertex: i });
    else if (spots.city.includes(i)) onIntent({ type: 'city', vertex: i });
  };
  const clickEdge = (e: number) => {
    if (!awaiting && spots.road.includes(e)) onIntent({ type: 'road', edge: e });
  };
  const clickHex = (h: number) => {
    if (!awaiting && v.can.robber.includes(h)) onIntent({ type: 'robber', hex: h });
  };

  const owing = v.owe[me]! > 0 && v.phase === 'discard';
  let status: string;
  if (over) status = t('win', { name: name(v.winner!), n: v.points[v.winner!]! });
  else if (setup) status = myTurn ? (v.setupCorner === null ? t('setupSettlement') : t('setupRoad')) : t('theirTurn', { name: name(v.current) });
  else if (v.phase === 'discard') status = owing ? t('discardTitle', { n: v.owe[me]! }) : t('discardWait');
  else if (v.phase === 'robber') status = myTurn ? t('moveRobber') : t('theirTurn', { name: name(v.current) });
  else if (v.phase === 'steal') status = myTurn ? t('stealFrom') : t('theirTurn', { name: name(v.current) });
  else if (v.freeRoads > 0 && myTurn) status = t('freeRoads', { n: v.freeRoads });
  else if (v.phase === 'roll') status = myTurn ? t('yourTurn') : t('waitRoll', { name: name(v.current) });
  else status = myTurn ? t('yourTurn') : t('theirTurn', { name: name(v.current) });

  const afford = (c: Partial<Hand>) => RES.every(r => v.hand[r] >= (c[r] ?? 0));
  const main = myTurn && v.phase === 'main' && v.freeRoads === 0;
  const canPlay = (myTurn && (v.phase === 'main' || v.phase === 'roll') && !v.devPlayed && v.freeRoads === 0);

  return (
    <GameFrame
      title={useLang().tr.t('gameCatanName')}
      code={props.code}
      clock={null}
      error={props.error}
      reason={reason}
      onDismissError={props.onDismissError}
      onEndGame={over ? undefined : props.onEndGame}
      onRules={() => setRules(true)}
      className="catan"
    >
      <div className="catan__layout">
        <div className="catan__main">
          <p className={`catan__status${myTurn || owing ? ' is-mine' : ''}`}>{status}</p>
          <Board v={v} color={color} spots={spots} mode={mode} onVertex={clickVertex} onEdge={clickEdge} onHex={clickHex} />
          {v.phase === 'steal' && myTurn && (
            <div className="actions actions--center">
              {v.can.steal.map(i => (
                <button key={i} type="button" className="primary" disabled={awaiting} onClick={() => onIntent({ type: 'steal', from: i })}>
                  <Avatar name={name(i)} color={color(i)} /> {name(i)}
                </button>
              ))}
            </div>
          )}
          <OfferBanner v={v} t={t} name={name} color={color} awaiting={awaiting} onIntent={onIntent} />
        </div>

        <aside className="catan__side">
          <div className="catan__players">
            {v.players.map((p, i) => (
              <div key={p.id} className={`catan__player${v.current === i && !over ? ' is-turn' : ''}${i === me ? ' is-me' : ''}`}>
                <Avatar name={p.name} color={color(i)} />
                <div>
                  <b>{p.name}</b>
                  <div className="muted catan__stats">
                    <span title={t('points')}>★ {v.points[i]}</span>
                    <span title={t('cards')}>🂠 {v.cards[i]}</span>
                    <span title={t('devHand')}>🎴 {v.devCounts[i]}</span>
                    <span title={t('knights')}>⚔ {v.knights[i]}</span>
                    <span>{t('roadLen', { n: v.roadLens[i]! })}</span>
                  </div>
                  <div className="catan__badges">
                    {v.longest.holder === i && <span className="catan__badge">🛣 {t('longest')}</span>}
                    {v.army === i && <span className="catan__badge">⚔ {t('army')}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {v.dice && (
            <p className="catan__dice">
              {t('lastRoll')}: <b>{v.dice[0]}</b> + <b>{v.dice[1]}</b> = <b>{v.dice[0] + v.dice[1]}</b>
            </p>
          )}

          <div className="catan__hand" aria-label={t('hand')}>
            {RES.map(r => (
              <div key={r} className="catan__res" title={t(`res_${r}`)}>
                <span>{RES_ICON[r]}</span>
                <b>{v.hand[r]}</b>
                <small>{t(`res_${r}`)}</small>
              </div>
            ))}
          </div>

          {!over && myTurn && v.phase === 'roll' && (
            <div className="actions actions--center">
              <button type="button" className="primary lg" disabled={awaiting} onClick={() => onIntent({ type: 'roll' })}>
                {t('roll')}
              </button>
            </div>
          )}

          {main && (
            <div className="catan__actions">
              <button type="button" className={mode === 'road' ? 'primary' : ''} disabled={v.can.road.length === 0} onClick={() => setBuild(b => (b === 'road' ? null : 'road'))}>
                {t('buildRoad')}
              </button>
              <button type="button" className={mode === 'settlement' ? 'primary' : ''} disabled={v.can.settlement.length === 0} onClick={() => setBuild(b => (b === 'settlement' ? null : 'settlement'))}>
                {t('buildSettlement')}
              </button>
              <button type="button" className={mode === 'city' ? 'primary' : ''} disabled={v.can.city.length === 0} onClick={() => setBuild(b => (b === 'city' ? null : 'city'))}>
                {t('buildCity')}
              </button>
              <button type="button" disabled={!afford(COSTS.dev) || v.deckLeft === 0 || awaiting} onClick={() => onIntent({ type: 'buyDev' })}>
                {t('buyDev')}
              </button>
              <button type="button" onClick={() => setTrading(true)}>
                {t('trade')}
              </button>
              <button type="button" className="primary" disabled={awaiting} onClick={() => onIntent({ type: 'end' })}>
                {t('end')}
              </button>
            </div>
          )}

          {(v.dev.length > 0 || v.devNew.length > 0) && (
            <div className="catan__devs">
              <small className="muted">{t('devHand')}</small>
              {v.dev.map((c, i) => (
                <DevCardRow key={`d${i}`} card={c} t={t} playable={canPlay && c !== 'vp'} onPlay={() => (c === 'knight' ? onIntent({ type: 'knight' }) : c === 'road' ? onIntent({ type: 'roadBuilding' }) : c !== 'vp' && setPick(c))} />
              ))}
              {v.devNew.map((c, i) => (
                <DevCardRow key={`n${i}`} card={c} t={t} fresh />
              ))}
            </div>
          )}
          {pick && (
            <ResPicker
              t={t}
              count={pick === 'plenty' ? 2 : 1}
              chosen={plenty}
              onChoose={r => {
                if (pick === 'monopoly') {
                  onIntent({ type: 'monopoly', res: r });
                  setPick(null);
                } else if (plenty.length === 1) {
                  onIntent({ type: 'plenty', a: plenty[0], b: r });
                  setPick(null);
                  setPlenty([]);
                } else setPlenty([r]);
              }}
              onCancel={() => {
                setPick(null);
                setPlenty([]);
              }}
            />
          )}

          <small className="muted catan__bank">
            {t('bank')}: {RES.map(r => `${RES_ICON[r]}${v.bank[r]}`).join(' ')} · {t('deck', { n: v.deckLeft })}
          </small>
          <Log v={v} t={t} name={name} />
        </aside>
      </div>

      {over && <EndActions isHost={props.isHost} onPlayAgain={props.onPlayAgain} onBackToLobby={props.onBackToLobby} onLeave={props.onLeave} playAgain={t('playAgain')} />}
      {owing && <DiscardDialog t={t} hand={v.hand} n={v.owe[me]!} awaiting={awaiting} onDiscard={cards => onIntent({ type: 'discard', cards })} />}
      {trading && main && <TradeDialog t={t} v={v} awaiting={awaiting} onIntent={onIntent} onClose={() => setTrading(false)} />}
      {rules && <RulesSheet title={t('rulesTitle')} paragraphs={CATAN_RULES.map(k => t(k))} onClose={() => setRules(false)} />}
    </GameFrame>
  );
}

function Board({ v, color, spots, mode, onVertex, onEdge, onHex }: {
  v: CatanView;
  color: (i: number) => string;
  spots: { settlement: number[]; city: number[]; road: number[] };
  mode: Build;
  onVertex(i: number): void;
  onEdge(i: number): void;
  onHex(i: number): void;
}) {
  const robberOk = new Set(v.can.robber);
  return (
    <svg className="catan__board" viewBox="-5.7 -4.9 11.4 9.8" role="group" aria-label="Catan">
      <rect x="-5.7" y="-4.9" width="11.4" height="9.8" rx="0.6" className="catan__sea" />
      {v.ports.map((p, i) => {
        const [a, b] = EDGE_VERTS[p.edge]!;
        const [ax, ay] = VERTEX_POS[a]!;
        const [bx, by] = VERTEX_POS[b]!;
        const mx = (ax + bx) / 2;
        const my = (ay + by) / 2;
        const len = Math.hypot(mx, my);
        const px = mx + (mx / len) * 0.75;
        const py = my + (my / len) * 0.75;
        return (
          <g key={i} className="catan__port">
            <line x1={ax} y1={ay} x2={px} y2={py} />
            <line x1={bx} y1={by} x2={px} y2={py} />
            <circle cx={px} cy={py} r="0.38" />
            <text x={px} y={py} dy="0.12" textAnchor="middle" fontSize={p.kind === 'any' ? 0.27 : 0.25}>
              {p.kind === 'any' ? '3:1' : `2:${RES_ICON[p.kind]}`}
            </text>
          </g>
        );
      })}
      {v.hexes.map((h, i) => {
        const [cx, cy] = HEX_CENTERS[i]!;
        const pts = HEX_VERTS[i]!.map(k => VERTEX_POS[k]!.join(',')).join(' ');
        const hot = h.num === 6 || h.num === 8;
        return (
          <g key={i} onClick={() => onHex(i)} className={robberOk.has(i) ? 'catan__hex is-target' : 'catan__hex'}>
            <polygon points={pts} fill={TERRAIN_FILL[h.terrain]} className="catan__tile" />
            {h.terrain !== 'desert' && <text x={cx} y={cy! - 0.52} textAnchor="middle" fontSize="0.36" opacity="0.85">{RES_ICON[h.terrain as Res]}</text>}
            {h.num > 0 && (
              <g>
                <circle cx={cx} cy={cy! + 0.05} r="0.36" className="catan__token" />
                <text x={cx} y={cy! + 0.05} dy="0.1" textAnchor="middle" fontSize="0.34" fontWeight="800" className={hot ? 'is-hot' : ''}>
                  {h.num}
                </text>
                <text x={cx} y={cy! + 0.3} textAnchor="middle" fontSize="0.14" className={hot ? 'is-hot' : ''}>
                  {'•'.repeat(pips(h.num))}
                </text>
              </g>
            )}
            {v.robber === i && (
              <g className="catan__robber">
                <ellipse cx={cx! + 0.42} cy={cy! + 0.35} rx="0.16" ry="0.1" />
                <rect x={cx! + 0.3} y={cy! - 0.05} width="0.24" height="0.42" rx="0.12" />
                <circle cx={cx! + 0.42} cy={cy! - 0.12} r="0.14" />
              </g>
            )}
          </g>
        );
      })}
      {v.roads.map((owner, e) => {
        if (owner < 0) return null;
        const [a, b] = EDGE_VERTS[e]!;
        return <line key={e} x1={VERTEX_POS[a]![0]} y1={VERTEX_POS[a]![1]} x2={VERTEX_POS[b]![0]} y2={VERTEX_POS[b]![1]} className="catan__road" stroke={color(owner)} />;
      })}
      {spots.road.map(e => {
        const [a, b] = EDGE_VERTS[e]!;
        return (
          <g key={`re${e}`} onClick={() => onEdge(e)} className="catan__spot">
            <line x1={VERTEX_POS[a]![0]} y1={VERTEX_POS[a]![1]} x2={VERTEX_POS[b]![0]} y2={VERTEX_POS[b]![1]} className="catan__ghost" />
            <line x1={VERTEX_POS[a]![0]} y1={VERTEX_POS[a]![1]} x2={VERTEX_POS[b]![0]} y2={VERTEX_POS[b]![1]} className="catan__hit" />
          </g>
        );
      })}
      {v.verts.map((b, i) => {
        if (!b) return null;
        const [x, y] = VERTEX_POS[i]!;
        return b.city ? (
          <path key={i} className="catan__piece" fill={color(b.seat)} d={`M${x! - 0.24},${y! + 0.2} v-0.32 h0.22 l0.1,-0.14 l0.1,0.14 v0.1 h0.2 v0.22 z`} />
        ) : (
          <path key={i} className="catan__piece" fill={color(b.seat)} d={`M${x! - 0.17},${y! + 0.16} v-0.18 l0.17,-0.17 l0.17,0.17 v0.18 z`} />
        );
      })}
      {(mode === 'settlement' ? spots.settlement : mode === 'city' ? spots.city : []).map(i => {
        const [x, y] = VERTEX_POS[i]!;
        return (
          <g key={`sv${i}`} onClick={() => onVertex(i)} className="catan__spot">
            <circle cx={x} cy={y} r="0.17" className="catan__ghostdot" />
            <circle cx={x} cy={y} r="0.32" className="catan__hit" />
          </g>
        );
      })}
    </svg>
  );
}

function DevCardRow({ card, t, playable, fresh, onPlay }: { card: string; t: TextFn; playable?: boolean; fresh?: boolean; onPlay?: () => void }) {
  return (
    <div className="catan__dev">
      <span>
        {t(`dev_${card}`)}
        {fresh && <small className="muted"> · {t('devNew')}</small>}
      </span>
      {playable && (
        <button type="button" onClick={onPlay}>
          {t('play')}
        </button>
      )}
    </div>
  );
}

function ResPicker({ t, count, chosen, onChoose, onCancel }: { t: TextFn; count: number; chosen: Res[]; onChoose(r: Res): void; onCancel(): void }) {
  return (
    <div className="catan__picker">
      <small>{count === 2 ? `${t('pickRes2')} (${chosen.length}/2)` : t('pickRes')}</small>
      <div className="actions actions--center">
        {RES.map(r => (
          <button key={r} type="button" onClick={() => onChoose(r)} title={t(`res_${r}`)}>
            {RES_ICON[r]}
          </button>
        ))}
        <button type="button" className="ghost" onClick={onCancel}>
          ✕
        </button>
      </div>
    </div>
  );
}

function HandText({ hand }: { hand: Hand }) {
  return (
    <span className="catan__handtext">
      {RES.filter(r => hand[r] > 0).map(r => (
        <span key={r}>
          {hand[r]}
          {RES_ICON[r]}
        </span>
      ))}
    </span>
  );
}

function OfferBanner({ v, t, name, color, awaiting, onIntent }: { v: CatanView; t: TextFn; name(i: number): string; color(i: number): string; awaiting: boolean; onIntent(i: unknown): void }) {
  const tr = v.trade;
  if (!tr) return null;
  const mine = tr.from === v.me;
  const canAnswer = RES.every(r => v.hand[r] >= tr.get[r]);
  return (
    <div className="catan__offer">
      <b>{mine ? t('offerFrom', { name: name(v.me) }) : t('offerFrom', { name: name(tr.from) })}</b> <HandText hand={tr.give} /> {t('offerFor')} <HandText hand={tr.get} />
      {mine ? (
        <div className="actions actions--center">
          {v.players.map((_, i) =>
            i === v.me ? null : tr.answers[i] === true ? (
              <button key={i} type="button" className="primary" disabled={awaiting} onClick={() => onIntent({ type: 'confirm', with: i })}>
                {t('confirmWith', { name: name(i) })}
              </button>
            ) : (
              <span key={i} className="muted">
                {name(i)}: {tr.answers[i] === false ? t('declined') : t('waiting')}
              </span>
            ),
          )}
          <button type="button" className="ghost" onClick={() => onIntent({ type: 'cancel' })}>
            {t('cancelOffer')}
          </button>
        </div>
      ) : (
        <div className="actions actions--center">
          {tr.answers[v.me] === true ? (
            <span className="muted">{t('accepted')}</span>
          ) : (
            <button type="button" className="primary" disabled={!canAnswer || awaiting} onClick={() => onIntent({ type: 'respond', accept: true })}>
              {t('accept')}
            </button>
          )}
          {tr.answers[v.me] === false ? (
            <span className="muted">{t('declined')}</span>
          ) : (
            <button type="button" disabled={awaiting} onClick={() => onIntent({ type: 'respond', accept: false })}>
              {t('decline')}
            </button>
          )}
          <span className="catan__dot" style={{ background: color(tr.from) }} />
        </div>
      )}
    </div>
  );
}

function Stepper({ t, hand, max, onChange }: { t: TextFn; hand: Hand; max?: Hand; onChange(h: Hand): void }) {
  return (
    <div className="catan__stepper">
      {RES.map(r => (
        <div key={r} className="catan__step">
          <span title={t(`res_${r}`)}>{RES_ICON[r]}</span>
          <button type="button" aria-label={`- ${t(`res_${r}`)}`} disabled={hand[r] <= 0} onClick={() => onChange({ ...hand, [r]: hand[r] - 1 })}>
            −
          </button>
          <b>{hand[r]}</b>
          <button type="button" aria-label={`+ ${t(`res_${r}`)}`} disabled={max ? hand[r] >= max[r] : hand[r] >= 9} onClick={() => onChange({ ...hand, [r]: hand[r] + 1 })}>
            +
          </button>
        </div>
      ))}
    </div>
  );
}

function DiscardDialog({ t, hand, n, awaiting, onDiscard }: { t: TextFn; hand: Hand; n: number; awaiting: boolean; onDiscard(h: Hand): void }) {
  const [cards, setCards] = useState<Hand>(emptyHand());
  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <div className="panel">
        <h2>{t('discardTitle', { n })}</h2>
        <Stepper t={t} hand={cards} max={hand} onChange={setCards} />
        <div className="actions actions--center">
          <button type="button" className="primary" disabled={total(cards) !== n || awaiting} onClick={() => onDiscard(cards)}>
            {t('discardBtn')} ({total(cards)}/{n})
          </button>
        </div>
      </div>
    </div>
  );
}

function TradeDialog({ t, v, awaiting, onIntent, onClose }: { t: TextFn; v: CatanView; awaiting: boolean; onIntent(i: unknown): void; onClose(): void }) {
  const [tab, setTab] = useState<'bank' | 'players'>('bank');
  const [give, setGive] = useState<Res>(RES.find(r => v.hand[r] >= v.ratios[r]) ?? 'wood');
  const [get, setGet] = useState<Res>(RES.find(r => r !== give) ?? 'ore');
  const [offerGive, setOfferGive] = useState<Hand>(emptyHand());
  const [offerGet, setOfferGet] = useState<Hand>(emptyHand());
  const bankOk = give !== get && v.hand[give] >= v.ratios[give] && v.bank[get] > 0;
  const offerOk = total(offerGive) > 0 && total(offerGet) > 0 && RES.every(r => !(offerGive[r] > 0 && offerGet[r] > 0)) && !v.trade;
  return (
    <div className="overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="panel catan__trade" onClick={e => e.stopPropagation()}>
        <div className="actions actions--center">
          <button type="button" className={tab === 'bank' ? 'primary' : ''} onClick={() => setTab('bank')}>
            {t('bankTrade')}
          </button>
          <button type="button" className={tab === 'players' ? 'primary' : ''} onClick={() => setTab('players')}>
            {t('playerTrade')}
          </button>
        </div>
        {tab === 'bank' ? (
          <>
            <p>{t('give')}</p>
            <div className="catan__pickrow">
              {RES.map(r => (
                <button key={r} type="button" className={give === r ? 'primary' : ''} disabled={v.hand[r] < v.ratios[r]} onClick={() => setGive(r)}>
                  {RES_ICON[r]} <small>{t('ratio', { n: v.ratios[r] })}</small>
                </button>
              ))}
            </div>
            <p>{t('get')}</p>
            <div className="catan__pickrow">
              {RES.map(r => (
                <button key={r} type="button" className={get === r ? 'primary' : ''} disabled={r === give || v.bank[r] === 0} onClick={() => setGet(r)}>
                  {RES_ICON[r]}
                </button>
              ))}
            </div>
            <div className="actions actions--center">
              <button
                type="button"
                className="primary"
                disabled={!bankOk || awaiting}
                onClick={() => {
                  onIntent({ type: 'bank', give, get });
                  onClose();
                }}
              >
                {t('doBank')}
              </button>
            </div>
          </>
        ) : (
          <>
            <p>{t('give')}</p>
            <Stepper t={t} hand={offerGive} max={v.hand} onChange={setOfferGive} />
            <p>{t('get')}</p>
            <Stepper t={t} hand={offerGet} onChange={setOfferGet} />
            <div className="actions actions--center">
              <button
                type="button"
                className="primary"
                disabled={!offerOk || awaiting}
                onClick={() => {
                  onIntent({ type: 'offer', give: offerGive, get: offerGet });
                  onClose();
                }}
              >
                {t('offerBtn')}
              </button>
            </div>
          </>
        )}
        <div className="actions actions--center">
          <button type="button" className="ghost" onClick={onClose}>
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Log({ v, t, name }: { v: CatanView; t: TextFn; name(i: number): string }) {
  const lines = v.log.slice(-7).reverse();
  return (
    <ul className="catan__log">
      {lines.map((e, i) => (
        <li key={`${v.log.length}-${i}`}>{logText(e, t, name)}</li>
      ))}
    </ul>
  );
}

function logText(e: CatanLog, t: TextFn, name: (i: number) => string): string {
  switch (e.k) {
    case 'roll': return t('log:roll', { name: name(e.seat), n: e.dice[0] + e.dice[1] });
    case 'build': return t(`log:${e.what}`, { name: name(e.seat) });
    case 'dev': return t('log:dev', { name: name(e.seat) });
    case 'play': return t(`log:play_${e.card}`, { name: name(e.seat), res: e.res ? t(`res_${e.res}`) : '' });
    case 'discard': return t('log:discard', { name: name(e.seat), n: e.n });
    case 'robber': return t('log:robber', { name: name(e.seat) });
    case 'steal': return t('log:steal', { name: name(e.seat), from: name(e.from) });
    case 'bank': return t('log:bank', { name: name(e.seat), n: e.n, give: RES_ICON[e.give], get: RES_ICON[e.get] });
    case 'trade': return t('log:trade', { name: name(e.seat), with: name(e.with) });
    case 'longest': return e.seat === null ? t('log:longestNone') : t('log:longest', { name: name(e.seat) });
    case 'army': return t('log:army', { name: name(e.seat) });
    case 'win': return t('log:win', { name: name(e.seat) });
  }
}
