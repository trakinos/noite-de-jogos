# Dono do Bairro Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the host game-agnostic. Then build the complete Dono do Bairro rules engine (classic Banco Imobiliário rules, neighborhood names) with its game module, so that a host could run a full game. The engine is tested by unit tests, bot simulations and fuzzing.

**Architecture:**
- **Generic host:** `HostSession` takes a `GameModule`, which owns setup, intents, views, the clock input and timeouts. The lobby, seats, colors, rejoin and turn clock stay generic. Dominion becomes the first module, through a thin adapter around its existing `Game`. Dominion's rules code is not changed.
- **Dono do Bairro engine:** a plain serializable state plus `apply(state, playerIndex, intent)`, as an explicit state machine. There are no paused generators, so every state can be saved later.
- **Scope:** no UI in this plan. The board screens come in the next plan, after board mockups. The front page keeps Dono do Bairro as "Em breve", so this ships nothing player-visible.

**Tech Stack:** TypeScript, Vitest. Seeded RNG from `src/engine/rng.ts`.

**Spec:** `docs/superpowers/specs/2026-10-24-noite-de-jogos-banco-imobiliario-design.md` (sections 4.4, 5, 6b, 8; section 6 "Partida rápida" is a later plan)

## Global Constraints

- Dominion's rules (`src/engine/**`, `src/cards/**`) are not edited. Its existing tests keep passing. They may only change imports/fixtures where `HostSession`'s constructor or `LobbyState` changes shape.
- **Classic rules, as the spec states them:**
  - no auction;
  - one Deu Bom / Deu Ruim deck;
  - 6 serviços: rent = dice total × multiplier, doubled when one owner holds all 6;
  - full rua with no buildings: base rent ×2;
  - even building; 4 puxadinhos, then a prédio; buildings sell back at ½ their cost;
  - mortgage at the printed value, paid off at that value +20% (rounded up to a whole $);
  - Xilindró (jail) up to 3 turns, with a $50 fine;
  - 3 doubles in a row → Xilindró;
  - passing or landing on Ponto de Ônibus pays $200;
  - trades only on the proposer's own turn; no loans.
- **Working values** (the user checks them later; only data files change): the board, prices and rents in Task 4. Starting money **$1,500**.
- **Names:** the engine uses stable ids only. All player-facing text (square names, card text, log lines, refusal reasons) lives in `src/games/bairro/i18n/{pt,en}.ts`, and a coverage test proves every id and key has text in both languages. Theme names come from spec 6b.
- The engine is pure and deterministic: `(state, rng in state, intent) → new state`. It never reads `Math.random` or the clock.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. No pushes.

## Review Focus

1. **A debtor with too little cash and buildings in an uneven rua.** Liquidation (by the player or by a timeout) must sell evenly. It must never leave a rua breaking the even rule, and never sell a building that the even rule forbids. Covered in Task 9, `liquidate` tests.
2. **A rent or "pay every player" debt landing on a player who isn't the current player.** The turn must wait for them. Only sell/mortgage/pay/bankrupt intents are accepted from them, and the current player cannot roll or end the turn in the meantime. Covered in Task 9.
3. **Doubles on the roll that sends you to the Xilindró, or a card that sends you there.** No extra roll follows. Doubles while leaving the Xilindró move you, but don't give another roll. Covered in Tasks 5 and 6.
4. **A trade that would leave someone owing money they don't have, or that includes a ponto whose rua has buildings.** It is refused at proposal time and again at acceptance time, because state may have changed in between. Covered in Task 10.
5. **A bankrupt player's seat:** they are skipped in turn order, can't act, still get views, and the game ends when one solvent player is left. Covered in Task 9.

---

## Part A — Generic host

### Task 1: GameModule interface and the Dominion adapter

**Files:**
- Create: `src/games/module.ts`, `src/games/dominion/module.ts`
- Test: `src/games/dominion/module.test.ts`

**Interfaces:**
- Produces, in `src/games/module.ts`:
  ```ts
  export interface SeatInfo { id: string; name: string }
  export type ApplyResult = { ok: true } | { ok: false; reason: string };
  export interface GameInstance {
    apply(playerId: string, intent: unknown): ApplyResult;
    /** This player's view; must include `log` as an array the host trims to MAX_LOG_ENTRIES. */
    viewFor(playerId: string): { log: unknown[] };
    clockInput(): ClockInput;           // from src/net/turnClock
    readonly over: boolean;
    /** Time ran out for `kind`: make the cautious move(s). */
    expire(kind: ClockKind, seed: number): void;
  }
  export interface GameModule<Options = unknown> {
    id: GameId;
    minPlayers: number;
    maxPlayers: number;
    defaultOptions(): Options;
    /** Validates options sent from the host's lobby UI; returns the clean options or a refusal reason. */
    parseOptions(raw: unknown): Options | { error: string };
    create(seats: SeatInfo[], options: Options, seed: number): GameInstance;
  }
  ```
