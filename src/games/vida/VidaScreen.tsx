import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { LobbyState } from '../../net/protocol';
import { useLang } from '../../i18n/LangProvider';
import { pieceEmoji } from '../../theme/playerPieces';
import { Avatar } from '../../ui/components/Avatar';
import { playerColor } from '../../ui/playerColor';
import { EndActions, GameFrame, RulesSheet, useGameText, useReason, type GameScreenProps, type TextFn } from '../shared/GameFrame';
import { boardFor, CAREERS, chapterAt, HOUSES, LOAN_INTEREST, LOAN_PAYBACK, nextStop, SPIN_MAX, type Square, type VidaBoard } from './board';
import { asVidaView, type VidaLog, type VidaView } from './game';
import { reducedMotion } from './motion';
import { CHAPTER_ICON, KIND_ICON, LEGEND, reach, spinsLabel, squareIcon, squareKind, STOP_ICON } from './track';
import { useVidaMotion, type VidaMotion } from './useVidaMotion';
import { RULE_KEYS, VIDA_TEXT } from './text';

/** Columns of the serpentine map on wide screens. */
const COLS = 12;
/** From this width the whole board is drawn as a map; below it, a strip around the current player. */
const WIDE = '(min-width: 760px)';
const money = (n: number) => `$${n}k`;

export function VidaScreen(props: GameScreenProps) {
  const view = asVidaView(props.view);
  const t = useGameText(VIDA_TEXT);
  const reason = useReason(t);
  const [rules, setRules] = useState(false);
  const over = view.winner !== null;
  return (
    <GameFrame
      title={useLang().tr.t('gameVidaName')}
      code={props.code}
      clock={over ? null : props.clock}
      error={props.error}
      reason={reason}
      onDismissError={props.onDismissError}
      onEndGame={over ? undefined : props.onEndGame}
      onRules={() => setRules(true)}
      className="vida"
    >
      {over ? <VidaEnd {...props} view={view} t={t} /> : <VidaTable {...props} view={view} t={t} />}
      {rules && <RulesSheet title={t('rulesTitle')} paragraphs={RULE_KEYS.map(k => t(k))} onClose={() => setRules(false)} />}
    </GameFrame>
  );
}

type Inner = Omit<GameScreenProps, 'view'> & { view: VidaView; t: TextFn };

