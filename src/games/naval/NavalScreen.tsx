import { useState } from 'react';
import { useLang } from '../../i18n/LangProvider';
import { EndActions, GameFrame, RulesSheet, useGameText, useReason, type GameScreenProps, type TextFn } from '../shared/GameFrame';
import { asNavalView, FLEET, randomFleet, shipCells, SIZE, validFleet, type Dir, type NavalView, type Placement, type Shot, type ShipId } from './game';
import { NAVAL_TEXT, RULE_KEYS } from './text';

export function NavalScreen(props: GameScreenProps) {
  const view = asNavalView(props.view);
  const t = useGameText(NAVAL_TEXT);
  const reason = useReason(t);
  const [rules, setRules] = useState(false);
  const over = view.winner !== null;
  return (
    <GameFrame
      title={useLang().tr.t('gameNavalName')}
      code={props.code}
      clock={over || view.phase === 'placing' ? null : props.clock}
      error={props.error}
      reason={reason}
      onDismissError={props.onDismissError}
      onEndGame={over ? undefined : props.onEndGame}
      onRules={() => setRules(true)}
      className="naval"
    >
      {view.phase === 'placing' ? <Placing {...props} view={view} t={t} /> : <Battle {...props} view={view} t={t} />}
      {rules && <RulesSheet title={t('rulesTitle')} paragraphs={RULE_KEYS.map(k => t(k))} onClose={() => setRules(false)} />}
    </GameFrame>
  );
}

type Inner = Omit<GameScreenProps, 'view'> & { view: NavalView; t: TextFn };

/** Where a ship of `id` would sit starting at `at`, or null if it runs off the grid. */
function fits(id: ShipId, at: number, dir: Dir): Placement | null {
  const len = FLEET.find(f => f.id === id)!.len;
  const row = Math.floor(at / SIZE);
  const col = at % SIZE;
  if (dir === 'h' ? col + len > SIZE : row + len > SIZE) return null;
  return { id, at, dir };
}

/** Which ship part a cell shows, for rounded ends: 'start', 'mid' or 'end', plus the direction. */
function partOf(fleet: Placement[], cell: number): { ship: Placement; part: string } | null {
  for (const ship of fleet) {
    const cells = shipCells(ship);
    const i = cells.indexOf(cell);
    if (i >= 0) return { ship, part: i === 0 ? 'start' : i === cells.length - 1 ? 'end' : 'mid' };
  }
  return null;
}

function Placing({ view, awaiting, onIntent, t }: Inner) {
  const [fleet, setFleet] = useState<Placement[]>(() => view.myFleet ?? []);
  const [picked, setPicked] = useState<ShipId | null>(FLEET[0]!.id);
  const [dir, setDir] = useState<Dir>('h');
  const [hover, setHover] = useState<number | null>(null);
  const them = view.players[1 - view.me]!;
  const ready = view.myFleet !== null;

  const occupied = (except: ShipId | null) => new Set(fleet.filter(p => p.id !== except).flatMap(shipCells));
  const preview = picked !== null && hover !== null ? fits(picked, hover, dir) : null;
  const previewOk = preview !== null && !shipCells(preview).some(c => occupied(picked).has(c));
  const previewCells = new Set(preview ? shipCells(preview) : []);

  function click(cell: number) {
    if (ready) return;
    const place = picked === null ? null : fits(picked, cell, dir);
    const placeOk = place !== null && !shipCells(place).some(c => occupied(picked).has(c));
    const onShip = partOf(fleet, cell);
    if (onShip && !placeOk) {
      // Tapping a placed ship (where the picked one can't go) picks it back up.
      setFleet(fleet.filter(p => p.id !== onShip.ship.id));
      setPicked(onShip.ship.id);
      setDir(onShip.ship.dir);
      return;
    }
    if (!place || !placeOk) return;
    const next = [...fleet.filter(p => p.id !== picked), place];
    setFleet(next);
    setPicked(FLEET.find(f => !next.some(p => p.id === f.id))?.id ?? null);
  }

  return (
    <section className="naval__placing">
      <div className="panel naval__tools">
        <h2>{t('placeTitle')}</h2>
        <p>{t('placeHint')}</p>
        <div className="naval__ships">
          {FLEET.map(f => {
            const placed = fleet.some(p => p.id === f.id);
            return (
              <button
                key={f.id}
                type="button"
                disabled={ready}
                className={`naval__shipbtn${picked === f.id ? ' is-picked' : ''}${placed ? ' is-placed' : ''}`}
                onClick={() => {
                  setFleet(fleet.filter(p => p.id !== f.id));
                  setPicked(f.id);
                }}
              >
                <span className="naval__pips" aria-hidden="true">
                  {Array.from({ length: f.len }, (_, i) => (
                    <i key={i} />
                  ))}
                </span>
                {t(`ship_${f.id}`)}
              </button>
            );
          })}
        </div>
        <div className="actions">
          <button type="button" disabled={ready} onClick={() => setDir(dir === 'h' ? 'v' : 'h')}>
            ↻ {t('rotate')} · {t(dir === 'h' ? 'horizontal' : 'vertical')}
          </button>
          <button type="button" disabled={ready} onClick={() => { setFleet(randomFleet(Math.random)); setPicked(null); }}>
            🎲 {t('random')}
          </button>
          <button type="button" disabled={ready || fleet.length === 0} onClick={() => { setFleet([]); setPicked(FLEET[0]!.id); }}>
            {t('clear')}
          </button>
        </div>
        {ready ? (
          <>
            <p className="naval__status">{t('waitingFor', { name: them.name })}</p>
            <button type="button" disabled={awaiting} onClick={() => onIntent({ type: 'unready' })}>
              {t('change')}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="primary lg" disabled={awaiting || !validFleet(fleet)} onClick={() => onIntent({ type: 'place', ships: fleet })}>
              {t('ready')}
            </button>
            <p className="muted">{t(them.ready ? 'theyReady' : 'theyPlacing', { name: them.name })}</p>
          </>
        )}
      </div>
      <Grid
        label={t('yourFleet')}
        fleet={ready ? view.myFleet! : fleet}
        shots={[]}
        onCell={click}
        onHover={setHover}
        highlight={previewCells}
        highlightOk={previewOk}
      />
    </section>
  );
}

