import type { ComponentType } from 'react';
import type { GameId } from './catalog';
import { CatanLobby, CatanScreen } from './catan/CatanScreen';
import { ChessScreen } from './chess/ChessScreen';
import { CHESS_TEXT, RULE_KEYS as CHESS_RULES } from './chess/text';
import { NavalScreen } from './naval/NavalScreen';
import { NAVAL_TEXT, RULE_KEYS as NAVAL_RULES } from './naval/text';
import { ForcaLobby, ForcaScreen } from './forca/ForcaScreen';
import type { GameModule } from './module';
import { pistaModule } from './pista/game';
import { PistaScreen } from './pista/PistaScreen';
import { PISTA_TEXT, RULE_KEYS as PISTA_RULES } from './pista/text';
import { useGameText, type GameScreenProps, type Texts } from './shared/GameFrame';
import { SimpleLobby, type LobbyProps } from './shared/SimpleLobby';
import { StopLobby, StopScreen } from './stop/StopScreen';
import { SudokuLobby, SudokuScreen } from './sudoku/SudokuScreen';
import { VELHA_RULES, VELHA_TEXT, VelhaScreen } from './velha/VelhaScreen';
import { VidaScreen } from './vida/VidaScreen';
import { ZEROU_RULES, ZEROU_TEXT, ZerouScreen } from './zerou/ZerouScreen';
import { VidaLobby } from './vida/VidaLobby';

function rulesLobby(game: GameId, texts: Texts, keys: string[]): ComponentType<LobbyProps> {
  return function RulesLobby(props: LobbyProps) {
    const t = useGameText(texts);
    return <SimpleLobby {...props} rules={{ game, title: t('rulesTitle'), paragraphs: keys.map(k => t(k)) }} />;
  };
}

/** A lobby whose one setting is the language of the words (Pista Certa). */
function wordsLobby(game: GameId, texts: Texts, keys: string[], module: GameModule<{ words: 'pt' | 'en' }>): ComponentType<LobbyProps> {
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
    return <SimpleLobby {...props} options={options} rules={{ game, title: t('rulesTitle'), paragraphs: keys.map(k => t(k)) }} />;
  };
}

/** Lobby and game screens of the games built on the shared frame. */
export const NEW_GAMES: Partial<Record<GameId, { Lobby: ComponentType<LobbyProps>; Screen: ComponentType<GameScreenProps> }>> = {
  chess: { Lobby: rulesLobby('chess', CHESS_TEXT, CHESS_RULES), Screen: ChessScreen },
  pista: { Lobby: wordsLobby('pista', PISTA_TEXT, PISTA_RULES, pistaModule), Screen: PistaScreen },
  vida: { Lobby: VidaLobby, Screen: VidaScreen },
  naval: { Lobby: rulesLobby('naval', NAVAL_TEXT, NAVAL_RULES), Screen: NavalScreen },
  zerou: { Lobby: rulesLobby('zerou', ZEROU_TEXT, ZEROU_RULES), Screen: ZerouScreen },
  velha: { Lobby: rulesLobby('velha', VELHA_TEXT, VELHA_RULES), Screen: VelhaScreen },
  forca: { Lobby: ForcaLobby, Screen: ForcaScreen },
  stop: { Lobby: StopLobby, Screen: StopScreen },
  sudoku: { Lobby: SudokuLobby, Screen: SudokuScreen },
  catan: { Lobby: CatanLobby, Screen: CatanScreen },
};