function useMedia(query: string): boolean {
  const supported = typeof matchMedia === 'function';
  const [matches, setMatches] = useState(() => supported && matchMedia(query).matches);
  useEffect(() => {
    if (!supported) return;
    const list = matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);
  return matches;
}

function squareText(sq: Square, t: TextFn): { label: string; amount?: string } {
  switch (sq.k) {
    case 'payday': return { label: t('sq_payday'), amount: t('oneSalary') };
    case 'cash': return { label: t(`t_${sq.t}`), amount: `${sq.n >= 0 ? '+' : '−'}${money(Math.abs(sq.n))}` };
    case 'raise': return { label: t(`t_${sq.t}`), amount: `📈 +${money(sq.n)}` };
    case 'bonus': return { label: t(`t_${sq.t}`), amount: t('oneSalary') };
    case 'collect': return { label: t(`t_${sq.t}`), amount: t(sq.n >= 0 ? 'eachPays' : 'eachGets', { n: money(Math.abs(sq.n)) }) };
    case 'perkid': return { label: t(`t_${sq.t}`), amount: t('perKid', { n: money(sq.n) }) };
    case 'interest': return { label: t('sq_interest'), amount: t('perLoan', { n: money(LOAN_INTEREST) }) };
    case 'life': return { label: t(`t_${sq.t}`), amount: `⭐ ${t('life')}` };
    case 'baby': return { label: t(sq.n === 2 ? 'sq_twins' : 'sq_baby') };
    case 'tax': return { label: t('sq_tax'), amount: '¼' };
    case 'sue': return { label: t('sq_sue'), amount: `+${money(50)}` };
    case 'blank': return { label: t(`t_${sq.t}`) };
    case 'stop': return { label: t(`sq_${sq.s}`) };
  }
}

/** Which way the path leaves map cell `i`: along the row, or down at the row's end. */
function direction(i: number, total: number): 'right' | 'left' | 'down' | 'end' {
  if (i === total - 1) return 'end';
  const row = Math.floor(i / COLS);
  if (i % COLS === COLS - 1) return 'down';
  return row % 2 === 0 ? 'right' : 'left';
}

/** Grid row and column for map cell `i` (0 is the start), snaking left-right then right-left. */
function place(i: number): { gridRow: number; gridColumn: number } {
  const row = Math.floor(i / COLS);
  const col = i % COLS;
  return { gridRow: row + 1, gridColumn: (row % 2 === 0 ? col : COLS - 1 - col) + 1 };
}

interface Pawn {
  seat: number;
  name: string;
  color: string;
  piece: string;
  current: boolean;
}

/** Everything a square needs to draw itself, worked out once per render. */
interface BoardModel {
  board: VidaBoard;
  pawnsAt(pos: number): Pawn[];
  /** Spins that land on each square, for the player about to spin. */
  reachable: Map<number, number[]>;
  /** The next stop of the player whose turn it is. */
  next: number | null;
  /** Where the last spin ended, in the spinner's colour, once the walk is over. */
  landed: { pos: number; color: string } | null;
  coins: VidaMotion['coins'];
}

function useBoardModel(view: VidaView, lobby: LobbyState, motion: VidaMotion): BoardModel {
  const board = boardFor(view.length);
  const pawns: Pawn[] = view.players.map((p, seat) => ({
    seat,
    name: p.name,
    color: playerColor(lobby, p.id),
    piece: pieceEmoji(lobby.players.find(lp => lp.id === p.id)?.piece) ?? p.name.trim().charAt(0).toUpperCase(),
    current: seat === view.current,
  }));
  const cur = view.players[view.current]!;
  const ready = !motion.busy && !view.spun && !view.choosing && cur.started && !cur.retired;
  const curPos = motion.positions[view.current] ?? cur.pos;
  const last = view.lastSpin;
  return {
    board,
    pawnsAt: pos => pawns.filter(p => (motion.positions[p.seat] ?? -1) === pos || (pos === -1 && (motion.positions[p.seat] ?? -1) < 0)),
    reachable: ready ? reach(board, curPos) : new Map(),
    next: cur.started && !cur.retired ? (board.squares[curPos]?.k === 'stop' && view.choosing ? curPos : nextStop(board, curPos)) : null,
    landed: last && !motion.busy ? { pos: view.players[last.seat]!.pos, color: pawns[last.seat]!.color } : null,
    coins: motion.coins,
  };
}

function VidaTable({ view, lobby, awaiting, onIntent, t }: Inner) {
  const motion = useVidaMotion(view);
  const wide = useMedia(WIDE);
  const model = useBoardModel(view, lobby, motion);
  const followed = motion.positions[view.current] ?? -1;
  return (
    <div className={`vida__table ${wide ? 'is-map' : 'is-strip'}`}>
      <section className="vida__boardwrap" aria-label={t('boardLabel')}>
        <LifeLine view={view} model={model} motion={motion} t={t} onPick={pos => scrollToSquare(pos, wide ? 'center' : 'nearest')} />
        {wide ? <MapBoard model={model} t={t} followed={followed} /> : <Strip model={model} t={t} followed={followed} />}
        {wide && <Legend t={t} />}
      </section>

      {motion.wheel && <Wheel n={motion.wheel.n} key={motion.wheel.key} />}
      {motion.event && <EventCard key={motion.event.key} entry={motion.event.entry} view={view} lobby={lobby} t={t} />}

      <aside className="vida__side">
        <TurnPanel view={view} lobby={lobby} motion={motion} model={model} awaiting={awaiting} onIntent={onIntent} t={t} />
        <Players view={motion.shown} lobby={lobby} model={model} t={t} />
        {!wide && <Legend t={t} />}
        <details className="panel vida__log">
          <summary>{t('log')}</summary>
          <ol>
            {motion.shown.log.slice(-20).reverse().map((entry, i) => (
              <li key={i}>{logLine(entry, motion.shown, t)}</li>
            ))}
          </ol>
        </details>
      </aside>
    </div>
  );
}

/** Brings a square into view (from the life line). */
function scrollToSquare(pos: number, block: ScrollLogicalPosition = 'center') {
  const el = document.querySelector<HTMLElement>(`.vida [data-pos="${pos}"]`);
  el?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block, inline: 'center' });
}