- Produces, in `src/games/dominion/module.ts`: `interface DominionOptions { kingdom: CardId[] }` and `const dominionModule: GameModule<DominionOptions>`, with `minPlayers: 2` and `maxPlayers: 4`. `parseOptions` applies today's `setKingdom` rule ("Choose 10 different kingdom cards"). `expire` reproduces today's `HostSession.expire` body, moved here unchanged.

- [ ] **Step 1: Write failing tests** in `module.test.ts`:
  - `defaultOptions().kingdom` equals `DEFAULT_KINGDOM`.
  - `parseOptions({kingdom: [...9 ids]})` returns `{ error: 'Choose 10 different kingdom cards' }`.
  - `create` with 2 seats gives `viewFor('p0').hand.length === 5`.
  - `apply('p1', {type:'endPhase'})` gives `{ ok: false, reason: 'It is not your turn' }`.
  - `expire('turn', 1)` moves `clockInput().currentPlayer` from 0 to 1.
- [ ] **Step 2:** `npx vitest run src/games/dominion` → FAIL (module missing).
- [ ] **Step 3:** Implement both files. `clockInput()` returns the exact object `HostSession.gameChanged` builds today.
- [ ] **Step 4:** Run the same command → PASS. Then run `npm test && npm run typecheck` → all pass.
- [ ] **Step 5: Commit:** `feat: GameModule interface and Dominion adapter`

### Task 2: HostSession runs any GameModule

