import type { ComponentType } from 'react';
import type { GameId } from './catalog';
import { ChessScreen } from './chess/ChessScreen';
import { CHESS_TEXT, RULE_KEYS as CHESS_RULES } from './chess/text';
import { NavalScreen } from './naval/NavalScreen';
import { NAVAL_TEXT, RULE_KEYS as NAVAL_RULES } from './naval/text';
import { forcaModule } from './forca/game';
import { FORCA_RULES, FORCA_TEXT, ForcaScreen } from './forca/ForcaScreen';
import type { GameModule } from './module';
import { pistaModule } from './pista/game';
import { PistaScreen } from './pista/PistaScreen';
import { PISTA_TEXT, RULE_KEYS as PISTA_RULES } from './pista/text';
import { useGameText, type GameScreenProps, type Texts } from './shared/GameFrame';
import { SimpleLobby, type LobbyProps } from './shared/SimpleLobby';
import { VELHA_RULES, VELHA_TEXT, VelhaScreen } from './velha/VelhaScreen';
import { VidaScreen } from './vida/VidaScreen';
import { ZEROU_RULES, ZEROU_TEXT, ZerouScreen } from './zerou/ZerouScreen';
import { RULE_KEYS as VIDA_RULES, VIDA_TEXT } from './vida/text';

function rulesLobby(texts: Texts, keys: string[]): ComponentType<LobbyProps> {
  return function RulesLobby(props: LobbyProps) {
    const t = useGameText(texts);
    return <SimpleLobby {...props} rules={{ title: t('rulesTitle'), paragraphs: keys.map(k => t(k)) }} />;
  };
}

/** A lobby whose one setting is the language of the words (Pista Certa, Forca). */
function wordsLobby(texts: Texts, keys: string[], module: GameModule<{ words: 'pt' | 'en' }>): ComponentType<LobbyProps> {
  return function WordsLobby(props: LobbyProps) {
    const t = useGameText(texts);
    const parsed = module.parseOptions(props.lobby.options);
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
    return <SimpleLobby {...props} options={options} rules={{ title: t('rulesTitle'), paragraphs: keys.map(k => t(k)) }} />;
  };
}

/** Lobby and game screens of the games built on the shared frame. */
export const NEW_GAMES: Partial<Record<GameId, { Lobby: ComponentType<LobbyProps>; Screen: ComponentType<GameScreenProps> }>> = {
  chess: { Lobby: rulesLobby(CHESS_TEXT, CHESS_RULES), Screen: ChessScreen },
  pista: { Lobby: wordsLobby(PISTA_TEXT, PISTA_RULES, pistaModule), Screen: PistaScreen },
  vida: { Lobby: rulesLobby(VIDA_TEXT, VIDA_RULES), Screen: VidaScreen },
  naval: { Lobby: rulesLobby(NAVAL_TEXT, NAVAL_RULES), Screen: NavalScreen },
  zerou: { Lobby: rulesLobby(ZEROU_TEXT, ZEROU_RULES), Screen: ZerouScreen },
  velha: { Lobby: rulesLobby(VELHA_TEXT, VELHA_RULES), Screen: VelhaScreen },
  forca: { Lobby: wordsLobby(FORCA_TEXT, FORCA_RULES, forcaModule), Screen: ForcaScreen },
};
