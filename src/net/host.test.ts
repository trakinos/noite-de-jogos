import { describe, it, expect } from 'vitest';
import { DEFAULT_KINGDOM, KINGDOM_IDS } from '../cards/registry';
import { HostSession } from './host';
import type { DominionOptions } from '../games/dominion/module';
import { dominionModule } from '../games/dominion/module';
import { bairroModule } from '../games/bairro/module';
import { flush } from './memory';
import { connectClient, join, seededHostOptions } from './testing';

describe('HostSession lobby', () => {
  it('tags the lobby with its game', () => {
    expect(new HostSession(dominionModule, seededHostOptions()).lobby.game).toBe('dominion');
  });

  it('reports the module seat limits in the lobby', () => {
    const { minPlayers, maxPlayers, game } = new HostSession(dominionModule, seededHostOptions()).lobby;
    expect([minPlayers, maxPlayers, game]).toEqual([2, 4, 'dominion']);
  });

  it('makes the local connection the host and welcomes it', async () => {
    const host = new HostSession(dominionModule, seededHostOptions());
    const me = await join(host, 'Ana', { local: true });
    expect(me.last('welcome')).toEqual({ type: 'welcome', playerId: 'p0', token: 'token-0' });
    const lobby = me.last('lobby')!.lobby;
    expect(lobby).toMatchObject({ hostId: 'p0', players: [{ id: 'p0', name: 'Ana', online: true }], inGame: false });
    expect((lobby.options as DominionOptions).kingdom).toHaveLength(10);
  });

  it('seats guests in order and broadcasts the lobby to everyone', async () => {
    const host = new HostSession(dominionModule, seededHostOptions());
    const ana = await join(host, 'Ana', { local: true });
    const bo = await join(host, 'Bo');
    expect(bo.last('welcome')).toMatchObject({ playerId: 'p1' });
    expect(ana.last('lobby')!.lobby.players.map((p) => p.name)).toEqual(['Ana', 'Bo']);
    expect(bo.last('lobby')!.lobby.players.map((p) => p.name)).toEqual(['Ana', 'Bo']);
  });

  it('cleans player names', async () => {
    const host = new HostSession(dominionModule, seededHostOptions());
    await join(host, 'Ana', { local: true });
    await join(host, '   ');
    await join(host, 'x'.repeat(30));
    expect(host.lobby.players.map((p) => p.name)).toEqual(['Ana', 'Player', 'x'.repeat(20)]);
  });

  it('refuses a fifth player', async () => {
    const host = new HostSession(dominionModule, seededHostOptions());
    await join(host, 'P0', { local: true });
    for (const name of ['P1', 'P2', 'P3']) await join(host, name);
    const late = await join(host, 'P4');
    expect(late.last('error')).toEqual({ type: 'error', reason: 'Room full' });
    expect(late.last('welcome')).toBeUndefined();
    expect(host.lobby.players).toHaveLength(4);
  });

  it('removes guests who leave the lobby', async () => {
    const host = new HostSession(dominionModule, seededHostOptions());
    const ana = await join(host, 'Ana', { local: true });
    const bo = await join(host, 'Bo');
    bo.close();
    await flush();
    expect(ana.last('lobby')!.lobby.players.map((p) => p.name)).toEqual(['Ana']);
  });

  it('ignores malformed messages and intents from unseated connections', async () => {
    const host = new HostSession(dominionModule, seededHostOptions());
    const stranger = connectClient(host);
    for (const raw of [null, 'hi', 42, { type: 'nope' }, { type: 'intent', intent: { type: 'endPhase' } }]) stranger.send(raw);
    await flush();
    expect(stranger.messages).toEqual([]);
    expect(host.lobby.players).toEqual([]);
  });

  it('validates and broadcasts option changes', async () => {
    const host = new HostSession(dominionModule, seededHostOptions());
    const ana = await join(host, 'Ana', { local: true });
    const ten = KINGDOM_IDS.slice(0, 10);
    const refused = { ok: false, reason: 'Choose 10 different kingdom cards' };
    expect(host.setOptions({ kingdom: ten.slice(0, 9) })).toEqual(refused);
    expect(host.setOptions({ kingdom: [...ten.slice(0, 9), 'copper'] })).toEqual(refused);
    expect(host.setOptions({ kingdom: [...ten.slice(0, 9), ten[0]] })).toEqual(refused);
    expect(host.setOptions({ kingdom: ten })).toEqual({ ok: true });
    await flush();
    expect((ana.last('lobby')!.lobby.options as DominionOptions).kingdom).toEqual(ten);
  });

  it('refuses option changes during a game', async () => {
    const host = new HostSession(dominionModule, seededHostOptions());
    await join(host, 'Ana', { local: true });
    await join(host, 'Bo');
    host.start();
    expect(host.setOptions({ kingdom: KINGDOM_IDS.slice(0, 10) })).toEqual({ ok: false, reason: 'Game in progress' });
  });

  it('gives each new player the first free color', async () => {
    const host = new HostSession(dominionModule, seededHostOptions());
    await join(host, 'Ana', { local: true });
    await join(host, 'Bo');
    expect(host.lobby.players.map((p) => p.color)).toEqual(['blue', 'red']);
  });

  it('lets a player pick a free color and refuses a taken one', async () => {
    const host = new HostSession(dominionModule, seededHostOptions());
    const ana = await join(host, 'Ana', { local: true });
    const bo = await join(host, 'Bo');
    bo.send({ type: 'setColor', color: 'green' });
    await flush();
    expect(ana.last('lobby')!.lobby.players[1].color).toBe('green');
    bo.send({ type: 'setColor', color: 'blue' });
    await flush();
    expect(bo.last('error')).toEqual({ type: 'error', reason: 'That color is taken' });
    expect(host.lobby.players[1].color).toBe('green');
  });

  it('frees a color when its player leaves the lobby', async () => {
    const host = new HostSession(dominionModule, seededHostOptions());
    await join(host, 'Ana', { local: true });
    const bo = await join(host, 'Bo');
    bo.close();
    await flush();
    await join(host, 'Cy');
    expect(host.lobby.players.map((p) => p.color)).toEqual(['blue', 'red']);
  });

  it('gives a guest who refreshes in the lobby their color back', async () => {
    const host = new HostSession(dominionModule, seededHostOptions());
    await join(host, 'Ana', { local: true });
    const bo = await join(host, 'Bo');
    const token = bo.last('welcome')!.token;
    bo.send({ type: 'setColor', color: 'green' });
    await flush();
    bo.close();
    await flush();
    await join(host, 'Bo', { token });
    expect(host.lobby.players.map((p) => [p.name, p.color])).toEqual([['Ana', 'blue'], ['Bo', 'green']]);
  });

  it('gives a returning guest the first free color if theirs was taken meanwhile', async () => {
    const host = new HostSession(dominionModule, seededHostOptions());
    await join(host, 'Ana', { local: true });
    const bo = await join(host, 'Bo');
    const token = bo.last('welcome')!.token;
    bo.send({ type: 'setColor', color: 'green' });
    await flush();
    bo.close();
    await flush();
    const cy = await join(host, 'Cy');
    cy.send({ type: 'setColor', color: 'green' });
    await flush();
    await join(host, 'Bo', { token });
    expect(host.lobby.players.map((p) => [p.name, p.color])).toEqual([['Ana', 'blue'], ['Cy', 'green'], ['Bo', 'red']]);
  });

  it('starts with the First Game kingdom', () => {
    expect((new HostSession(dominionModule, seededHostOptions()).lobby.options as DominionOptions).kingdom).toEqual(DEFAULT_KINGDOM);
  });
});

describe('HostSession lobby deploy-compat', () => {
  it('also sends the legacy top-level kingdom for Dominion rooms only', () => {
    const lobby = new HostSession(dominionModule, seededHostOptions()).lobby;
    expect(lobby.kingdom).toEqual((lobby.options as DominionOptions).kingdom);
    expect(lobby.kingdom).not.toBe((lobby.options as DominionOptions).kingdom);
    expect('kingdom' in new HostSession(bairroModule, seededHostOptions()).lobby).toBe(false);
  });
});
