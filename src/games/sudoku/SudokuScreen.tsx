import { useEffect, useRef, useState } from 'react';
import { useLang } from '../../i18n/LangProvider';
import { Avatar } from '../../ui/components/Avatar';
import { playerColor } from '../../ui/playerColor';
import { EndActions, GameFrame, RulesSheet, useGameText, useReason, type GameScreenProps, type Texts } from '../shared/GameFrame';
import { SimpleLobby, type LobbyProps } from '../shared/SimpleLobby';
import { playSound } from '../shared/sound';
import { asSudokuView, peers, RACE_MAX_MISTAKES, sudokuModule, type SudokuView } from './game';

export const SUDOKU_RULES = ['rules1', 'rules2', 'rules3'];

export const SUDOKU_TEXT: Texts = {
  pt: {
    rulesTitle: 'Regras do Sudoku',
    rules1: 'Preencha a grade 9×9 de modo que cada linha, cada coluna e cada quadrado 3×3 tenha todos os números de 1 a 9, sem repetir. Os números já na grade são as pistas.',
    rules2: 'Toque numa casa e depois num número. Número errado não entra: conta como erro. Use o lápis para anotar candidatos sem se comprometer.',
    rules3: 'Em dupla ou grupo (cooperativo), todos preenchem a mesma grade. Na corrida, cada um tem a sua grade e vence quem terminar primeiro, mas 4 erros tiram você da corrida. No solo, cada um resolve o mesmo quebra-cabeça no seu ritmo, sem vencedor.',
    lobbyMode: 'Modo',
    lobbyLevel: 'Nível',
    mode_coop: 'Cooperativo',
    mode_race: 'Corrida',
    mode_solo: 'Solo',
    level_easy: 'Fácil',
    level_medium: 'Médio',
    level_hard: 'Difícil',
    pencil: 'Lápis',
    erase: 'Apagar',
    mistakes: 'erros: {n}',
    time: 'Tempo',
    filledOf: '{n}/81',
    doneCoop: 'Vocês completaram o Sudoku!',
    doneRace: '{name} terminou primeiro!',
    doneSolo: 'Todos terminaram!',
    youDone: 'Você terminou! Esperando os outros…',
    finishedAt: 'terminou em {time}',
    mistakesMax: 'erros: {n}/{max}',
    doneRaceNone: 'Todos estouraram o limite de erros. Ninguém venceu!',
    youOut: 'Você estourou o limite de erros e saiu da corrida. Os outros continuam…',
    outTag: 'fora da corrida',
    total: 'Tempo total: {time}',
    playAgain: 'Jogar de novo',
    'reason:Wrong digit': 'Esse número não vai aí.',
    'reason:That square is given': 'Essa casa é uma pista.',
    'reason:That square is filled': 'Essa casa já está preenchida.',
    'reason:You already finished': 'Você já terminou.',
    'reason:You are out of the race': 'Você saiu da corrida.',
  },
  en: {
    rulesTitle: 'Sudoku rules',
    rules1: 'Fill the 9×9 grid so every row, every column and every 3×3 box holds each number from 1 to 9 exactly once. The numbers already on the grid are the clues.',
    rules2: 'Tap a square, then a number. A wrong number does not go in: it counts as a mistake. Use the pencil to jot candidates without committing.',
    rules3: 'In co-op, everyone fills the same grid. In a race, each player has their own grid and whoever finishes first wins, but 4 mistakes put you out. In solo, everyone solves the same puzzle at their own pace, with no winner.',
    lobbyMode: 'Mode',
    lobbyLevel: 'Level',
    mode_coop: 'Co-op',
    mode_race: 'Race',
    mode_solo: 'Solo',
    level_easy: 'Easy',
    level_medium: 'Medium',
    level_hard: 'Hard',
    pencil: 'Pencil',
    erase: 'Erase',
    mistakes: 'mistakes: {n}',
    time: 'Time',
    filledOf: '{n}/81',
    doneCoop: 'You solved the Sudoku together!',
    doneRace: '{name} finished first!',
    doneSolo: 'Everyone finished!',
    youDone: 'You finished! Waiting for the others…',
    finishedAt: 'finished in {time}',
    mistakesMax: 'mistakes: {n}/{max}',
    doneRaceNone: 'Everyone hit the mistake limit. Nobody won!',
    youOut: "You hit the mistake limit and are out of the race. The others play on…",
    outTag: 'out of the race',
    total: 'Total time: {time}',
    playAgain: 'Play again',
    'reason:Wrong digit': "That number doesn't go there.",
    'reason:That square is given': 'That square is a clue.',
    'reason:That square is filled': 'That square is already filled.',
    'reason:You already finished': 'You already finished.',
    'reason:You are out of the race': 'You are out of the race.',
  },
};