/** The whole life in one bar: chapters in order, every pawn on it, start on the left and retirement on the right. */
function LifeLine({ view, model, motion, t, onPick }: { view: VidaView; model: BoardModel; motion: VidaMotion; t: TextFn; onPick(pos: number): void }) {
  const total = model.board.squares.length;
  return (
    <div className="vida__life" role="group" aria-label={t('lifeLine')}>
      <span className="vida__lifeend" aria-hidden="true">🚩</span>
      <div className="vida__lifebar">
        {model.board.chapters.map(c => (
          <button
            key={c.id}
            type="button"
            className={`vida__chap vida__chap--${c.id}`}
            style={{ flexGrow: c.to - c.from + 1 }}
            title={t(`ch_${c.id}`)}
            onClick={() => onPick(c.from)}
          >
            <span aria-hidden="true">{CHAPTER_ICON[c.id]}</span>
            <span className="vida__chapname">{t(`ch_${c.id}`)}</span>
          </button>
        ))}
        {view.players.map((p, seat) => {
          const pos = motion.positions[seat] ?? p.pos;
          const pawn = model.pawnsAt(pos).find(x => x.seat === seat);
          const color = pawn?.color ?? 'var(--muted)';
          return (
            <span
              key={p.id}
              className={`vida__lifedot${seat === view.current ? ' is-current' : ''}`}
              style={{ left: `${(Math.max(0, pos + 1) / total) * 100}%`, background: color, top: `${2 + (seat % 3) * 5}px` }}
              title={p.name}
            />
          );
        })}
      </div>
      <span className="vida__lifeend" aria-hidden="true">🌅</span>
    </div>
  );
}

function Cell({ pos, model, t, style, dir, names }: { pos: number; model: BoardModel; t: TextFn; style?: CSSProperties; dir: string; names: boolean }) {
  const { board } = model;
  const sq = pos >= 0 ? board.squares[pos]! : null;
  const text = sq ? squareText(sq, t) : { label: t('start') };
  const kind = sq ? squareKind(sq) : 'start';
  const chapter = pos >= 0 ? board.chapters.find(c => c.from === pos) : undefined;
  const pawns = model.pawnsAt(pos);
  const spins = model.reachable.get(pos);
  const landed = model.landed?.pos === pos;
  const classes = [
    'vida__sq',
    `vida__sq--${kind}`,
    `go-${dir}`,
    pos >= 0 && pos <= board.graduate ? 'is-campus' : '',
    spins ? 'is-reach' : '',
    model.next === pos ? 'is-next' : '',
    landed ? 'is-landed' : '',
    pawns.some(p => p.current) ? 'has-current' : '',
  ].filter(Boolean).join(' ');
  const title = [pos >= 0 ? t('square', { n: pos + 1 }) : '', text.label, text.amount ?? ''].filter(Boolean).join(' · ');
  return (
    <div className={classes} style={{ ...style, ...(landed ? { '--landed': model.landed!.color } : {}) } as CSSProperties} title={title} data-pos={pos}>
      {pos >= 0 && <span className="vida__num">{pos + 1}</span>}
      {chapter && (
        <span className="vida__chapbadge">
          {CHAPTER_ICON[chapter.id]} {t(`ch_${chapter.id}`)}
        </span>
      )}
      {sq?.k === 'stop' && <span className="vida__stoptag">{t('stopTag')}</span>}
      <span className="vida__icon" aria-hidden="true">{sq ? squareIcon(sq) : '🚩'}</span>
      <span className="vida__label">{text.label}</span>
      {text.amount && <span className="vida__amount">{text.amount}</span>}
      {spins && (
        <span className="vida__reach" aria-label={`🎡 ${spinsLabel(spins)}`}>
          🎡{spinsLabel(spins)}
        </span>
      )}
      {pawns.length > 0 && (
        <span className="vida__pawns">
          {pawns.map(p => (
            <span key={p.seat} className={`vida__pawn${p.current ? ' is-current' : ''}`} style={{ '--pc': p.color } as CSSProperties} title={p.name}>
              <span className="vida__pawndisc" aria-hidden="true">{p.piece}</span>
              {(names || p.current) && <span className="vida__pawnname">{p.name}</span>}
            </span>
          ))}
        </span>
      )}
      {model.coins.filter(c => c.pos === pos).map(c => (
        <span key={c.key} className="vida__coin" aria-hidden="true">
          +{money(c.amount)}
        </span>
      ))}
    </div>
  );
}

