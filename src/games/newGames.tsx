import type { ComponentType } from 'react';
import type { GameId } from './catalog';
import { ChessScreen } from './chess/ChessScreen';
import { CHESS_TEXT, RULE_KEYS as CHESS_RULES } from './chess/text';
import { pistaModule } from './pista/game';
import { PistaScreen } from './pista/PistaScreen';
import { PISTA_TEXT, RULE_KEYS as PISTA_RULES } from './pista/text';
import { useGameText, type GameScreenProps, type Texts } from './shared/GameFrame';
import { SimpleLobby, type LobbyProps } from './shared/SimpleLobby';
import { VidaScreen } from './vida/VidaScreen';
import { RULE_KEYS as VIDA_RULES, VIDA_TEXT } from './vida/text';

function rulesLobby(texts: Texts, keys: string[]): ComponentType<LobbyProps> {
  return function RulesLobby(props: LobbyProps) {
    const t = useGameText(texts);
    return <SimpleLobby {...props} rules={{ title: t('rulesTitle'), paragraphs: keys.map(k => t(k)) }} />;
  };
}

function PistaLobby(props: LobbyProps) {
  const t = useGameText(PISTA_TEXT);
  const parsed = pistaModule.parseOptions(props.lobby.options);
  const words = 'error' in parsed ? 'pt' : parsed.words;
  const options = (
    <div className="bsetting">
      {props.host ? (
        <label className="bsetting__select">
          <span>{t('lobbyWords')}</span>
          <select value={words} onChange={e => props.host!.setOptions({ words: e.target.value })}>
            <option value="pt">{t('words_pt')}</option>
            <option value="en">{t('words_en')}</option>
          </select>
        </label>
      ) : (
        <b>
          {t('lobbyWords')}: {t(`words_${words}`)}
        </b>
      )}
    </div>
  );
  return <SimpleLobby {...props} options={options} rules={{ title: t('rulesTitle'), paragraphs: PISTA_RULES.map(k => t(k)) }} />;
}

/** Lobby and game screens of the games built on the shared frame. */
export const NEW_GAMES: Partial<Record<GameId, { Lobby: ComponentType<LobbyProps>; Screen: ComponentType<GameScreenProps> }>> = {
  chess: { Lobby: rulesLobby(CHESS_TEXT, CHESS_RULES), Screen: ChessScreen },
  pista: { Lobby: PistaLobby, Screen: PistaScreen },
  vida: { Lobby: rulesLobby(VIDA_TEXT, VIDA_RULES), Screen: VidaScreen },
};