**Files:**
- Modify: `src/net/host.ts`, `src/net/protocol.ts`, `src/net/testing.ts`, `src/ui/connect.ts`, `src/ui/screens/Lobby.tsx`, `src/ui/components/KingdomPicker.tsx` (only if it reads `lobby.kingdom`), the `src/net/*.test.ts` that build `HostSession` or read `lobby.kingdom`
- Create: `src/games/registry.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - `new HostSession(module: GameModule, opts?: HostOptions)`.
  - `LobbyState` becomes `{ hostId; players; game: GameId; options: unknown; inGame; turnTimer; minPlayers: number; maxPlayers: number }`. `kingdom` is removed; Dominion reads `(lobby.options as DominionOptions).kingdom`.
  - Host methods: `setOptions(raw: unknown): ApplyResult` (refused during a game), `start()`, `playAgain()`, `backToLobby()`, `setTurnTimer()` and `close()` keep their current semantics.
  - `setKingdom`, `randomizeKingdom` and `resetKingdom` are deleted. `Lobby.tsx` builds the kingdom and calls `host.setOptions({ kingdom })`. It randomizes with `shuffle(createRng(seed), KINGDOM_IDS).slice(0, 10)`, seeded from `Math.random` in the UI.
  - `HostMessage` `view` is typed `unknown`. `GuestState.view` is `unknown`, and each game's screens cast it to their view type in one helper (Dominion: `asDominionView(v: unknown): PlayerView`, in `src/games/dominion/module.ts`).
  - `src/games/registry.ts`: `export const MODULES: Partial<Record<GameId, GameModule>> = { dominion: dominionModule }` and `export function moduleFor(id: GameId): GameModule` (throws for a missing module).
  - `hostGame(game: GameId, name: string)` in `connect.ts`.
  - `parseHostMessage` validates `lobby.game` with `isGameId`; a missing or invalid value becomes `'dominion'`, so an old host still works.
  - `seededHostOptions` is unchanged. Tests create `new HostSession(dominionModule, …)`.

- [ ] **Step 1: Update the tests first.**
  - Change every `new HostSession(` in `src/net/*.test.ts` to pass `dominionModule`.
  - Replace `setKingdom` calls with `setOptions({ kingdom })`, and `lobby.kingdom` reads with `(lobby.options as DominionOptions).kingdom`.
  - New test in `host.test.ts`: `lobby.minPlayers === 2 && lobby.maxPlayers === 4 && lobby.game === 'dominion'`.
  - New test in `protocol.test.ts`: a lobby message with no `game` parses with `game === 'dominion'`, and one with `game: 'chess'` also parses as `'dominion'`.
- [ ] **Step 2:** `npx vitest run src/net` → FAIL (wrong constructor arity, missing `setOptions`).
- [ ] **Step 3: Implement.**
  - `HostSession` keeps `module`, `options` and `instance: GameInstance | null`.
  - `start()` checks `seats.length >= module.minPlayers`. `hello()` checks against `module.maxPlayers` and refuses with "Room full".
  - `gameChanged()` uses `instance.clockInput()`, and the clock's `expire` callback calls `instance.expire(kind, newSeed())`. The views and the log trim are unchanged.
  - Remove the Dominion imports from `host.ts`.
- [ ] **Step 4:** Update `Lobby.tsx`, `App.tsx` (pass `asDominionView(state.view)` to `Board` and `EndScreen`) and `connect.ts` (`hostGame('dominion', name)` from `onHost`).
- [ ] **Step 5:** `npm test && npm run typecheck` → all pass.
- [ ] **Step 6: Browser check.** Start preview `dev`. Host Dominion, join from a second tab, then:
  - randomize the kingdom and pick a timer;
  - start the game, play a turn, and end the game;
  - check the console has no errors.
- [ ] **Step 7: Commit:** `refactor: HostSession runs any GameModule; Dominion is the first module`

### Task 3: App routes screens by the room's game

**Files:**
- Modify: `src/ui/App.tsx`, `src/i18n/pt.ts`, `src/i18n/en.ts`
- Create: `src/ui/gameScreens.ts`
- Test: `src/ui/gameScreens.test.ts`

**Interfaces:**
- Produces: `function screensFor(game: GameId): 'dominion' | 'unsupported'`. Today it returns `'dominion'` for dominion and `'unsupported'` for everything else. The UI plan adds `'bairro'`.
- With `'unsupported'`, App shows a Centered message using the new UI key `unsupportedGame`:
  - pt: "Esta sala é de um jogo que esta versão ainda não tem. Atualize a página."
  - en: "This room is for a game this version doesn't have yet. Refresh the page."
  - Below it, a "Sair" (leave) button calls `leave()`.

- [ ] **Step 1:** Write tests: `screensFor('dominion') === 'dominion'` and `screensFor('bairro') === 'unsupported'`.
- [ ] **Step 2:** Run `npx vitest run src/ui/gameScreens.test.ts` → FAIL.
- [ ] **Step 3:** Implement `screensFor`. In App, check `screensFor(state.lobby.game)` before rendering the Lobby or Board, then add the keys.
- [ ] **Step 4:** `npm test && npm run typecheck` → all pass.
- [ ] **Step 5: Commit:** `feat: route lobby and board screens by the room's game`

## Part B — Dono do Bairro engine

All files live under `src/games/bairro/`. The tests sit next to the code.

### Task 4: Board, deck data and dictionaries

**Files:**
- Create: `board.ts`, `deck.ts`, `i18n/pt.ts`, `i18n/en.ts`, `i18n/index.ts`
- Test: `board.test.ts`, `i18n/coverage.test.ts` (the data part)

**Interfaces:**
- Produces, in `board.ts`:
  ```ts
  export type RuaId = 'r1'|'r2'|'r3'|'r4'|'r5'|'r6'|'r7'|'r8';
  export interface PontoSquare { kind: 'ponto'; id: string; rua: RuaId; price: number; rent: [number, number, number, number, number, number]; houseCost: number; mortgage: number }
  export interface ServicoSquare { kind: 'servico'; id: string; price: number; multiplier: number; mortgage: number }
  export type Square = PontoSquare | ServicoSquare
    | { kind: 'start' | 'luck' | 'jail' | 'pracinha' | 'goToJail'; id: string }
    | { kind: 'iptu' | 'bolao'; id: string; amount: number };
  export const BOARD: readonly Square[];          // 40 entries, index = position
  export const RUAS: Record<RuaId, string[]>;     // ponto ids per rua, cheapest first
  export const START_MONEY = 1500, PASS_START = 200, JAIL_FINE = 50, JAIL_POS = 10, MORTGAGE_INTEREST = 0.2, MAX_HOUSES = 4;
  export function unmortgageCost(sq: PontoSquare | ServicoSquare): number; // Math.ceil(mortgage * 1.2)
  ```
- `rent` holds the rent for [no buildings, 1, 2, 3, 4 puxadinhos, prédio]. `mortgage` = price / 2.
- In `deck.ts`:
  ```ts
  export type LuckEffect = { kind: 'money'; amount: number }          // + from bank, − to bank
    | { kind: 'eachPlayer'; amount: number }                          // + each other player pays you, − you pay each
    | { kind: 'advanceToStart' } | { kind: 'goToJail' } | { kind: 'lawyer' };
  export interface LuckCard { id: string; tone: 'bom' | 'ruim'; effect: LuckEffect }
  export const DECK: readonly LuckCard[];
  ```

**Working board** (positions follow the classic geometry; ponto ids = spec 6b names in kebab case; ruas in spec 6b order):

| Pos | Square | Price | Rent (0/1/2/3/4/prédio) | House |
|---|---|---|---|---|
| 0 | start (Ponto de Ônibus) | | | |
| 1 | borracharia (r1) | 60 | 2/10/30/90/160/250 | 50 |
| 2 | luck | | | |
| 3 | lava-jato (r1) | 60 | 4/20/60/180/320/450 | 50 |
| 4 | iptu, amount 200 | | | |
| 5 | servico kombi | 200 | × 8 | |
| 6 | lan-house (r2) | 100 | 6/30/90/270/400/550 | 50 |
| 7 | luck | | | |
| 8 | bicicletaria (r2) | 100 | 6/30/90/270/400/550 | 50 |
| 9 | chaveiro (r2) | 120 | 8/40/100/300/450/600 | 50 |
| 10 | jail (Xilindró) | | | |
| 11 | quitanda (r3) | 140 | 10/50/150/450/625/750 | 100 |
| 12 | servico mototaxi | 150 | × 5 | |
| 13 | acougue (r3) | 140 | 10/50/150/450/625/750 | 100 |
| 14 | peixaria (r3) | 160 | 12/60/180/500/700/900 | 100 |
| 15 | servico carro-do-ovo | 200 | × 8 | |
| 16 | salao-da-cida (r4) | 180 | 14/70/200/550/750/950 | 100 |
| 17 | luck | | | |
| 18 | barbearia (r4) | 180 | 14/70/200/550/750/950 | 100 |
| 19 | atelie-de-costura (r4) | 200 | 16/80/220/600/800/1000 | 100 |
| 20 | pracinha | | | |
| 21 | papelaria (r5) | 220 | 18/90/250/700/875/1050 | 150 |
| 22 | luck | | | |
| 23 | loja-de-1-99 (r5) | 220 | 18/90/250/700/875/1050 | 150 |
| 24 | farmacia (r5) | 240 | 20/100/300/750/925/1100 | 150 |
| 25 | servico caminhao-do-gas | 200 | × 8 | |
| 26 | pastelaria (r6) | 260 | 22/110/330/800/975/1150 | 150 |
| 27 | sorveteria (r6) | 260 | 22/110/330/800/975/1150 | 150 |
| 28 | servico sorveteiro | 150 | × 5 | |
| 29 | padaria (r6) | 280 | 24/120/360/850/1025/1200 | 150 |
| 30 | goToJail | | | |
| 31 | boteco (r7) | 300 | 26/130/390/900/1100/1275 | 200 |
| 32 | pizzaria (r7) | 300 | 26/130/390/900/1100/1275 | 200 |
| 33 | luck | | | |
| 34 | churrascaria (r7) | 320 | 28/150/450/1000/1200/1400 | 200 |
| 35 | servico van-escolar | 200 | × 8 | |
| 36 | luck | | | |
| 37 | academia (r8) | 350 | 35/175/500/1100/1300/1500 | 200 |
| 38 | bolao, amount 200 | | | |
| 39 | supermercado (r8) | 400 | 50/200/600/1400/1700/2000 | 200 |

**Deck** (30 cards): 
- 2 × `lawyer` (Carta do Advogado);
- 2 × `goToJail`;
- 2 × `advanceToStart`;
- `money`: +200, +150, +100, +100, +50, +50, +25, +20, −200, −150, −100, −100, −50, −50, −25, −20;
- `eachPlayer`: +50, +20, −50, −20;
- 4 more `money`: +75, −75, +10, −10.

`tone` is `bom` for positive amounts, `advanceToStart` and `lawyer`, and `ruim` otherwise. Card ids are `c01`…`c30`.

**Dictionaries** (`i18n/{pt,en}.ts`) export a `BairroDictionary`:
```ts
{ squares: Record<string, string>; ruas: Record<RuaId, string>;
  cards: Record<string, string>; log: Record<string, string>;
  reasons: Record<string, string>; terms: Record<string, string> }
```
- **ruas:** pt names from spec 6b (Beco do Samba … Alameda das Mansões). The en names keep the pt proper names.
- **squares:** pt names (Borracharia, … Supermercado, Kombi, …, Ponto de Ônibus, Xilindró, Vá pro Xilindró, Pracinha, IPTU, Bolão, Deu Bom / Deu Ruim).
- **cards:** text in the neighborhood voice. Examples: "Ganhou o bingo da quermesse: receba $100", "Multa do rapa: pague $50", "A vaquinha do vizinho: receba $20 de cada jogador". English translations go in en.
- **terms:** puxadinho, prédio, escritura, prefeitura, faliu, dono-do-bairro.
- **log and reasons:** keys are added in Tasks 5–10. Each task adds its keys to both languages.

- [ ] **Step 1: Write failing tests** in `board.test.ts`:
  - `BOARD.length === 40`;
  - there are 22 pontos, 6 servicos and 6 luck squares;
  - `RUAS` covers every ponto exactly once, with sizes [2,3,3,3,3,3,3,2] for r1…r8;
  - every ponto has `mortgage === price/2`;
  - `unmortgageCost` of the 60-price ponto is 36;
  - `DECK.length === 30`, and its ids are unique.
  In `i18n/coverage.test.ts`: every square id, rua id and card id has a non-empty string in both `pt` and `en`.
- [ ] **Step 2:** `npx vitest run src/games/bairro` → FAIL.
- [ ] **Step 3:** Write the data and the dictionaries.
- [ ] **Step 4:** Same command → PASS. Then run `npm run typecheck`.
- [ ] **Step 5: Commit:** `feat(bairro): working board, deck and dictionaries`

### Task 5: State, setup, rolling, moving and landing

**Files:**
- Create: `types.ts`, `setup.ts`, `engine.ts`
- Test: `engine.test.ts`, `testkit.ts` (test-only helpers)

**Interfaces:**
- Produces, in `types.ts`:
  ```ts
  export interface BairroPlayer { id: string; name: string; cash: number; pos: number; jailTurns: number | null; lawyerCards: number; bankrupt: boolean }
  export interface Ownership { owner: number; houses: number /* 0–4, 5 = prédio */; mortgaged: boolean }
  export type Phase =
    | { kind: 'roll' }                         // current player must roll (or act on jail options)
    | { kind: 'buy'; square: number }          // landed on an unowned ponto/servico
    | { kind: 'manage'; rollAgain: boolean }   // build/trade/etc; then roll again (doubles) or end turn
  export interface Debt { debtor: number; creditor: number | null /* null = bank */; amount: number }
  export interface BairroState {
    players: BairroPlayer[]; current: number; phase: Phase;
    owned: Record<number, Ownership>;          // keyed by board position
    deck: string[];                            // card ids, top first; lawyer cards in hand are out of it
    doublesInRow: number; lastRoll: [number, number] | null;
    debts: Debt[]; offer: Offer | null;        // Offer defined in Task 10
    log: BairroLogEntry[]; rng: RngState; winner: number | null;
  }
  export interface BairroLogEntry { player: number | null; key: string; params?: Record<string, string | number> }
  export type BairroIntent =
    | { type: 'roll' } | { type: 'buy' } | { type: 'decline' } | { type: 'endTurn' }
    | { type: 'payJailFine' } | { type: 'useLawyer' }                          // Task 6
    | { type: 'build'; pos: number } | { type: 'sellBuilding'; pos: number }  // Task 8
    | { type: 'mortgage'; pos: number } | { type: 'unmortgage'; pos: number } // Task 8
    | { type: 'payDebt' } | { type: 'goBankrupt' }                            // Task 9
    | { type: 'proposeTrade'; offer: OfferTerms } | { type: 'cancelTrade' } | { type: 'answerTrade'; accept: boolean }; // Task 10
  ```
- `setup.ts`: `createBairro(seats: SeatInfo[], seed: number): BairroState`. Turn order is shuffled from the seed, the deck is shuffled, everyone gets `START_MONEY`, and the phase is `roll`.
- `engine.ts`: `export function apply(s: BairroState, player: number, intent: BairroIntent): ApplyResult`. It mutates `s` in place, the same way Dominion's `Game` does. Every refusal returns a reason string that is a key of `reasons`. Dice come from `nextInt(s.rng, 6) + 1`.
- `testkit.ts` (tests only):
  - `game(n, seed?)`;
  - `rig(s, dice: [number, number][])`, which forces the next dice by wrapping the roll;
  - `give(s, player, pos, opts?)`.

**Rules in this task:**
- **roll:** move by the sum. Passing or landing on 0 pays `PASS_START` (log `passStart`). Then land:
  - unowned ponto or servico → phase `buy`;
  - owned by someone else, not mortgaged, owner not bankrupt → rent:
    - a ponto with houses 0 pays `rent[0]`, doubled if the owner holds the whole rua with no buildings anywhere in it;
    - a ponto with houses n pays `rent[n]`;
    - a servico pays dice sum × multiplier, ×2 if the owner holds all 6 servicos.
  - The rent is paid at once if the player has the cash. Otherwise it is recorded as a `Debt` (Task 9 resolves it; until then this task's tests only use solvent players).
  - `iptu` → pay its amount to the bank (same cash/debt rule). `bolao` → receive its amount.
  - `goToJail` → `pos = JAIL_POS`, `jailTurns = 0`, no `PASS_START`, phase `manage` with `rollAgain: false`.
  - `luck` → Task 7 (this task leaves a stub that logs `luckDrawn` and does nothing else).
  - After landing, the phase is `buy`, or `manage` with `rollAgain` set to "it was doubles and the player isn't in jail".
- **doubles:** `doublesInRow++`. A third double in a row sends the player to jail instead of moving.
- **buy:** needs cash ≥ price. Sets the owner and logs `bought`. **decline** logs `declined`. Both go to `manage`.
- **endTurn:** only in `manage` with `rollAgain: false` and no open debts. Moves to the next non-bankrupt player and resets `doublesInRow`.
- **Guards:** a player who isn't current is refused with `notYourTurn`, and an intent in the wrong phase with `notNow`. Task 9 adds the debt exceptions.

- [ ] **Step 1: Write failing tests** in `engine.test.ts`:
  - setup gives 2–6 players $1500 each, and a different seed gives a different order;
  - rolling (3,4) from 0 lands on 7;
  - passing 0 from 38 with (1,2) pays $200;
  - landing on an unowned 60 ponto → `buy`, and buying costs $60;
  - declining → `manage`, and the square stays unowned;
  - rent on an owned ponto is 2, rises to 4 when the owner holds the whole rua with no buildings, and is 0 while mortgaged;
  - a servico with dice 3+4 and multiplier 8 → $56, and → $112 when the owner holds all 6;
  - IPTU takes 200 and Bolão adds 200;
  - landing on 30 → jail, with no $200;
  - doubles → `manage` with `rollAgain: true`, then `roll` is allowed and `endTurn` refused;
  - a third double goes to jail;
  - `endTurn` skips bankrupt players;
  - acting off-turn → `notYourTurn`.
- [ ] **Step 2:** `npx vitest run src/games/bairro/engine.test.ts` → FAIL.
- [ ] **Step 3:** Implement. Add every log and reason key you use to both dictionaries.
- [ ] **Step 4:** Same command → PASS.
- [ ] **Step 5: Commit:** `feat(bairro): setup, dice, movement, buying and rent`

### Task 6: Xilindró (jail)

**Files:** Modify `engine.ts`, `engine.test.ts` (new `describe('jail')`), dictionaries.

**Rules:**
- In jail, during phase `roll`, the player may first send `payJailFine` (cash ≥ 50) or `useLawyer` (`lawyerCards > 0`; the card goes to the bottom of the deck). Either one releases them, and they then roll normally (doubles count).
- Otherwise `roll`:
  - doubles → released, move by that roll, and **no** extra roll;
  - no doubles → `jailTurns++` and phase `manage` with `rollAgain: false`;
  - on the third failed roll, they pay the fine (or take it on as a debt) and move by that roll.
- Rent is still collected while in jail.

- [ ] **Step 1: Write failing tests** for:
  - each way out (fine, lawyer card, doubles);
  - the third-turn forced fine plus the move;
  - no extra roll after a doubles release;
  - an owner in jail still receiving rent.
- [ ] **Step 2: Watch them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Watch them pass.**
- [ ] **Step 5: Commit:** `feat(bairro): Xilindró`

### Task 7: Deu Bom / Deu Ruim

**Files:** Modify `engine.ts`, `engine.test.ts` (`describe('luck')`), dictionaries.

**Rules:**
- Landing on `luck`: take the top card and apply its effect. The card goes to the bottom of the deck, except a lawyer card, which the player keeps (`lawyerCards++`).
- **money:** paid to or from the bank, using the debt rule.
- **eachPlayer +n:** every other solvent player pays n to the drawer. Each payer who can't afford it gets a `Debt`, and these are off-turn debts (Task 9).
- **eachPlayer −n:** the drawer pays n to each other solvent player.
- **advanceToStart:** move to 0 and collect $200.
- **goToJail:** as in Task 5, with no extra roll even after doubles.
- Log `luck` with `{ card }`.

- [ ] **Step 1: Write failing tests**, one per effect kind, using `rig`-style deck control (`s.deck = ['cNN', …]`), for:
  - the lawyer card being kept and leaving the deck;
  - a card that is used going to the bottom of the deck.
- [ ] **Step 2: Watch them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Watch them pass.**
- [ ] **Step 5: Commit:** `feat(bairro): Deu Bom / Deu Ruim deck`

### Task 8: Building, selling and mortgages

**Files:** Modify `engine.ts`, and create `assets.ts` (helpers) with its tests in `assets.test.ts`. Update the dictionaries.

**Interfaces:**
- In `assets.ts`:
  - `ownsWholeRua(s, player, rua): boolean`
  - `canBuild(s, player, pos): string | null` (null = allowed, else a reason key)
  - `canSell(s, player, pos): string | null`
  - `canMortgage(s, player, pos): string | null`
  - `liquidationValue(s, player): number` (cash + half the cost of every building + the mortgage value of every unmortgaged asset)

**Rules:**
- All of these are allowed only in phase `manage` or `roll`, on the player's own turn, with no offer open. Task 9 adds the exception for debtors.
- **build:**
  - the player owns the whole rua and nothing in it is mortgaged;
  - even building: the target's houses must equal the rua's minimum;
  - houses < 5;
  - cash ≥ `houseCost`;
  - houses 4→5 makes a prédio.
- **sellBuilding:**
  - even selling: the target's houses must equal the rua's maximum and be > 0;
  - refund `houseCost/2`;
  - a prédio (5) becomes 4.
- **mortgage:** no buildings anywhere in the rua (servicos have no rua); pays out `mortgage`.
- **unmortgage:** cash ≥ `unmortgageCost`.

- [ ] **Step 1: Write failing tests** (`assets.test.ts` and engine) for:
  - building being refused without the whole rua, when uneven, while mortgaged, and without cash;
  - 4 puxadinhos → prédio;
  - selling evenly at half price;
  - mortgage being refused when the rua has buildings;
  - unmortgage of the 60 ponto costing 36;
  - `liquidationValue` on a hand-built state.
- [ ] **Step 2: Watch them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Watch them pass.**
- [ ] **Step 5: Commit:** `feat(bairro): building, selling and mortgages`

### Task 9: Debts, bankruptcy and winning

**Files:** Modify `engine.ts`, `assets.ts`, their tests, and the dictionaries.

**Interfaces:**
- `liquidate(s, player, target: number): void`. It raises cash up to `target` in a fixed order, which is the same one the timeout uses:
  1. sell buildings: the most expensive rua first, always from a rua's highest building (even selling);
  2. then mortgage: the cheapest unmortgaged assets first.
  It stops as soon as `cash >= target`.

**Rules:**
- **While `debts` is not empty:**
  - each debtor may send `sellBuilding`, `mortgage`, `payDebt` (needs cash ≥ amount) or `goBankrupt` (allowed only when `liquidationValue < amount`). This works on and off their turn.
  - every other intent from anyone is refused with `waitingForDebts`.
  - `payDebt` transfers the money and removes the debt.
- **Bankrupt to a player:**
  - buildings are sold to the bank first, and the cash goes to the creditor;
  - the bankrupt player's remaining cash, owned assets (mortgages stay as they are) and lawyer cards go to the creditor.
- **Bankrupt to the bank:** the assets go back unowned and unmortgaged, and lawyer cards go to the bottom of the deck.
- **After bankruptcy:** set `bankrupt = true`. If the bankrupt player was current, the turn passes to the next player. With exactly one solvent player left, `winner` is set and every intent is refused with `gameOver`.

- [ ] **Step 1: Write failing tests** for:
  - rent the player can't pay → a Debt, and `endTurn` and `roll` are refused with `waitingForDebts`;
  - selling, then `payDebt`, clearing the debt;
  - `goBankrupt` refused while the liquidation value covers the debt;
  - bankruptcy to a player transferring cash, assets and lawyer cards;
  - bankruptcy to the bank resetting the assets;
  - an off-turn `eachPlayer` debtor acting on another player's turn while the current player waits;
  - `liquidate` leaving every rua even (Review Focus #1);
  - the last solvent player winning;
  - a bankrupt seat being skipped in turn order and refused when it acts.
- [ ] **Step 2: Watch them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Watch them pass.**
- [ ] **Step 5: Commit:** `feat(bairro): debts, bankruptcy and the winner`

### Task 10: Trades

**Files:** Modify `types.ts`, `engine.ts`, their tests, and the dictionaries.

**Interfaces:**
```ts
export interface OfferSide { assets: number[] /* board positions */; cash: number; lawyerCards: number }
export interface OfferTerms { to: number; give: OfferSide; get: OfferSide }
export interface Offer extends OfferTerms { from: number }
```

**Rules:**
- **proposeTrade:** only the current player can propose, in `roll` or `manage`, with no debts and no open offer.
- **Validity, checked on proposal and again on acceptance:**
  - `to` is another solvent player;
  - each listed asset belongs to the right side;
  - no asset's rua has buildings;
  - cash and lawyer cards are within what each side holds;
  - the offer isn't empty on both sides.
- **cancelTrade:** only by the proposer.
- **answerTrade:** only by `to`.
  - On accept, assets swap owners (keeping their mortgaged flag), and cash and lawyer cards move.
  - On decline, nothing happens. Either way the offer is cleared.
- While an offer is open, only `cancelTrade` from the proposer and `answerTrade` from the recipient are accepted.

- [ ] **Step 1: Write failing tests** for:
  - a valid trade both ways;
  - a refusal for an asset in a rua with buildings;
  - a refusal for cash beyond holdings;
  - an off-turn proposal refused;
  - an acceptance refused once the state changed so the offer is invalid (for example the recipient spent the cash);
  - every other intent blocked while an offer is open;
  - a mortgaged asset staying mortgaged after the trade.
- [ ] **Step 2: Watch them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Watch them pass.**
- [ ] **Step 5: Commit:** `feat(bairro): trades on your own turn`

### Task 11: View, timeouts, module, bot simulation and fuzzing

**Files:**
- Create: `view.ts`, `timeout.ts`, `module.ts`, `bot.ts`
- Tests: `view.test.ts`, `timeout.test.ts`, `simulation.test.ts`, `fuzz.test.ts`, plus extending `i18n/coverage.test.ts`
- Modify: `src/games/registry.ts`

**Interfaces:**
- **`viewFor(s, player): BairroView`:** the whole state except the deck order. It includes `deckCount`, `you`, and `pending: 'roll' | 'buy' | 'manage' | 'debt' | 'tradeAnswer' | 'wait'` for this player.
- **`clockInput(s): ClockInput`:**
  - `turn` is a turn object that is replaced on `endTurn`;
  - `pending` is `{ player }` for the offer recipient or for a single off-turn debtor;
  - `group` is the `debts` array identity when 2 or more off-turn debtors exist.
- **`expire(s, kind)`:**
  - for `kind === 'response'`: decline the open offer, then for each off-turn debtor run `liquidate`, then `payDebt` or `goBankrupt`;
  - for `kind === 'turn'`, as the current player:
    1. cancel their offer;
    2. settle their own debt the same way;
    3. in `buy`, decline;
    4. in jail, roll;
    5. in `roll`, roll;
    6. in `manage`, roll again if `rollAgain`, otherwise end the turn.
  - It loops until the turn changes or the game ends (cap 500). It never buys, builds, unmortgages or proposes trades.
- **`bairroModule: GameModule<Record<string, never>>`:** `minPlayers: 2`, `maxPlayers: 6`, `defaultOptions: () => ({})`, `parseOptions` accepts `{}`. Register it in `MODULES`. The catalog's `available` stays `false` until the UI plan.
- **`bot.ts`:** `botMove(s): { player: number; intent: BairroIntent }`, a simple legal strategy:
  - buy when cash after buying ≥ 200;
  - build when the player holds a whole rua and has cash ≥ 300 + cost;
  - settle debts by `liquidate`;
  - never trade (except in the fuzz test).

- [ ] **Step 1: Write failing tests.**
  - **View:**
    - the deck order is never in a view;
    - `pending` is correct for the current player, an off-turn debtor and a trade recipient.
  - **Timeout:**
    - a turn timeout ends the turn, declines the buy and pays the debt via `liquidate`;
    - it never builds or buys;
    - a response timeout declines the offer.
  - **Simulation:** 200 seeded games, 2–6 bots, each ending with a winner or hitting 5,000 turns. Invariants checked after every move:
    - total money + everything on the bank side is consistent: the bank is unlimited, so check instead that no cash is ever negative;
    - every rua stays even;
    - nobody owns an asset after bankruptcy.
  - **Fuzz:** 50 seeded games where each step either sends a random intent (random `type`, random positions, random offers) from a random player, or a bot move. It must never throw, and all refusals must be keys of `reasons`.
  - **Coverage:** every log key and reason key produced across the simulation and the fuzz run exists in both dictionaries. Every dictionary log key is reached, or is listed in an allowlist with a reason.
- [ ] **Step 2: Watch them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** `npm test && npm run typecheck` → all pass.
- [ ] **Step 5: Commit:** `feat(bairro): views, timeouts, game module, bot simulation and fuzzing`

### Task 12: Docs

- [ ] Update `docs/ROADMAP.md`:
  - tick "Generic host" and the engine items (board data, engine, building, mortgage, Xilindró, trading, debts and bankruptcy, timer and timeouts, engine tests);
  - note the working values;
  - leave "Board mockups" and the screens unticked.
- [ ] Add a short "Engine notes" section to the spec's section 8 listing the working values chosen here: the classic geometry, Monopoly-proportioned prices and rents, $1,500 to start, serviço multipliers 5 and 8, IPTU and Bolão at $200.
- [ ] **Commit:** `docs: Dono do Bairro engine status`