export function SudokuLobby(props: LobbyProps) {
  const t = useGameText(SUDOKU_TEXT);
  const parsed = sudokuModule.parseOptions(props.lobby.options);
  const { mode, level } = 'error' in parsed ? sudokuModule.defaultOptions() : parsed;
  const set = (patch: Record<string, string>) => props.host!.setOptions({ mode, level, ...patch });
  const pick = (key: 'mode' | 'level', value: string, values: string[], prefix: string, label: string) => (
    <div className="bsetting">
      {props.host ? (
        <label className="bsetting__select">
          <span>{label}</span>
          <select value={value} onChange={e => set({ [key]: e.target.value })}>
            {values.map(v => (
              <option key={v} value={v}>
                {t(`${prefix}_${v}`)}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <b>
          {label}: {t(`${prefix}_${value}`)}
        </b>
      )}
    </div>
  );
  const options = (
    <>
      {pick('mode', mode, ['coop', 'race', 'solo'], 'mode', t('lobbyMode'))}
      {pick('level', level, ['easy', 'medium', 'hard'], 'level', t('lobbyLevel'))}
    </>
  );
  return <SimpleLobby {...props} options={options} rules={{ title: t('rulesTitle'), paragraphs: SUDOKU_RULES.map(k => t(k)) }} />;
}

export function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}


export function SudokuScreen(props: GameScreenProps) {
  const view = asSudokuView(props.view);
  const t = useGameText(SUDOKU_TEXT);
  const reason = useReason(t);
  const [rules, setRules] = useState(false);
  const [sel, setSel] = useState<number | null>(null);
  const [pencil, setPencil] = useState(false);
  const [notes, setNotes] = useState<Record<number, number[]>>({});
  const [shake, setShake] = useState(0);
  /** The digit whose placed copies and pencil marks are highlighted: the last one tapped on the pad or on the grid. */
  const [focus, setFocus] = useState(0);
  const { lobby, awaiting, onIntent } = props;
  const mine = view.finished.includes(view.me);
  const out = view.out.includes(view.me);
  const locked = view.done || mine || out;

  const base = useRef({ at: Date.now(), ms: view.elapsedMs });
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    base.current = { at: Date.now(), ms: view.elapsedMs };
  }, [view.elapsedMs, view.done]);
  useEffect(() => {
    if (view.done) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [view.done]);
  const elapsed = view.done ? view.elapsedMs : base.current.ms + (now - base.current.at);

  const heard = useRef({ filled: view.grid.filter(Boolean).length, mistakes: view.mistakes[view.me]!, done: view.done });
  useEffect(() => {
    const filled = view.grid.filter(Boolean).length;
    const before = heard.current;
    heard.current = { filled, mistakes: view.mistakes[view.me]!, done: view.done };
    if (view.mistakes[view.me]! > before.mistakes) {
      playSound('wrong');
      setShake(n => n + 1);
    } else if (filled > before.filled) playSound('pop');
    if (view.done && !before.done) playSound(view.mode === 'race' && view.winner !== view.me ? 'lose' : 'win');
  }, [view.grid, view.mistakes, view.done]);

  // Co-op: cells another player just filled glow for a moment, in that player's color.
  const [fresh, setFresh] = useState<Record<number, number>>({});
  const prevGrid = useRef(view.grid);
  useEffect(() => {
    const before = prevGrid.current;
    prevGrid.current = view.grid;
    if (view.mode !== 'coop' || before === view.grid) return;
    const added = view.grid.flatMap((v, i) => (v !== 0 && before[i] === 0 && view.placedBy[i] !== view.me && view.placedBy[i]! >= 0 ? [i] : []));
    if (added.length === 0) return;
    setFresh(f => ({ ...f, ...Object.fromEntries(added.map(i => [i, view.placedBy[i]!])) }));
    const timer = setTimeout(() => setFresh(f => Object.fromEntries(Object.entries(f).filter(([k]) => !added.includes(Number(k))))), 3000);
    return () => clearTimeout(timer);
  }, [view.grid]);

  // A mark for a digit that already sits in the cell's row, column or box can't be right any more: drop it, whoever placed that digit.
  useEffect(() => {
    setNotes(n => {
      let next: Record<number, number[]> | null = null;
      for (const [key, digits] of Object.entries(n)) {
        const cell = Number(key);
        const keep = view.grid[cell] !== 0 ? [] : digits.filter(d => !peers(cell).some(p => view.grid[p] === d));
        if (keep.length === digits.length) continue;
        next ??= { ...n };
        if (keep.length === 0) delete next[cell];
        else next[cell] = keep;
      }
      return next ?? n;
    });
  }, [view.grid]);

  // Coop: the others see my pencil marks. One move travels at a time, so changes wait their turn and go one cell per round trip.
  const sentNotes = useRef<Record<number, string>>({});
  useEffect(() => {
    if (view.mode !== 'coop' || awaiting || view.done) return;
    for (const key of new Set([...Object.keys(notes), ...Object.keys(sentNotes.current)])) {
      const cell = Number(key);
      const digits = view.grid[cell] === 0 ? notes[cell] ?? [] : [];
      if ((sentNotes.current[cell] ?? '') === digits.join('')) continue;
      sentNotes.current[cell] = digits.join('');
      onIntent({ type: 'notes', cell, digits });
      return;
    }
  }, [notes, awaiting, view.grid, view.mode, view.done]);

  const place = (digit: number) => {
    setFocus(digit);
    if (sel === null || locked || awaiting) return;
    if (view.grid[sel] !== 0) return;
    if (pencil) {
      const cur = notes[sel] ?? [];
      const digits = cur.includes(digit) ? cur.filter(d => d !== digit) : [...cur, digit].sort();
      setNotes(n => ({ ...n, [sel]: digits }));
      return;
    }
    onIntent({ type: 'set', cell: sel, value: digit });
    // A correct digit clears its own notes and strikes the digit from the notes of its peers.
    setNotes(n => {
      const next: Record<number, number[]> = { ...n };
      delete next[sel];
      for (const p of peers(sel)) if (next[p]?.includes(digit)) next[p] = next[p]!.filter(d => d !== digit);
      return next;
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[1-9]$/.test(e.key)) place(Number(e.key));
      else if (e.key === 'p' || e.key === 'P') setPencil(p => !p);
      else if (sel !== null && e.key.startsWith('Arrow')) {
        e.preventDefault();
        const d = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 }[e.key] ?? 0;
        const r = Math.floor(sel / 9) + (d === -9 ? -1 : d === 9 ? 1 : 0);
        const c = (sel % 9) + (d === -1 ? -1 : d === 1 ? 1 : 0);
        if (r >= 0 && r < 9 && c >= 0 && c < 9) setSel(r * 9 + c);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const counts = Array(10).fill(0) as number[];
  for (const v of view.grid) counts[v]!++;
  const selDigit = focus;
  const near = sel !== null ? new Set(peers(sel)) : new Set<number>();

  let status = '';
  if (view.done) {
    if (view.mode === 'coop') status = t('doneCoop');
    else if (view.mode === 'race') status = view.winner === null ? t('doneRaceNone') : t('doneRace', { name: view.players[view.winner]!.name });
    else status = t('doneSolo');
  } else if (out) status = t('youOut');
  else if (mine) status = t('youDone');

  return (
    <GameFrame
      title={useLang().tr.t('gameSudokuName')}
      code={props.code}
      clock={null}
      error={props.error}
      reason={reason}
      onDismissError={props.onDismissError}
      onEndGame={view.done ? undefined : props.onEndGame}
      onRules={() => setRules(true)}
      className="sudoku"
    >
      <div className="sudoku__table">
        <p className="muted sudoku__meta">
          {t(`mode_${view.mode}`)} · {t(`level_${view.level}`)} · {t('time')} {formatTime(elapsed)}
        </p>
        {view.players.length > 1 && <Progress view={view} lobby={lobby} t={t} />}
        <p className={`sudoku__status${view.done ? ' is-done' : ''}`}>{status || ' '}</p>
        <div className="sudoku__board" key={shake} data-shake={shake > 0 ? '1' : undefined}>
          {view.grid.map((v, i) => {
            const given = view.givens[i] !== 0;
            const owner = view.mode === 'coop' && !given && v !== 0 ? view.placedBy[i]! : -1;
            const cls = ['sudoku__cell'];
            if (given) cls.push('is-given');
            if (i === sel) cls.push('is-sel');
            else if (near.has(i)) cls.push('is-near');
            if (fresh[i] !== undefined) cls.push('is-fresh');
            if (selDigit && v === selDigit) cls.push('is-same');
            if (Math.floor(i / 9) % 3 === 2 && i < 72) cls.push('row-end');
            if (i % 9 % 3 === 2 && i % 9 < 8) cls.push('col-end');
            return (
              <button
                key={i}
                type="button"
                className={cls.join(' ')}
                onClick={() => {
                  setSel(i);
                  if (v) setFocus(v);
                }}
                aria-label={`${Math.floor(i / 9) + 1},${(i % 9) + 1} ${v || ''}`}
                style={owner >= 0 ? ({ color: playerColor(lobby, view.players[owner]!.id), '--fresh': fresh[i] !== undefined ? playerColor(lobby, view.players[fresh[i]!]!.id) : undefined } as React.CSSProperties) : undefined}
              >
                {v !== 0 ? v : <Marks mine={notes[i] ?? []} others={view.notes.flatMap((m, seat) => (seat === view.me ? [] : [{ seat, digits: m[i] ?? [] }]))} color={seat => playerColor(lobby, view.players[seat]!.id)} />}
              </button>
            );
          })}
        </div>
        {!locked && (
          <>
            <div className="sudoku__pad">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => (
                <button key={d} type="button" disabled={counts[d]! >= 9 || sel === null || awaiting} onClick={() => place(d)}>
                  {d}
                  <small>{9 - counts[d]!}</small>
                </button>
              ))}
            </div>
            <div className="actions actions--center">
              <button type="button" className={pencil ? 'primary' : ''} aria-pressed={pencil} onClick={() => setPencil(p => !p)}>
                ✎ {t('pencil')}
              </button>
              <span className="muted">{view.mode === 'race' ? t('mistakesMax', { n: view.mistakes[view.me]!, max: RACE_MAX_MISTAKES }) : t('mistakes', { n: view.mistakes[view.me]! })}</span>
            </div>
          </>
        )}
        {view.done && (
          <>
            <p className="muted">{t('total', { time: formatTime(view.elapsedMs) })} · {t('mistakes', { n: view.mistakes.reduce((a, b) => a + b, 0) })}</p>
            <EndActions isHost={props.isHost} onPlayAgain={props.onPlayAgain} onBackToLobby={props.onBackToLobby} onLeave={props.onLeave} playAgain={t('playAgain')} />
          </>
        )}
      </div>
      {rules && <RulesSheet title={t('rulesTitle')} paragraphs={SUDOKU_RULES.map(k => t(k))} onClose={() => setRules(false)} />}
    </GameFrame>
  );
}

function Progress({ view, lobby, t }: { view: SudokuView; lobby: GameScreenProps['lobby']; t: ReturnType<typeof useGameText> }) {
  return (
    <div className="sudoku__players">
      {view.players.map((p, i) => {
        const left = view.mode === 'coop' ? null : view.finishMs[i];
        return (
          <div key={p.id} className={`sudoku__player${i === view.me ? ' is-me' : ''}`}>
            <Avatar name={p.name} color={playerColor(lobby, p.id)} />
            <b>{p.name}</b>
            <span className="muted">
              {view.out.includes(i) ? t('outTag') : left !== null && left !== undefined ? t('finishedAt', { time: formatTime(left) }) : view.mode === 'coop' ? t('mistakes', { n: view.mistakes[i]! }) : t('filledOf', { n: view.filled[i]! })}
            </span>
            {view.mode !== 'coop' && <progress max={81} value={view.filled[i]} />}
          </div>
        );
      })}
    </div>
  );
}

/** The pencil marks in a cell: mine in the text color, and in co-op the other players' in theirs. */
function Marks({ mine, others, color }: { mine: number[]; others: { seat: number; digits: number[] }[]; color(seat: number): string }) {
  const theirs = others.filter(o => o.digits.length > 0);
  if (mine.length === 0 && theirs.length === 0) return null;
  return (
    <span className="sudoku__notes" aria-hidden="true">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => {
        const other = mine.includes(d) ? undefined : theirs.find(o => o.digits.includes(d));
        return (
          <i key={d} style={other ? { color: color(other.seat) } : undefined}>
            {mine.includes(d) || other ? d : ''}
          </i>
        );
      })}
    </span>
  );
}
