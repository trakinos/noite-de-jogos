import { GAMES, type GameId } from '../games/catalog';
import type { ApplyResult, GameInstance, GameModule } from '../games/module';
import { PLAYER_COLORS, type PlayerColorId } from '../theme/playerColors';
import { PLAYER_PIECES, type PlayerPieceId } from '../theme/playerPieces';
import { createMemoryPair } from './memory';
import { parseGuestMessage, type HostMessage, type LobbyState } from './protocol';
import type { Connection } from './transport';
import { realScheduler, TurnClock, type Scheduler } from './turnClock';

/** Each view carries only the recent log: keeps messages small (binary channels chunk large ones, but a whole-game log is wasteful). */
export const MAX_LOG_ENTRIES = 150;
/** Turn timer choices in seconds; `null` (no timer) is the default. */
export const TURN_TIMER_OPTIONS = [45, 60, 90, 120] as const;

export interface HostOptions {
  random?: () => number;
  makeToken?: () => string;
  scheduler?: Scheduler;
  /** Looks up a game's module so a won vote can switch the room to it; without it votes are tallied but never applied. */
  resolveModule?: (id: GameId) => GameModule;
}

interface Seat {
  id: string;
  name: string;
  token: string;
  conn: Connection | null;
  color: PlayerColorId;
  piece: PlayerPieceId;
  vote: GameId | null;
}

const ok = (): ApplyResult => ({ ok: true });
const fail = (reason: string): ApplyResult => ({ ok: false, reason });

function randomToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function send(conn: Connection, msg: HostMessage): void {
  conn.send(msg);
}

/** Runs in the host's browser: owns the seats, the lobby and the running game, whatever game the module plays. */
export class HostSession {
  private seats: Seat[] = [];
  private hostSeatId: string | null = null;
  private nextSeat = 0;
  private options: unknown;
  private activeGame: GameInstance | null = null;
  private turnTimer: number | null = null;
  private clock: TurnClock | null = null;
  /** Colors of guests who left the lobby, by token: a refresh gets the same color back if it is still free. */
  private departedColors = new Map<string, PlayerColorId>();
  private readonly random: () => number;
  private readonly makeToken: () => string;
  private readonly scheduler: Scheduler;
  private readonly resolveModule: ((id: GameId) => GameModule) | undefined;

  constructor(
    private module: GameModule,
    opts: HostOptions = {},
  ) {
    this.random = opts.random ?? Math.random;
    this.makeToken = opts.makeToken ?? randomToken;
    this.scheduler = opts.scheduler ?? realScheduler;
    this.resolveModule = opts.resolveModule;
    this.options = module.defaultOptions();
  }

  /** The running game, if any. */
  get instance(): GameInstance | null {
    return this.activeGame;
  }

  get lobby(): LobbyState {
    const options = structuredClone(this.options);
    const legacyKingdom = this.module.id === 'dominion' ? (options as { kingdom?: unknown }).kingdom : undefined;
    return {
      game: this.module.id,
      hostId: this.hostSeatId ?? '',
      players: this.seats.map((s) => ({ id: s.id, name: s.name, online: s.conn !== null, color: s.color, piece: s.piece, ...(s.vote ? { vote: s.vote } : {}) })),
      options,
      inGame: this.activeGame !== null,
      turnTimer: this.turnTimer,
      minPlayers: this.module.minPlayers,
      maxPlayers: this.module.maxPlayers,
      // Deploy-compat: old clients read the kingdom at the top level. Drop later.
      ...(legacyKingdom === undefined ? {} : { kingdom: structuredClone(legacyKingdom) }),
    };
  }

  /** Connects the host's own UI. The seat created through it is the host. */
  connectLocal(): Connection {
    const [hostEnd, uiEnd] = createMemoryPair();
    this.accept(hostEnd, true);
    return uiEnd;
  }

  accept(conn: Connection, isHost = false): void {
    let seat: Seat | null = null;
    conn.onMessage((raw) => {
      const msg = parseGuestMessage(raw);
      if (!msg) return;
      if (msg.type === 'hello') {
        if (!seat) seat = this.hello(conn, msg.name, msg.token, isHost, msg.piece);
        return;
      }
      if (msg.type === 'setPiece') {
        if (seat && seat.conn === conn) this.setPiece(seat, conn, msg.piece);
        return;
      }
      if (msg.type === 'vote') {
        if (seat && seat.conn === conn) this.vote(seat, conn, msg.game);
        return;
      }
      if (msg.type === 'setColor') {
        if (seat && seat.conn === conn) this.setColor(seat, conn, msg.color);
        return;
      }
      if (seat && seat.conn === conn) this.handleIntent(seat, conn, msg.intent);
    });
    conn.onClose(() => {
      if (seat && seat.conn === conn) this.disconnected(seat);
    });
  }