/** Wide screens: the whole life as a serpentine map, start top-left, arrows along the way, retirement at the end. */
function MapBoard({ model, t, followed }: { model: BoardModel; t: TextFn; followed: number }) {
  const cells = [-1, ...model.board.squares.map((_, i) => i)];
  // The map is taller than the window: when the current pawn walks out of sight, bring it back (only if it's off screen).
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) scrollToSquare(followed, 'nearest');
    mounted.current = true;
  }, [followed]);
  return (
    <div className="vida__map" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}>
      {cells.map((pos, i) => (
        <Cell key={pos} pos={pos} model={model} t={t} style={place(i)} dir={direction(i, cells.length)} names={false} />
      ))}
    </div>
  );
}

/** Phones: one row of big squares that follows whoever's turn it is; the life line above is the overview. */
function Strip({ model, t, followed }: { model: BoardModel; t: TextFn; followed: number }) {
  const row = useRef<HTMLDivElement>(null);
  const cells = [-1, ...model.board.squares.map((_, i) => i)];
  const mounted = useRef(false);
  useLayoutEffect(() => {
    const el = row.current?.children[followed + 1] as HTMLElement | undefined;
    if (!row.current || !el) return;
    // Keep the pawn near the left so the squares ahead show.
    const left = el.offsetLeft - row.current.clientWidth * 0.18;
    row.current.scrollTo({ left, behavior: !mounted.current || reducedMotion() ? 'auto' : 'smooth' });
    mounted.current = true;
  }, [followed]);
  return (
    <div className="vida__strip" ref={row} role="group" aria-label={t('stripLabel')}>
      {cells.map((pos, i) => (
        <Cell key={pos} pos={pos} model={model} t={t} dir={i === cells.length - 1 ? 'end' : 'right'} names />
      ))}
    </div>
  );
}

function Legend({ t }: { t: TextFn }) {
  return (
    <details className="vida__legend" open={typeof matchMedia === 'function' && matchMedia(WIDE).matches}>
      <summary>{t('legendTitle')}</summary>
      <ul>
        {LEGEND.map(k => (
          <li key={k}>
            <span className={`vida__swatch vida__sq--${k}`} aria-hidden="true">{KIND_ICON[k]}</span>
            {t(`k_${k}`)}
          </li>
        ))}
        <li>
          <span className="vida__swatch is-reach" aria-hidden="true">🎡</span>
          {t('k_reach')}
        </li>
      </ul>
    </details>
  );
}