function Battle({ view, awaiting, onIntent, isHost, onPlayAgain, onBackToLobby, onLeave, t }: Inner) {
  const me = view.players[view.me]!;
  const them = view.players[1 - view.me]!;
  const over = view.winner !== null;
  const myTurn = !over && view.current === view.me;
  const describe = (shot: Shot) => (shot.result === 'sunk' ? t('sunk', { ship: t(`ship_${shot.ship}`) }) : t(shot.result));
  const sunkIds = new Set(view.myShots.filter(s => s.result === 'sunk').map(s => s.ship));
  const lastMine = view.myShots.at(-1);
  const lastTheirs = view.theirShots.at(-1);

  return (
    <div className="naval__battle">
      <div className={`panel naval__banner${myTurn ? ' is-mine' : ''}`}>
        {over ? (
          <>
            <h2>{t('win', { name: view.players[view.winner!]!.name })}</h2>
            <p>{t(view.winner === view.me ? 'youWin' : 'youLose')}</p>
            <EndActions isHost={isHost} onPlayAgain={onPlayAgain} onBackToLobby={onBackToLobby} onLeave={onLeave} playAgain={t('playAgain')} />
          </>
        ) : (
          <>
            <b>{myTurn ? t('yourTurn') : t('theirTurn', { name: them.name })}</b>
            <span className="muted">
              {lastMine && t('youShot', { result: describe(lastMine) })}
              {lastMine && lastTheirs && ' · '}
              {lastTheirs && t('theyShot', { name: them.name, result: describe(lastTheirs) })}
            </span>
          </>
        )}
      </div>
      <div className="naval__seas">
        <div>
          <Grid
            label={t('enemySea', { name: them.name })}
            fleet={view.theirShips}
            shots={view.myShots}
            onCell={cell => myTurn && !awaiting && !view.myShots.some(s => s.cell === cell) && onIntent({ type: 'fire', cell })}
            aim={myTurn && !awaiting}
          />
          <ul className="naval__afloat" aria-label={t('afloat')}>
            {FLEET.map(f => (
              <li key={f.id} className={sunkIds.has(f.id) ? 'is-sunk' : ''}>
                <span className="naval__pips" aria-hidden="true">
                  {Array.from({ length: f.len }, (_, i) => (
                    <i key={i} />
                  ))}
                </span>
                {t(`ship_${f.id}`)}
              </li>
            ))}
          </ul>
        </div>
        <Grid label={`${t('yourFleet')} · ${me.name}`} fleet={view.myFleet ?? []} shots={view.theirShots} small />
      </div>
    </div>
  );
}

function Grid({ label, fleet, shots, onCell, onHover, highlight, highlightOk, aim, small }: {
  label: string;
  fleet: Placement[];
  shots: Shot[];
  onCell?: (cell: number) => void;
  onHover?: (cell: number | null) => void;
  highlight?: Set<number>;
  highlightOk?: boolean;
  aim?: boolean;
  small?: boolean;
}) {
  const shotAt = new Map(shots.map(s => [s.cell, s]));
  const last = shots.at(-1)?.cell;
  return (
    <figure className={`naval__sea${small ? ' is-small' : ''}${aim ? ' is-aiming' : ''}`}>
      <figcaption>{label}</figcaption>
      <div className="naval__grid" onMouseLeave={() => onHover?.(null)}>
        <span />
        {Array.from({ length: SIZE }, (_, c) => (
          <span key={`c${c}`} className="naval__axis">{c + 1}</span>
        ))}
        {Array.from({ length: SIZE }, (_, r) => [
          <span key={`r${r}`} className="naval__axis">{'ABCDEFGHIJ'[r]}</span>,
          ...Array.from({ length: SIZE }, (_, c) => {
            const cell = r * SIZE + c;
            const ship = partOf(fleet, cell);
            const shot = shotAt.get(cell);
            const cls = [
              'naval__cell',
              ship && `has-ship is-${ship.part} is-${ship.ship.dir}`,
              shot && `is-${shot.result === 'miss' ? 'miss' : 'hit'}`,
              cell === last && 'is-last',
              highlight?.has(cell) && (highlightOk ? 'is-preview' : 'is-bad'),
            ].filter(Boolean).join(' ');
            return (
              <button
                key={cell}
                type="button"
                className={cls}
                disabled={!onCell}
                onClick={() => onCell?.(cell)}
                onMouseEnter={() => onHover?.(cell)}
                aria-label={`${'ABCDEFGHIJ'[r]}${c + 1}`}
              >
                {shot && <span aria-hidden="true">{shot.result === 'miss' ? '•' : '✕'}</span>}
              </button>
            );
          }),
        ])}
      </div>
    </figure>
  );
}
