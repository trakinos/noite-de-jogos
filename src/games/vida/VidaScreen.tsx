import { useState } from 'react';
import { useLang } from '../../i18n/LangProvider';
import { pieceEmoji } from '../../theme/playerPieces';
import { Avatar } from '../../ui/components/Avatar';
import { playerColor } from '../../ui/playerColor';
import { EndActions, GameFrame, RulesSheet, useGameText, useReason, type GameScreenProps, type TextFn } from '../shared/GameFrame';
import { BOARD, CAREER_START, CAREERS, HOUSES, LOAN_PAYBACK, type Square } from './board';
import { asVidaView, type VidaLog, type VidaView } from './game';
import { RULE_KEYS, VIDA_TEXT } from './text';

const COLS = 9;
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

function squareIcon(sq: Square): string {
  switch (sq.k) {
    case 'payday': return '💵';
    case 'cash': return sq.n >= 0 ? '💰' : '💳';
    case 'raise': return '📈';
    case 'life': return '⭐';
    case 'baby': return sq.n === 2 ? '👶👶' : '👶';
    case 'tax': return '🧾';
    case 'sue': return '⚖️';
    case 'blank': return '💼';
    case 'stop':
      return { graduate: '🎓', marry: '💍', house: '🏠', retire: '🌅' }[sq.s];
  }
}

function squareText(sq: Square, t: TextFn): { label: string; amount?: string } {
  switch (sq.k) {
    case 'payday': return { label: t('sq_payday') };
    case 'cash': return { label: t(`t_${sq.t}`), amount: `${sq.n >= 0 ? '+' : '−'}${money(Math.abs(sq.n))}` };
    case 'raise': return { label: t(`t_${sq.t}`), amount: `+${money(sq.n)}` };
    case 'life': return { label: t(`t_${sq.t}`) };
    case 'baby': return { label: t(sq.n === 2 ? 'sq_twins' : 'sq_baby') };
    case 'tax': return { label: t('sq_tax') };
    case 'sue': return { label: t('sq_sue') };
    case 'blank': return { label: t(`t_${sq.t}`) };
    case 'stop': return { label: t(`sq_${sq.s}`) };
  }
}

/** Grid row and column for cell `i` (0 is the start), snaking left-right then right-left. */
function place(i: number): { gridRow: number; gridColumn: number } {
  const row = Math.floor(i / COLS);
  const col = i % COLS;
  return { gridRow: row + 1, gridColumn: (row % 2 === 0 ? col : COLS - 1 - col) + 1 };
}

function VidaTable({ view, lobby, awaiting, onIntent, t }: Inner) {
  const current = view.players[view.current]!;
  const myTurn = view.current === view.me;
  const me = view.players[view.me]!;
  const tokens = (pos: number) =>
    view.players.map((p, i) => ({ p, i })).filter(({ p }) => (pos === -1 ? !p.started || p.pos === -1 : p.started && p.pos === pos));

  const cells = [-1, ...BOARD.map((_, i) => i)];
  return (
    <div className="vida__table">
      <div className="vida__board" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
        {cells.map((pos, i) => {
          const sq = pos >= 0 ? BOARD[pos]! : null;
          const text = sq ? squareText(sq, t) : { label: t('start') };
          const here = tokens(pos);
          const kind = sq ? (sq.k === 'stop' ? `stop vida__sq--${sq.s}` : sq.k) : 'start';
          return (
            <div
              key={pos}
              className={`vida__sq vida__sq--${kind}${pos >= 0 && pos < CAREER_START ? ' is-campus' : ''}${pos === CAREER_START ? ' is-career-start' : ''}`}
              style={place(i)}
              title={text.label}
            >
              <span className="vida__icon" aria-hidden="true">{sq ? squareIcon(sq) : '🚩'}</span>
              <span className="vida__label">{text.label}</span>
              {text.amount && <span className="vida__amount">{text.amount}</span>}
              {here.length > 0 && (
                <span className="vida__tokens">
                  {here.map(({ p, i: seat }) => (
                    <span
                      key={p.id}
                      className={`vida__token${seat === view.current ? ' is-current' : ''}`}
                      style={{ background: playerColor(lobby, p.id) }}
                      title={p.name}
                    >
                      {pieceEmoji(lobby.players.find(lp => lp.id === p.id)?.piece) ?? p.name.charAt(0)}
                    </span>
                  ))}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <aside className="vida__side">
        <section className={`panel vida__turn${myTurn ? ' is-mine' : ''}`}>
          <h2>{myTurn ? t('yourTurn') : t('theirTurn', { name: current.name })}</h2>
          {view.lastSpin && (
            <p className="vida__spin">
              <span className="vida__wheel" aria-hidden="true">{view.lastSpin.n}</span>
              {view.players[view.lastSpin.seat]!.name}: {t('spun', { n: view.lastSpin.n })}
            </p>
          )}
          {myTurn ? <Actions view={view} awaiting={awaiting} onIntent={onIntent} t={t} /> : view.choosing && <p className="muted">{t('choosing', { name: current.name })}</p>}
          {me.loans > 0 && me.cash >= LOAN_PAYBACK && myTurn && !view.prompt && (
            <button type="button" className="vida__repay" disabled={awaiting} onClick={() => onIntent({ type: 'repay' })}>
              {t('repay')}
            </button>
          )}
        </section>

        <section className="panel vida__players">
          {view.players.map((p, i) => (
            <div key={p.id} className={`vida__player${i === view.current ? ' is-turn' : ''}`}>
              <Avatar name={p.name} color={playerColor(lobby, p.id)} piece={pieceEmoji(lobby.players.find(lp => lp.id === p.id)?.piece)} />
              <div>
                <b>{p.name}</b> <span className="vida__cash">{money(p.cash)}</span>
                <div className="muted vida__facts">
                  {p.career ? `${t(`c_${p.career}`)} · ${t('salary', { n: money(p.salary) })}` : t('noCareer')}
                  {p.loans > 0 && ` · ${t('loans', { n: p.loans })}`}
                  {p.married && ` · 💍 ${t('married')}`}
                  {p.kids > 0 && ` · ${t('kids', { n: p.kids })}`}
                  {p.house && ` · 🏠 ${t(`h_${p.house}`)}`}
                  {p.tiles > 0 && ` · ⭐ ${t('tiles', { n: p.tiles })}`}
                  {p.retired && ` · ${t(`retired_${p.retired}`)}`}
                </div>
              </div>
            </div>
          ))}
        </section>

        <details className="panel vida__log" open>
          <summary>{t('log')}</summary>
          <ol>
            {view.log.slice(-14).reverse().map((entry, i) => (
              <li key={i}>{logLine(entry, view, t)}</li>
            ))}
          </ol>
        </details>
      </aside>
    </div>
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
          <h3>{t('chooseCareer')}</h3>
          {prompt.options.map(id => {
            const c = CAREERS.find(x => x.id === id)!;
            return choice(id, `${c.degree ? '🎓 ' : ''}${t(`c_${id}`)}`, t('salary', { n: money(c.salary) }), { type: 'career', career: id });
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
    case 'retire': return t(`log_retire_${e.where}`, { name });
    case 'mansion': return e.seat === null ? t('log_mansionTie') : t('log_mansion', { name });
  }
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