function TurnPanel({ view, lobby, motion, model, awaiting, onIntent, t }: { view: VidaView; lobby: LobbyState; motion: VidaMotion; model: BoardModel; awaiting: boolean; onIntent(i: unknown): void; t: TextFn }) {
  const current = view.players[view.current]!;
  const myTurn = view.current === view.me;
  const me = view.players[view.me]!;
  const color = playerColor(lobby, current.id);
  const curPos = motion.positions[view.current] ?? current.pos;
  const nextSq = model.next !== null ? model.board.squares[model.next] : null;
  return (
    <section className={`panel vida__turn${myTurn ? ' is-mine' : ''}`} style={{ '--pc': color } as CSSProperties}>
      <h2>
        <span className="vida__turndot" aria-hidden="true" />
        {myTurn ? t('yourTurn') : t('theirTurn', { name: current.name })}
      </h2>
      {nextSq?.k === 'stop' && !motion.busy && (
        <p className="vida__next">
          {model.next === curPos
            ? t('nextStopHere', { icon: STOP_ICON[nextSq.s], what: t(`sq_${nextSq.s}`) })
            : t('nextStop', { icon: STOP_ICON[nextSq.s], what: t(`sq_${nextSq.s}`), n: model.next! - curPos })}
        </p>
      )}
      {motion.busy ? (
        <p className="vida__moving">{t('moving', { name: current.name })}</p>
      ) : myTurn ? (
        <Actions view={view} awaiting={awaiting} onIntent={onIntent} t={t} />
      ) : (
        view.choosing && <p className="muted">{t('choosing', { name: current.name })}</p>
      )}
      {myTurn && !motion.busy && !view.prompt && !view.spun && model.reachable.size > 0 && <p className="vida__hint">{t('reachHint')}</p>}
      {me.loans > 0 && me.cash >= LOAN_PAYBACK && myTurn && !view.prompt && !motion.busy && (
        <button type="button" className="vida__repay" disabled={awaiting} onClick={() => onIntent({ type: 'repay' })}>
          {t('repay')}
        </button>
      )}
      {!motion.busy && <LastMove view={view} lobby={lobby} model={model} t={t} />}
    </section>
  );
}

