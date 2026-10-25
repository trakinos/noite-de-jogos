import { describe, it, expect } from 'vitest';
import { HostSession } from './host';
import { BairroInstance, bairroModule } from '../games/bairro/module';
import { flush } from './memory';
import { fakeScheduler, join, seededHostOptions, type TestClient } from './testing';

function bairro(host: HostSession): BairroInstance {
  if (!(host.instance instanceof BairroInstance)) throw new Error('No Dono do Bairro game in progress');
  return host.instance;
}

async function room(n: number, scheduler = fakeScheduler()) {
  const host = new HostSession(bairroModule, { ...seededHostOptions(), scheduler });
  const clients: TestClient[] = [await join(host, 'P0', { local: true })];
  for (let i = 1; i < n; i++) clients.push(await join(host, `P${i}`));
  return { host, clients, scheduler };
}

describe('HostSession running Dono do Bairro', () => {
  it('refuses a 7th seat with Room full', async () => {
    const { host } = await room(6);
    const late = await join(host, 'Late');
    expect(late.last('error')).toEqual({ type: 'error', reason: 'Room full' });
  });

  it('starts with six players and sends each a view of their own seat', async () => {
    const { host, clients } = await room(6);
    expect(host.start()).toEqual({ ok: true });
    await flush();
    for (const [i, c] of clients.entries()) {
      const view = c.last('view')!.view as { you: number; players: { id: string }[] };
      expect(view.players[view.you].id).toBe(`p${i}`);
    }
  });

  it('round-trips an intent: the current player rolls', async () => {
    const { host, clients } = await room(3);
    host.start();
    await flush();
    const s = bairro(host).state;
    const mover = clients[Number(s.players[s.current].id.slice(1))];
    mover.send({ type: 'intent', intent: { type: 'roll' } });
    await flush();
    expect(s.lastRoll).not.toBeNull();
    expect(mover.last('error')).toBeUndefined();
    const other = clients.find((c) => c !== mover)!;
    const view = other.last('view')!.view as { lastRoll: unknown };
    expect(view.lastRoll).toEqual(s.lastRoll);
  });

  it('runs a turn-timer expiry through BairroInstance.expire and moves the turn on', async () => {
    const { host, scheduler } = await room(3);
    expect(host.setTurnTimer(45)).toEqual({ ok: true });
    host.start();
    await flush();
    const s = bairro(host).state;
    const before = s.turnNumber;
    const mover = s.current;
    scheduler.advance(45_000);
    await flush();
    expect(s.turnNumber).toBeGreaterThan(before);
    expect(s.current).not.toBe(mover);
  });
});
