import { useEffect, useRef, useState } from 'react';
import { useLang } from '../../i18n/LangProvider';
import { Avatar } from '../../ui/components/Avatar';
import { playerColor } from '../../ui/playerColor';
import { EndActions, GameFrame, RulesSheet, useGameText, useReason, type GameScreenProps, type TextFn } from '../shared/GameFrame';
import { asPistaView, MAX_CLUE, MAX_CLUE_LENGTH, type PistaLog, type PistaView, type Team } from './game';
import { PISTA_TEXT, RULE_KEYS } from './text';
import { playSound } from '../shared/sound';

const TEAMS: Team[] = ['red', 'blue'];

export function PistaScreen(props: GameScreenProps) {
  const view = asPistaView(props.view);
  const t = useGameText(PISTA_TEXT);
  const reason = useReason(t);
  const [rules, setRules] = useState(false);
  const over = view.winner !== null;
  return (
    <GameFrame
      title={useLang().tr.t('gamePistaName')}
      code={props.code}
      clock={over || view.phase === 'teams' ? null : props.clock}
      error={props.error}
      reason={reason}
      onDismissError={props.onDismissError}
      onEndGame={over ? undefined : props.onEndGame}
      onRules={() => setRules(true)}
      className="pista"
    >
      {view.phase === 'teams' ? <Teams {...props} view={view} t={t} /> : <Table {...props} view={view} t={t} />}
      {rules && <RulesSheet title={t('rulesTitle')} paragraphs={RULE_KEYS.map(k => t(k))} onClose={() => setRules(false)} />}
    </GameFrame>
  );
}

type Inner = Omit<GameScreenProps, 'view'> & { view: PistaView; t: TextFn };

