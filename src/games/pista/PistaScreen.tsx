import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useLang } from '../../i18n/LangProvider';
import { Avatar } from '../../ui/components/Avatar';
import { playerColor } from '../../ui/playerColor';
import { EndActions, GameFrame, RulesSheet, useGameText, useReason, type GameScreenProps, type TextFn } from '../shared/GameFrame';
import { asPistaView, MAX_CLUE, MAX_CLUE_LENGTH, TEAM_COLORS, type PistaLog, type PistaView, type Team } from './game';
import { PISTA_TEXT, RULE_KEYS } from './text';
import { playSound } from '../shared/sound';

const TEAMS: Team[] = ['red', 'blue'];

/** Points the two team slots' CSS variables at the colours the teams picked; everything team-coloured reads these. */
function teamColors(view: PistaView): CSSProperties {
  return { '--red': `var(--pc-${view.colors.red})`, '--blue': `var(--pc-${view.colors.blue})` } as CSSProperties;
}

/** What a team is called: its colour, or "your team" / "rival" when there is only one team of players. */
function teamNamer(view: PistaView, t: TextFn): (team: Team) => string {
  return team => (view.mode === 'duel' ? t('teamNamed', { color: t(`color_${view.colors[team]}`) }) : t(team === 'red' ? 'yourTeam' : 'rival'));
}

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
  const duel = view.mode === 'duel';
  const duet = view.mode === 'duet';
  const teamName = teamNamer(view, t);
  return (
    <section className="panel pista__teams" style={teamColors(view)}>
      <h2>{t('pickTeams')}</h2>
      <p>{t(duet ? 'pickDuetHint' : duel ? 'pickTeamsHint' : 'pickSoloHint')}</p>
      <div className={`pista__cols${duel ? '' : ' is-solo'}`}>
        {(duel ? TEAMS : (['red'] as Team[])).map(team => (
          <div key={team} className={`pista__team pista__team--${team}`}>
            <h3>{teamName(team)}</h3>
            <ul>
              {view.players.map((p, i) =>
                p.team !== team ? null : (
                  <li key={p.id}>
                    <Avatar name={p.name} color={playerColor(lobby, p.id)} />
                    <span>
                      {p.name}
                      {i === view.me && <span className="muted"> ({t('you')})</span>}
                    </span>
                    <span className={`pill${p.role === 'chief' ? ' pill--accent' : ''}`}>{t(duet ? (p.role === 'chief' ? 'duetFirst' : 'duetSecond') : p.role)}</span>
                  </li>
                ),
              )}
            </ul>
            <div className="actions">
              {!(mine.team === team && mine.role === 'guess') && (
                <button type="button" disabled={awaiting} onClick={() => onIntent({ type: 'join', team, role: 'guess' })}>
                  {t(duet ? 'duetSecond' : 'joinAsGuess')}
                </button>
              )}
              {!(mine.team === team && mine.role === 'chief') && (
                <button type="button" disabled={awaiting} onClick={() => onIntent({ type: 'join', team, role: 'chief' })}>
                  {t(duet ? 'duetFirst' : 'joinAsChief')}
                </button>
              )}
            </div>
            <ColorPicker view={view} team={team} label={t('teamColor')} canPick={mine.team === team} awaiting={awaiting} onIntent={onIntent} t={t} />
            {view.mode === 'solo' && <ColorPicker view={view} team="blue" label={t('rivalColor')} canPick awaiting={awaiting} onIntent={onIntent} t={t} />}
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

/** The palette as swatches. Only the team's own players can pick; with two teams of players, the other team's colour is off limits. */
function ColorPicker({ view, team, label, canPick, awaiting, onIntent, t }: { view: PistaView; team: Team; label: string; canPick: boolean; awaiting: boolean; onIntent(i: unknown): void; t: TextFn }) {
  const other = view.colors[team === 'red' ? 'blue' : 'red'];
  return (
    <div className="pista__colors" role="group" aria-label={label}>
      <span className="pista__colorlabel">
        {label}: <b>{t(`color_${view.colors[team]}`)}</b>
      </span>
      <span className="pista__swatches">
        {TEAM_COLORS.map(color => {
          const name = t(`color_${color}`);
          const taken = view.mode === 'duel' && color === other;
          const title = taken ? t('colorTaken', { color: name }) : name;
          return (
            <button
              key={color}
              type="button"
              className={`pista__swatch${view.colors[team] === color ? ' is-picked' : ''}${taken ? ' is-taken' : ''}`}
              style={{ '--swatch': `var(--pc-${color})` } as CSSProperties}
              title={title}
              aria-label={title}
              aria-pressed={view.colors[team] === color}
              disabled={!canPick || taken || awaiting || view.colors[team] === color}
              onClick={() => onIntent({ type: 'color', team, color })}
            />
          );
        })}
      </span>
    </div>
  );
}

function Table({ view, lobby, awaiting, onIntent, isHost, onPlayAgain, onBackToLobby, onLeave, t }: Inner) {
  const me = view.players[view.me]!;
  const over = view.winner !== null;
  const solo = view.mode === 'solo';
  const duet = view.duet;
  const partner = view.players[duet ? 1 - view.me : view.me]!;
  const actor = (role: 'chief' | 'guess') => view.players.find(p => p.role === role)?.name ?? '';
  const teamName = teamNamer(view, t);
  usePistaSounds(view);
  const myClue = !over && view.phase === 'clue' && me.team === view.turn && me.role === 'chief';
  const myGuess = !over && view.phase === 'guess' && me.team === view.turn && me.role === 'guess';
  const markers = (card: number) => view.marks.map((m, i) => (m === card ? i : -1)).filter(i => i >= 0);

  let status: string;
  if (over && duet) status = t(view.winner === 'red' ? 'duetWin' : 'duetLose');
  else if (duet && view.phase === 'clue') status = myClue ? t('yourClue') : t('duetTurnClue', { name: actor('chief') });
  else if (duet) status = myGuess ? t('duetYourGuess') : t('duetTheyGuess', { name: actor('guess') });
  else if (over && solo) status = t(view.winner === 'red' ? 'soloWin' : 'soloLose');
  else if (over) status = t('win', { team: teamName(view.winner!) });
  else if (view.phase === 'clue') status = myClue ? t('yourClue') : t('turnClue', { team: teamName(view.turn) });
  else status = myGuess ? t('yourGuess') : t('theyGuess', { team: teamName(view.turn) });

  return (
    <div className="pista__table" style={teamColors(view)}>
      <div className="pista__score">
        {duet ? (
          <>
            <span className="pista__count pista__count--red is-turn">
              <b>{t('duetWords')}</b> {t('left', { n: view.left.red })}
            </span>
            <span className={`pista__count pista__count--turns${duet.turnsLeft <= 2 ? ' is-low' : ''}`}>
              <b>{t('duetTurns')}</b> {t('duetTurnsLeft', { n: duet.turnsLeft, total: duet.turns })}
            </span>
          </>
        ) : (
          TEAMS.map(team => (
            <span key={team} className={`pista__count pista__count--${team}${view.turn === team && !over ? ' is-turn' : ''}`}>
              <b>{teamName(team)}</b> {t('left', { n: view.left[team] })}
            </span>
          ))
        )}
      </div>

      <div className={`pista__status pista__status--${over ? view.winner : view.turn}`}>
        <b>{status}</b>
        {over && <span>{t(duet ? `end_duet_${view.endReason}` : solo && view.winner === 'blue' && view.endReason === 'found' ? 'end_rival' : `end_${view.endReason}`)}</span>}
        {!over && view.clue && (
          <span className="pista__clue">
            {t('clue', { word: view.clue.word.toUpperCase(), count: view.clue.count })} ·{' '}
            {view.guessesLeft === null ? t('guessesUnlimited') : t('guessesLeft', { n: view.guessesLeft })}
          </span>
        )}
      </div>

      {duet && !over && (
        <p className="pista__keyhint">
          {t('duetKeyHint', { name: partner.name })} <b>{t('duetMine', { n: duet.mineLeft })}</b>
        </p>
      )}

      {myClue && <ClueForm awaiting={awaiting} onIntent={onIntent} t={t} />}

      <div className={`pista__grid${me.role === 'chief' || over || duet ? ' is-chief' : ''}`}>
        {view.words.map((word, i) => {
          const kind = view.kinds[i];
          const revealed = view.revealed[i];
          const marks = markers(i);
          const markedByMe = view.marks[view.me] === i;
          // Two-way game: who already guessed this word and found it neutral. Each player can try a word only once.
          const missed = view.misses?.[i] ?? 0;
          const missedByMe = (missed & (1 << view.me)) !== 0;
          return (
            <div
              key={i}
              className={`pista__card${kind ? ` is-${kind}` : ''}${revealed ? ' is-revealed' : ''}${markedByMe ? ' is-marked' : ''}${missedByMe ? ' is-missed' : ''}`}
            >
              <button
                type="button"
                className="pista__word"
                disabled={!myGuess || revealed || missedByMe || awaiting}
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
              {missed > 0 && !revealed && (
                <span className="pista__misses">
                  {view.players.map((p, seat) =>
                    missed & (1 << seat) ? (
                      <span key={p.id} className="pista__miss" style={{ background: playerColor(lobby, p.id) }} title={t('missedBy', { name: p.name })}>
                        ✕
                      </span>
                    ) : null,
                  )}
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
        {(view.mode === 'duel' ? TEAMS : (['red'] as Team[])).map(team => (
          <div key={team} className={`pista__roster pista__roster--${team}`}>
            {view.players.map((p, i) =>
              p.team !== team ? null : (
                <span key={p.id} className="pista__member">
                  <Avatar name={p.name} color={playerColor(lobby, p.id)} />
                  {p.name}
                  {i === view.me && <span className="muted"> ({t('you')})</span>}
                  {duet
                    ? !over && <span className={`pill${p.role === 'chief' ? ' pill--accent' : ''}`}>{t(p.role === 'chief' ? 'duetGiver' : 'duetGuesser')}</span>
                    : p.role === 'chief' && <span className="pill pill--accent">{t('chief')}</span>}
                </span>
              ),
            )}
          </div>
        ))}
        <details className="pista__log" open>
          <summary>{t('log')}</summary>
          <ol>
            {view.log.slice(-12).reverse().map((entry, i) => (
              <li key={i} className={`pista__logline pista__logline--${entry.kind === 'reveal' ? entry.card : entry.team}${entry.kind === 'win' && duet && entry.team === 'blue' ? ' is-lost' : ''}`}>
                {logLine(entry, view, t, teamName)}
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

function logLine(entry: PistaLog, view: PistaView, t: TextFn, teamName: (team: Team) => string): string {
  const name = (seat: number | null) => (seat === null ? '' : view.players[seat]?.name ?? '—');
  const duet = view.mode === 'duet';
  switch (entry.kind) {
    case 'clue':
      return t('log_clue', { name: name(entry.seat), word: entry.word.toUpperCase(), count: entry.count });
    case 'reveal': {
      // With two teams the colour names the team; otherwise there is no colour name to show for a right guess.
      const kind =
        entry.card === 'neutral' || entry.card === 'bomb' ? t(`kind_${entry.card}`) : view.mode === 'duel' ? t(`color_${view.colors[entry.card]}`) : duet ? t('kind_found') : teamName(entry.card);
      const line =
        entry.seat === null
          ? t(view.mode === 'solo' && entry.team === 'blue' ? 'log_rival' : 'log_revealTimeout', { word: entry.word })
          : t('log_reveal', { name: name(entry.seat), word: entry.word });
      return `${line} (${kind})`;
    }
    case 'pass':
      if (entry.seat !== null) return t('log_pass', { name: name(entry.seat) });
      return duet ? t('log_duetTimeout') : t('log_timeout', { team: teamName(entry.team) });
    case 'win':
      if (duet) return t(entry.team === 'red' ? 'log_duetWin' : entry.reason === 'bomb' ? 'log_duetBomb' : 'log_duetTurns');
      return t('log_win', { team: teamName(entry.team) });
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

  // A miss in the two-way game uncovers nothing but still counts as a guess made.
  const revealed = view.revealed.filter(Boolean).length + (view.misses?.reduce((n, m) => n + (m & 1) + (m >> 1), 0) ?? 0);
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
