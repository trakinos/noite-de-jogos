import { useEffect, useState } from 'react';
import { KINGDOM_IDS } from '../../../cards/registry';
import { createRng, shuffle } from '../../../engine/rng';
import type { CardId } from '../../../engine/types';
import { useLang } from '../../../i18n/LangProvider';
import type { HostSession } from '../../../net/host';
import type { LobbyState } from '../../../net/protocol';
import { KingdomPicker } from '../../../ui/components/KingdomPicker';
import { Pile } from '../../../ui/components/Pile';
import { RulesDialog } from '../../../ui/components/RulesDialog';
import { Lobby } from '../../../ui/screens/Lobby';
import { sortByCost } from '../../../ui/moves';
import type { PlayerColorId } from '../../../theme/playerColors';
import { dominionModule, type DominionOptions } from '../module';

interface OptionsProps {
  lobby: LobbyState;
  host: HostSession | null;
  draft: CardId[];
  onDraft(draft: CardId[]): void;
}

/** The kingdom section of the Dominion lobby: an editable picker for the host, a read-only grid for guests. */
export function DominionLobbyOptions({ lobby, host, draft, onDraft }: OptionsProps) {
  const { tr } = useLang();
  const kingdom = (lobby.options as DominionOptions).kingdom;

  function toggle(id: CardId) {
    const next = draft.includes(id) ? draft.filter((c) => c !== id) : draft.length < 10 ? [...draft, id] : draft;
    onDraft(next);
    if (next.length === 10) host?.setOptions({ kingdom: next });
  }

  return host ? (
    <KingdomPicker
      selected={draft}
      onToggle={toggle}
      onRandomize={() => host.setOptions({ kingdom: shuffle(createRng(Math.floor(Math.random() * 2 ** 31)), KINGDOM_IDS).slice(0, 10) })}
      onReset={() => {
        // the lobby may already hold the default while the draft is half-edited
        const { kingdom: defaults } = dominionModule.defaultOptions();
        onDraft(defaults);
        host.setOptions({ kingdom: defaults });
      }}
    />
  ) : (
    <>
      <div className="picker__bar">
        <h2>{tr.t('kingdom')}</h2>
        <span className="zone__hint">{tr.t('kingdomByHost')}</span>
      </div>
      <div className="pile-grid">
        {sortByCost(kingdom).map((id) => (
          <Pile key={id} id={id} showTypes />
        ))}
      </div>
    </>
  );
}

interface LobbyProps {
  lobby: LobbyState;
  me: string;
  code: string;
  shareLink: string;
  host: HostSession | null;
  onSetColor(color: PlayerColorId): void;
  onLeave(): void;
}

/** The shared Lobby filled in for Dominion: kingdom draft, start gate and rulebook. */
export function DominionLobby(props: LobbyProps) {
  const { tr } = useLang();
  const kingdom = (props.lobby.options as DominionOptions).kingdom;
  const [draft, setDraft] = useState<CardId[]>(kingdom);
  const [rules, setRules] = useState(false);
  const kingdomKey = kingdom.join(',');
  useEffect(() => setDraft(kingdom), [kingdomKey]);

  return (
    <>
      <Lobby
        {...props}
        options={<DominionLobbyOptions lobby={props.lobby} host={props.host} draft={draft} onDraft={setDraft} />}
        onRules={() => setRules(true)}
        startGate={{
          ready: draft.length === 10,
          notReady: tr.t('choose10'),
          summary: tr.t('startSummary', { players: props.lobby.players.length, cards: draft.length }),
        }}
      />
      {rules && <RulesDialog kingdom={draft} onClose={() => setRules(false)} />}
    </>
  );
}