function Teams({ view, lobby, awaiting, onIntent, t }: Inner) {
  const mine = view.players[view.me]!;
  return (
    <section className="panel pista__teams">
      <h2>{t('pickTeams')}</h2>
      <p>{t(view.mode === 'solo' ? 'pickSoloHint' : 'pickTeamsHint')}</p>
      <div className={`pista__cols${view.mode === 'solo' ? ' is-solo' : ''}`}>
        {(view.mode === 'solo' ? (['red'] as Team[]) : TEAMS).map(team => (
          <div key={team} className={`pista__team pista__team--${team}`}>
            <h3>{view.mode === 'solo' ? t('yourTeam') : t(team === 'red' ? 'teamRed' : 'teamBlue')}</h3>
            <ul>
              {view.players.map((p, i) =>
                p.team !== team ? null : (
                  <li key={p.id}>
                    <Avatar name={p.name} color={playerColor(lobby, p.id)} />
                    <span>
                      {p.name}
                      {i === view.me && <span className="muted"> ({t('you')})</span>}
                    </span>
                    <span className={`pill${p.role === 'chief' ? ' pill--accent' : ''}`}>{t(p.role)}</span>
                  </li>
                ),
              )}
            </ul>
            <div className="actions">
              {!(mine.team === team && mine.role === 'guess') && (
                <button type="button" disabled={awaiting} onClick={() => onIntent({ type: 'join', team, role: 'guess' })}>
                  {t('joinAsGuess')}
                </button>
              )}
              {!(mine.team === team && mine.role === 'chief') && (
                <button type="button" disabled={awaiting} onClick={() => onIntent({ type: 'join', team, role: 'chief' })}>
                  {t('joinAsChief')}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="actions actions--center">
        <button type="button" className="primary lg" disabled={awaiting || view.notReady !== null} onClick={() => onIntent({ type: 'begin' })}>
          {t('begin')}
        </button>
      </div>
    </section>
  );
}

function Table({ view, lobby, awaiting, onIntent, isHost, onPlayAgain, onBackToLobby, onLeave, t }: Inner) {
  const me = view.players[view.me]!;
  const over = view.winner !== null;
  const solo = view.mode === 'solo';
  const teamName = (team: Team) => (solo ? t(team === 'red' ? 'yourTeam' : 'rival') : t(team));
  usePistaSounds(view);
  const myClue = !over && view.phase === 'clue' && me.team === view.turn && me.role === 'chief';
  const myGuess = !over && view.phase === 'guess' && me.team === view.turn && me.role === 'guess';
  const markers = (card: number) => view.marks.map((m, i) => (m === card ? i : -1)).filter(i => i >= 0);

  let status: string;
  if (over && solo) status = t(view.winner === 'red' ? 'soloWin' : 'soloLose');
  else if (over) status = t('win', { team: teamName(view.winner!) });
  else if (view.phase === 'clue') status = myClue ? t('yourClue') : t('turnClue', { team: teamName(view.turn) });
  else status = myGuess ? t('yourGuess') : t('theyGuess', { team: teamName(view.turn) });

  return (
    <div className="pista__table">
      <div className="pista__score">
        {TEAMS.map(team => (
          <span key={team} className={`pista__count pista__count--${team}${view.turn === team && !over ? ' is-turn' : ''}`}>
            <b>{teamName(team)}</b> {t('left', { n: view.left[team] })}
          </span>
        ))}
      </div>

      <div className={`pista__status pista__status--${over ? view.winner : view.turn}`}>
        <b>{status}</b>
        {over && <span>{t(solo && view.winner === 'blue' && view.endReason === 'found' ? 'end_rival' : `end_${view.endReason}`)}</span>}
        {!over && view.clue && (
          <span className="pista__clue">
            {t('clue', { word: view.clue.word.toUpperCase(), count: view.clue.count })} ·{' '}
            {view.guessesLeft === null ? t('guessesUnlimited') : t('guessesLeft', { n: view.guessesLeft })}
          </span>
        )}
      </div>

      {myClue && <ClueForm awaiting={awaiting} onIntent={onIntent} t={t} />}

      <div className={`pista__grid${me.role === 'chief' || over ? ' is-chief' : ''}`}>
        {view.words.map((word, i) => {
          const kind = view.kinds[i];
          const revealed = view.revealed[i];
          const marks = markers(i);
          const markedByMe = view.marks[view.me] === i;
          return (
            <div
              key={i}
              className={`pista__card${kind ? ` is-${kind}` : ''}${revealed ? ' is-revealed' : ''}${markedByMe ? ' is-marked' : ''}`}
            >
              <button
                type="button"
                className="pista__word"
                disabled={!myGuess || revealed || awaiting}
                onClick={() => onIntent({ type: 'mark', card: i })}
              >
                {word}
              </button>
              {marks.length > 0 && !revealed && (
                <span className="pista__marks">
                  {marks.map(seat => (
                    <span key={seat} className="pista__mark" style={{ background: playerColor(lobby, view.players[seat]!.id) }} title={view.players[seat]!.name}>
                      {view.players[seat]!.name.charAt(0).toUpperCase()}
                    </span>
                  ))}
                </span>
              )}
              {myGuess && markedByMe && !revealed && (
                <button type="button" className="primary pista__reveal" disabled={awaiting} onClick={() => onIntent({ type: 'reveal', card: i })}>
                  {t('reveal')}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {myGuess && view.guessesMade > 0 && (
        <div className="actions actions--center">
          <button type="button" disabled={awaiting} onClick={() => onIntent({ type: 'pass' })}>
            {t('pass')}
          </button>
        </div>
      )}

      {over && <EndActions isHost={isHost} onPlayAgain={onPlayAgain} onBackToLobby={onBackToLobby} onLeave={onLeave} playAgain={t('playAgain')} />}

      <div className="pista__bottom">
        {(solo ? (['red'] as Team[]) : TEAMS).map(team => (
          <div key={team} className={`pista__roster pista__roster--${team}`}>
            {view.players.map((p, i) =>
              p.team !== team ? null : (
                <span key={p.id} className="pista__member">
                  <Avatar name={p.name} color={playerColor(lobby, p.id)} />
                  {p.name}
                  {i === view.me && <span className="muted"> ({t('you')})</span>}
                  {p.role === 'chief' && <span className="pill pill--accent">{t('chief')}</span>}
                </span>
              ),
            )}
          </div>
        ))}
        <details className="pista__log" open>
          <summary>{t('log')}</summary>
          <ol>
            {view.log.slice(-12).reverse().map((entry, i) => (
              <li key={i} className={`pista__logline pista__logline--${entry.kind === 'reveal' ? entry.card : entry.team}`}>
                {logLine(entry, view, t)}
              </li>
            ))}
          </ol>
        </details>
      </div>
    </div>
  );
}

function ClueForm({ awaiting, onIntent, t }: { awaiting: boolean; onIntent(i: unknown): void; t: TextFn }) {
  const [word, setWord] = useState('');
  const [count, setCount] = useState(1);
  const clean = word.trim();
  return (
    <form
      className="panel pista__form"
      onSubmit={e => {
        e.preventDefault();
        if (clean && !awaiting) onIntent({ type: 'clue', word: clean, count });
      }}
    >
      <label className="field">
        {t('clueWord')}
        <input value={word} maxLength={MAX_CLUE_LENGTH} autoFocus onChange={e => setWord(e.target.value.replace(/\s/g, ''))} />
      </label>
      <label className="field">
        {t('clueCount')}
        <select value={count} onChange={e => setCount(Number(e.target.value))}>
          {Array.from({ length: MAX_CLUE + 1 }, (_, n) => (
            <option key={n} value={n}>
              {n === 0 ? t('unlimited') : n}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="primary" disabled={!clean || awaiting}>
        {t('give')}
      </button>
    </form>
  );
}

function logLine(entry: PistaLog, view: PistaView, t: TextFn): string {
  const name = (seat: number | null) => (seat === null ? '' : view.players[seat]?.name ?? '—');
  switch (entry.kind) {
    case 'clue':
      return t('log_clue', { name: name(entry.seat), word: entry.word.toUpperCase(), count: entry.count });
    case 'reveal': {
      const kind = entry.card === 'red' || entry.card === 'blue' ? t(entry.card) : t(`kind_${entry.card}`);
      const line =
        entry.seat === null
          ? t(view.mode === 'solo' && entry.team === 'blue' ? 'log_rival' : 'log_revealTimeout', { word: entry.word })
          : t('log_reveal', { name: name(entry.seat), word: entry.word });
      return `${line} (${kind})`;
    }
    case 'pass':
      return entry.seat === null ? t('log_timeout', { team: t(entry.team) }) : t('log_pass', { name: name(entry.seat) });
    case 'win':
      return t('log_win', { team: t(entry.team) });
  }
}

/** A pop for every word revealed (a boom for the bomb), then a fanfare or a sad tune at the end. */
function usePistaSounds(view: PistaView) {
  // The chief's clue arrives: the table goes from no clue to one.
  const hasClue = view.clue !== null;
  const hadClue = useRef(hasClue);
  useEffect(() => {
    if (hasClue && !hadClue.current && !view.winner) playSound('clue');
    hadClue.current = hasClue;
  }, [hasClue]);

  const revealed = view.revealed.filter(Boolean).length;
  const seen = useRef(revealed);
  useEffect(() => {
    if (revealed <= seen.current) return void (seen.current = revealed);
    seen.current = revealed;
    const last = [...view.log].reverse().find(e => e.kind === 'reveal');
    playSound(last && last.kind === 'reveal' && last.card === 'bomb' ? 'sunk' : 'pop');
    if (view.winner) {
      const me = view.players[view.me]!;
      const timer = setTimeout(() => playSound(view.winner === me.team ? 'win' : 'lose'), 700);
      return () => clearTimeout(timer);
    }
  }, [revealed]);
}