/** What the last spin did: the number, the square it ended on and every effect, so nobody needs the log. */
function LastMove({ view, lobby, model, t }: { view: VidaView; lobby: LobbyState; model: BoardModel; t: TextFn }) {
  let at = view.log.length - 1;
  while (at >= 0 && view.log[at]!.k !== 'spin') at--;
  if (at < 0 || !view.lastSpin) return null;
  const seat = view.lastSpin.seat;
  // Only what happened to the spinner (others' first choices come after it in the log).
  const entries = view.log.slice(at + 1).filter(e => !('seat' in e) || e.seat === seat || e.k === 'loan' || e.k === 'sue');
  const p = view.players[seat]!;
  const sq = model.board.squares[p.pos];
  const pays = entries.filter(e => e.k === 'payday');
  const rest = entries.filter(e => e.k !== 'payday' && e.k !== 'spin');
  const kind = sq ? squareKind(sq) : 'plain';
  return (
    <div className={`vida__last vida__sq--${kind}`} style={{ '--pc': playerColor(lobby, p.id) } as CSSProperties} role="status">
      <div className="vida__lasthead">
        <span className="vida__wheelchip" aria-hidden="true">{view.lastSpin.n}</span>
        <span>
          <small>{t('lastMove')}</small>
          <b>{t('spunBy', { name: p.name, n: view.lastSpin.n })}</b>
        </span>
      </div>
      {sq && (
        <p className="vida__lastland">
          {t('landedOn', { name: p.name, icon: squareIcon(sq), what: squareText(sq, t).label })}
        </p>
      )}
      <ul>
        {pays.length > 0 && <li>💵 {t('paidTimes', { n: pays.length, total: money(pays.reduce((a, e) => a + ('n' in e ? e.n : 0), 0)) })}</li>}
        {rest.slice(-4).map((e, i) => (
          <li key={i}>
            {eventIcon(e)} {logLine(e, view, t)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Players({ view, lobby, model, t }: { view: VidaView; lobby: LobbyState; model: BoardModel; t: TextFn }) {
  return (
    <section className="panel vida__players">
      {view.players.map((p, i) => {
        const color = playerColor(lobby, p.id);
        const chapter = p.pos >= 0 ? chapterAt(model.board, p.pos) : null;
        const career = CAREERS.find(c => c.id === p.career);
        return (
          <div key={p.id} className={`vida__player${i === view.current ? ' is-turn' : ''}`} style={{ '--pc': color } as CSSProperties}>
            <Avatar name={p.name} color={color} piece={pieceEmoji(lobby.players.find(lp => lp.id === p.id)?.piece)} />
            <div className="vida__pmain">
              <div className="vida__ptop">
                <b className="vida__pname">
                  {p.name}
                  {i === view.me && <span className="muted"> ({t('you')})</span>}
                </b>
                <span className="vida__cash">{money(p.cash)}</span>
              </div>
              <div className="vida__chips">
                <span className="vida__chip">
                  💼 {p.career ? `${career?.degree ? '🎓 ' : ''}${t(`c_${p.career}`)} · ${t('salary', { n: money(p.salary) })}` : t('noCareer')}
                </span>
                {p.married && <span className="vida__chip">💍 {t('married')}</span>}
                {p.kids > 0 && <span className="vida__chip">👶 {t('kidsShort', { n: p.kids })}</span>}
                {p.house && <span className="vida__chip">🏠 {t(`h_${p.house}`)}</span>}
                {p.tiles > 0 && <span className="vida__chip">⭐ {t('tilesShort', { n: p.tiles })}</span>}
                {p.loans > 0 && <span className="vida__chip is-debt">🏦 {t('debt', { n: p.loans })}</span>}
                {p.retired && <span className="vida__chip">{p.retired === 'country' ? '🌳' : '🏰'} {t(`retired_${p.retired}`)}</span>}
              </div>
              <div className="vida__where">
                {chapter ? t('where', { n: p.pos + 1, chapter: `${CHAPTER_ICON[chapter.id]} ${t(`ch_${chapter.id}`)}` }) : t('notStarted')}
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}

function Actions({ view, awaiting, onIntent, t }: { view: VidaView; awaiting: boolean; onIntent(i: unknown): void; t: TextFn }) {
  const prompt = view.prompt;
  if (!prompt) {
    return (
      <button type="button" className="primary lg vida__spinbtn" disabled={awaiting || view.spun} onClick={() => onIntent({ type: 'spin' })}>
        🎡 {t('spin')}
      </button>
    );
  }
  const choice = (key: string, title: string, hint: string, intent: unknown) => (
    <button key={key} type="button" className="vida__choice" disabled={awaiting} onClick={() => onIntent(intent)}>
      <b>{title}</b>
      <span className="muted">{hint}</span>
    </button>
  );
  switch (prompt.kind) {
    case 'path':
      return (
        <div className="vida__choices">
          <h3>{t('choosePath')}</h3>
          {choice('college', `🎓 ${t('college')}`, t('collegeHint'), { type: 'path', college: true })}
          {choice('career', `💼 ${t('career')}`, t('careerHint'), { type: 'path', college: false })}
        </div>
      );
    case 'career':
      return (
        <div className="vida__choices">
          <h3>{t(prompt.keep ? 'chooseJob' : 'chooseCareer')}</h3>
          {prompt.keep && choice('keep', `🪑 ${t('keepJob')}`, t('keepJobHint'), { type: 'career', career: null })}
          {prompt.options.map(id => {
            const c = CAREERS.find(x => x.id === id)!;
            return choice(id, `${c.degree ? '🎓 ' : ''}${t(`c_${id}`)}`, prompt.keep ? t('switchHint', { n: money(c.salary) }) : t('salary', { n: money(c.salary) }), { type: 'career', career: id });
          })}
        </div>
      );
    case 'house':
      return (
        <div className="vida__choices">
          <h3>{t('chooseHouse')}</h3>
          {prompt.options.map(id => {
            const h = HOUSES.find(x => x.id === id)!;
            return choice(id, `🏠 ${t(`h_${id}`)}`, `${t('price', { n: money(h.price) })} · ${t('resale', { n: money(h.value) })}`, { type: 'house', house: id });
          })}
          <button type="button" disabled={awaiting} onClick={() => onIntent({ type: 'house', house: null })}>
            {t('noHouse')}
          </button>
        </div>
      );
    case 'sue':
      return (
        <div className="vida__choices">
          <h3>{t('chooseSue')}</h3>
          {view.players.map((p, i) =>
            i === view.me || p.retired ? null : choice(p.id, p.name, money(p.cash), { type: 'sue', target: i }),
          )}
        </div>
      );
    case 'invest':
      return (
        <div className="vida__choices">
          <h3>{t('chooseInvest')}</h3>
          {choice('savings', `🐷 ${t('inv_savings')}`, t('inv_savingsHint'), { type: 'invest', pick: 'savings' })}
          {choice('stocks', `📈 ${t('inv_stocks')}`, t('inv_stocksHint'), { type: 'invest', pick: 'stocks' })}
          {choice('crypto', `🪙 ${t('inv_crypto')}`, t('inv_cryptoHint'), { type: 'invest', pick: 'crypto' })}
        </div>
      );
    case 'midlife':
      return (
        <div className="vida__choices">
          <h3>{t('chooseMidlife')}</h3>
          {choice('bike', `🏍️ ${t('mid_bike')}`, t('mid_bikeHint'), { type: 'midlife', pick: 'bike' })}
          {choice('therapy', `🛋️ ${t('mid_therapy')}`, t('mid_therapyHint'), { type: 'midlife', pick: 'therapy' })}
          {choice('deny', `🙂 ${t('mid_deny')}`, t('mid_denyHint'), { type: 'midlife', pick: 'deny' })}
        </div>
      );
    case 'retire':
      return (
        <div className="vida__choices">
          <h3>{t('chooseRetire')}</h3>
          {choice('country', `🌳 ${t('country')}`, t('countryHint'), { type: 'retire', where: 'country' })}
          {choice('mansion', `🏰 ${t('mansion')}`, t('mansionHint'), { type: 'retire', where: 'mansion' })}
        </div>
      );
  }
}

function logLine(e: VidaLog, view: VidaView, t: TextFn): string {
  const name = view.players[e.seat ?? 0]?.name ?? '—';
  switch (e.k) {
    case 'spin': return t('log_spin', { name, n: e.n });
    case 'path': return t(e.college ? 'log_pathCollege' : 'log_pathCareer', { name });
    case 'career': return t('log_career', { name, career: t(`c_${e.career}`) });
    case 'payday': return t('log_payday', { name, n: money(e.n) });
    case 'cash': return t(e.n >= 0 ? 'log_cashGain' : 'log_cashLose', { name, what: t(`t_${e.t}`), n: money(Math.abs(e.n)) });
    case 'raise': return t('log_raise', { name, what: t(`t_${e.t}`), n: money(e.n) });
    case 'life': return t('log_life', { name, what: t(`t_${e.t}`) });
    case 'baby': return t('log_baby', { name, n: e.n });
    case 'tax': return t('log_tax', { name, n: money(e.n) });
    case 'sue': return t('log_sue', { name, target: view.players[e.target]?.name ?? '—', n: money(e.n) });
    case 'marry': return t('log_marry', { name, n: money(e.n) });
    case 'house': return e.house ? t('log_house', { name, house: t(`h_${e.house}`) }) : t('log_noHouse', { name });
    case 'loan': return t('log_loan', { name, n: e.n });
    case 'repay': return t('log_repay', { name });
    case 'dodge': return t('log_dodge', { name, what: t(`t_${e.t}`) });
    case 'invest': return t(e.n >= 0 ? 'log_invest_gain' : 'log_invest_loss', { name, pick: t(`inv_${e.pick}`), n: money(Math.abs(e.n)) });
    case 'midlife': return t('log_midlife', { name, pick: t(`mid_${e.pick}`) });
    case 'retire': return t(`log_retire_${e.where}`, { name });
    case 'mansion': return e.seat === null ? t('log_mansionTie') : t('log_mansion', { name });
  }
}

function eventIcon(e: VidaLog): string {
  switch (e.k) {
    case 'cash': return e.n >= 0 ? '💰' : '💳';
    case 'invest': return e.n >= 0 ? '📈' : '📉';
    case 'raise': return '📈';
    case 'life': return '⭐';
    case 'baby': return '👶';
    case 'tax': return '🧾';
    case 'sue': return '⚖️';
    case 'marry': return '💍';
    case 'house': return '🏠';
    case 'retire': return '🌅';
    case 'loan': return '🏦';
    case 'repay': return '🏦';
    case 'career': return '💼';
    case 'mansion': return '🏰';
    case 'midlife': return '🏍️';
    case 'dodge': return '😅';
    case 'payday': return '💵';
    default: return '✨';
  }
}

function isGood(e: VidaLog): boolean {
  if (e.k === 'cash' || e.k === 'invest') return e.n >= 0;
  return !['tax', 'loan'].includes(e.k);
}

function VidaEnd({ view, lobby, isHost, onPlayAgain, onBackToLobby, onLeave, t }: Inner) {
  const scores = [...(view.scores ?? [])].sort((a, b) => b.total - a.total);
  const winner = view.players[view.winner!]!;
  return (
    <section className="end vida__end">
      <h1>{t('endTitle', { name: winner.name })}</h1>
      <div className="panel vida__scores">
        <table>
          <thead>
            <tr>
              <th />
              <th>{t('colCash')}</th>
              <th>{t('colHouse')}</th>
              <th>{t('colTiles')}</th>
              <th>{t('colLoans')}</th>
              <th>{t('colTotal')}</th>
            </tr>
          </thead>
          <tbody>
            {scores.map(s => {
              const p = view.players[s.seat]!;
              return (
                <tr key={s.seat} className={s.seat === view.winner ? 'is-winner' : ''}>
                  <td>
                    <Avatar name={p.name} color={playerColor(lobby, p.id)} /> {p.name}
                  </td>
                  <td>{money(s.cash)}</td>
                  <td>{money(s.house)}</td>
                  <td title={(p.tileValues ?? []).map(money).join(' + ')}>{money(s.tiles)}</td>
                  <td>{s.loans > 0 ? `−${money(s.loans)}` : '—'}</td>
                  <td>
                    <b>{money(s.total)}</b>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <EndActions isHost={isHost} onPlayAgain={onPlayAgain} onBackToLobby={onBackToLobby} onLeave={onLeave} playAgain={t('playAgain')} />
    </section>
  );
}

const WHEEL_COLORS = ['#c8372d', '#f2b632', '#2f7a35', '#2c4ba8', '#6b3f9f', '#17716f', '#b83c78', '#a66509', '#4a5568', '#d4380d'];

/** The spinner: SPIN_MAX numbered slices that spin several turns and stop with `n` under the pointer. */
function Wheel({ n }: { n: number }) {
  const [turn, setTurn] = useState(0);
  const slice = 360 / SPIN_MAX;
  useLayoutEffect(() => {
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setTurn(5 * 360 - ((n - 1) * slice + slice / 2)));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, []);
  const colors = WHEEL_COLORS.slice(0, SPIN_MAX);
  const slices = colors.map((c, i) => `${c} ${i * slice}deg ${(i + 1) * slice}deg`).join(', ');
  return (
    <div className="vida__wheelstage" aria-hidden="true">
      <span className="vida__pointer" />
      <div className="vida__bigwheel" style={{ background: `conic-gradient(${slices})`, transform: `rotate(${turn}deg)` }}>
        {colors.map((_, i) => (
          <span key={i} style={{ transform: `rotate(${i * slice + slice / 2}deg)` }}>
            {i + 1}
          </span>
        ))}
      </div>
    </div>
  );
}

/** What just happened, as a card that pops over the board for a moment. */
function EventCard({ entry, view, lobby, t }: { entry: VidaLog; view: VidaView; lobby: LobbyState; t: TextFn }) {
  const seat = 'seat' in entry ? entry.seat : null;
  const who = seat === null ? null : view.players[seat];
  return (
    <div className={`vida__event ${isGood(entry) ? 'is-good' : 'is-bad'}`} role="status">
      <span className="vida__eventicon" aria-hidden="true">{eventIcon(entry)}</span>
      <span className="vida__eventtext">{logLine(entry, view, t)}</span>
      {who && <span className="vida__eventwho" style={{ background: playerColor(lobby, who.id) }} />}
    </div>
  );
}