  setOptions(raw: unknown): ApplyResult {
    if (this.activeGame) return fail('Game in progress');
    const parsed = this.module.parseOptions(raw);
    if (typeof parsed === 'object' && parsed !== null && 'error' in parsed) return fail((parsed as { error: string }).error);
    this.options = parsed;
    this.broadcastLobby();
    return ok();
  }

  /** Swaps the game while the room stays open: seats, colors and the timer are kept, the options reset to the new game's defaults. */
  setGame(module: GameModule): ApplyResult {
    if (this.activeGame) return fail('Game in progress');
    if (module.id === this.module.id) {
      this.clearVotes();
      this.broadcastLobby();
      return ok();
    }
    if (this.seats.length > module.maxPlayers) return fail('Too many players for that game');
    this.module = module;
    this.options = module.defaultOptions();
    this.clearVotes();
    this.broadcastLobby();
    return ok();
  }

  setTurnTimer(seconds: number | null): ApplyResult {
    if (this.activeGame) return fail('Game in progress');
    if (seconds !== null && !(TURN_TIMER_OPTIONS as readonly number[]).includes(seconds)) return fail('Invalid timer');
    this.turnTimer = seconds;
    this.broadcastLobby();
    return ok();
  }

  start(): ApplyResult {
    if (this.activeGame) return fail('Game already started');
    if (this.seats.length < this.module.minPlayers) return fail(`Need at least ${this.module.minPlayers} players`);
    this.activeGame = this.module.create(
      this.seats.map((s) => ({ id: s.id, name: s.name })),
      this.options,
      this.newSeed(),
    );
    this.clock =
      this.turnTimer === null
        ? null
        : new TurnClock(this.turnTimer * 1000, this.scheduler, (kind) => {
            const game = this.activeGame;
            if (!game || game.over) return;
            game.expire(kind, this.newSeed());
            this.gameChanged();
          });
    this.broadcastLobby();
    this.gameChanged();
    return ok();
  }

  playAgain(): ApplyResult {
    if (!this.activeGame?.over) return fail('The game is not over');
    this.clock?.stop();
    this.clock = null;
    this.activeGame = null;
    return this.start();
  }

  backToLobby(): void {
    if (!this.activeGame) return;
    this.clock?.stop();
    this.clock = null;
    this.activeGame = null;
    this.seats = this.seats.filter((s) => s.conn !== null);
    this.broadcastLobby();
  }

  /** The host left: stops the clock and drops the game so nothing moves in the background. */
  close(): void {
    this.clock?.stop();
    this.clock = null;
    this.activeGame = null;
  }

  /** Call after every change to the game: keeps the clock in step, then sends fresh views. */
  gameChanged(): void {
    if (this.activeGame && this.clock) this.clock.sync(this.activeGame.clockInput());
    this.broadcastViews();
  }

  private hello(conn: Connection, name: string, token: string | null, isHost: boolean, piece?: PlayerPieceId): Seat | null {
    const existing = token ? this.seats.find((s) => s.token === token) : undefined;
    if (existing) {
      const previous = existing.conn;
      existing.conn = conn;
      if (previous && previous !== conn) previous.close();
      this.welcome(existing);
      this.broadcastLobby();
      this.sendView(existing);
      return existing;
    }
    if (this.activeGame) return this.reject(conn, 'Game in progress');
    if (this.seats.length >= this.module.maxPlayers) return this.reject(conn, 'Room full');

    const seat: Seat = {
      id: `p${this.nextSeat++}`, name, token: this.makeToken(), conn, color: this.freeColor(token),
      // A guest without a piece (an older page) gets one by seat, so every token on the board has a shape.
      piece: piece ?? PLAYER_PIECES[this.seats.length % PLAYER_PIECES.length]!.id,
      vote: null,
    };
    this.seats.push(seat);
    if (isHost && this.hostSeatId === null) this.hostSeatId = seat.id;
    this.welcome(seat);
    this.broadcastLobby();
    return seat;
  }

