// Helpers for tests only. Not imported by production code.
import { asDominionView, DominionInstance } from '../games/dominion/module';
import type { PlayerView } from '../engine/view';
import type { Game } from '../engine/game';
import { createRng, nextFloat } from '../engine/rng';
import type { HostOptions, HostSession } from './host';
import { createMemoryPair, flush } from './memory';
import type { HostMessage } from './protocol';
import type { PlayerPieceId } from '../theme/playerPieces';
import type { Connection } from './transport';
import type { Scheduler } from './turnClock';

export function seededHostOptions(seed = 1): HostOptions {
  const rng = createRng(seed);
  let n = 0;
  return { random: () => nextFloat(rng), makeToken: () => `token-${n++}` };
}

/** The Dominion engine game behind a host running the Dominion module. */
export function dominionGame(host: HostSession): Game {
  if (!(host.instance instanceof DominionInstance)) throw new Error('No Dominion game in progress');
  return host.instance.game;
}

/** The latest Dominion view a test client received. */
export function viewOf(client: { last(type: 'view'): { view: unknown } | undefined }): PlayerView {
  return asDominionView(client.last('view')!.view);
}

export interface TestClient {
  conn: Connection;
  messages: HostMessage[];
  closed: boolean;
  send(msg: unknown): void;
  last<T extends HostMessage['type']>(type: T): Extract<HostMessage, { type: T }> | undefined;
  close(): void;
}

export function connectClient(host: HostSession, opts: { local?: boolean } = {}): TestClient {
  let conn: Connection;
  if (opts.local) {
    conn = host.connectLocal();
  } else {
    const [hostEnd, clientEnd] = createMemoryPair();
    host.accept(hostEnd);
    conn = clientEnd;
  }
  const client: TestClient = {
    conn,
    messages: [],
    closed: false,
    send: (msg) => conn.send(msg),
    last: (type) => [...client.messages].reverse().find((m) => m.type === type) as never,
    close: () => conn.close(),
  };
  conn.onMessage((msg) => client.messages.push(msg as HostMessage));
  conn.onClose(() => {
    client.closed = true;
  });
  return client;
}

export async function join(
  host: HostSession,
  name: string,
  opts: { local?: boolean; token?: string; piece?: PlayerPieceId } = {},
): Promise<TestClient> {
  const client = connectClient(host, opts);
  client.send({ type: 'hello', name, token: opts.token ?? null, ...(opts.piece ? { piece: opts.piece } : {}) });
  await flush();
  return client;
}

/** A manual clock for timer tests: time only moves when `advance` is called. */
export function fakeScheduler(): Scheduler & { advance(ms: number): void } {
  let now = 0;
  let nextId = 0;
  const tasks = new Map<number, { at: number; fn: () => void }>();
  return {
    now: () => now,
    set(fn, ms) {
      const id = ++nextId;
      tasks.set(id, { at: now + ms, fn });
      return id;
    },
    clear(handle) {
      tasks.delete(handle as number);
    },
    advance(ms) {
      const end = now + ms;
      for (;;) {
        const due = [...tasks.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        tasks.delete(due[0]);
        now = due[1].at;
        due[1].fn();
      }
      now = end;
    },
  };
}