  /** Tells the connection why it can't join. The guest closes the connection itself after reading this. */
  private reject(conn: Connection, reason: string): null {
    send(conn, { type: 'error', reason });
    return null;
  }

  private disconnected(seat: Seat): void {
    seat.conn = null;
    if (!this.activeGame) {
      this.seats = this.seats.filter((s) => s !== seat);
      this.departedColors.set(seat.token, seat.color);
    }
    this.broadcastLobby();
  }

  private handleIntent(seat: Seat, conn: Connection, intent: unknown): void {
    if (!this.activeGame) {
      send(conn, { type: 'error', reason: 'No game in progress' });
      return;
    }
    let result: ApplyResult;
    try {
      result = this.activeGame.apply(seat.id, intent);
    } catch (err) {
      console.error('Engine error while applying intent', intent, err);
      result = fail('Something went wrong');
    }
    if (!result.ok) {
      send(conn, { type: 'error', reason: result.reason });
      return;
    }
    this.gameChanged();
  }

  /** A vote for the next game; once every connected player has voted, the leader is applied (a tie keeps the current game if it is among them). */
  private vote(seat: Seat, conn: Connection, game: GameId | null): void {
    if (this.activeGame) return void send(conn, { type: 'error', reason: 'Game in progress' });
    if (game !== null) {
      const info = GAMES.find((g) => g.id === game);
      if (!info?.available) return void send(conn, { type: 'error', reason: 'Unknown game' });
      if (this.seats.length > info.maxPlayers) return void send(conn, { type: 'error', reason: 'Too many players for that game' });
    }
    seat.vote = game;
    const voters = this.seats.filter((s) => s.conn !== null);
    if (this.resolveModule && voters.length > 0 && voters.every((s) => s.vote !== null)) {
      const counts = new Map<GameId, number>();
      for (const s of voters) counts.set(s.vote!, (counts.get(s.vote!) ?? 0) + 1);
      const top = Math.max(...counts.values());
      const leaders = GAMES.map((g) => g.id).filter((id) => counts.get(id) === top);
      const winner = leaders.includes(this.module.id) ? this.module.id : leaders[0]!;
      if (this.setGame(this.resolveModule(winner)).ok) return;
      this.clearVotes();
    }
    this.broadcastLobby();
  }

  private clearVotes(): void {
    for (const s of this.seats) s.vote = null;
  }

  private setColor(seat: Seat, conn: Connection, color: PlayerColorId): void {
    if (this.activeGame) return void send(conn, { type: 'error', reason: 'Game in progress' });
    if (this.seats.some((s) => s !== seat && s.color === color)) return void send(conn, { type: 'error', reason: 'That color is taken' });
    seat.color = color;
    this.broadcastLobby();
  }

  /** Pieces may repeat: the colors tell players apart. */
  private setPiece(seat: Seat, conn: Connection, piece: PlayerPieceId): void {
    if (this.activeGame) return void send(conn, { type: 'error', reason: 'Game in progress' });
    seat.piece = piece;
    this.broadcastLobby();
  }

  /** The color this token had before leaving the lobby if it is still free, else the first free one. */
  private freeColor(token: string | null): PlayerColorId {
    const taken = new Set(this.seats.map((s) => s.color));
    const remembered = token ? this.departedColors.get(token) : undefined;
    if (token) this.departedColors.delete(token);
    if (remembered && !taken.has(remembered)) return remembered;
    return (PLAYER_COLORS.find((c) => !taken.has(c.id)) ?? PLAYER_COLORS[0]).id;
  }

  private welcome(seat: Seat): void {
    if (seat.conn) send(seat.conn, { type: 'welcome', playerId: seat.id, token: seat.token });
  }

  private broadcastLobby(): void {
    const lobby = this.lobby;
    for (const seat of this.seats) if (seat.conn) send(seat.conn, { type: 'lobby', lobby });
  }

  private broadcastViews(): void {
    for (const seat of this.seats) this.sendView(seat);
  }

  private sendView(seat: Seat): void {
    if (seat.conn && this.activeGame) {
      const view = this.activeGame.viewFor(seat.id);
      send(seat.conn, { type: 'view', view: { ...view, log: view.log.slice(-MAX_LOG_ENTRIES) }, clock: this.clock?.info() ?? null });
    }
  }

  private newSeed(): number {
    return Math.floor(this.random() * 2 ** 31);
  }
}
