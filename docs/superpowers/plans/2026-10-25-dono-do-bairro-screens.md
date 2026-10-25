# Dono do Bairro Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Dono do Bairro playable on the site:
- lobby, board, prompts, title deeds (escrituras), trades, log, rules and end screen;
- on computers, the "neighborhood map" board;
- on phones, the "street in focus" board;
- the front page row turns on at the end.

**Architecture:**
- Game screens live under `src/games/bairro/ui/`, and App routes to them through `screensFor`.
- Every decision a screen makes lives in small pure helpers that are unit-tested:
  - what a square shows;
  - which buttons are available;
  - how a log line reads;
  - the ring and strip geometry;
  - who ranks where at the end.
- React components only render those helpers' results and send intents.
- The Lobby becomes shared, with a slot for each game's options. Dominion's kingdom picker moves into that slot.
- Small engine additions:
  - a per-turn cap on trade proposals;
  - a "timed out" log line;
  - asset helpers typed to accept a view as well as the full state.

**Tech Stack:** React 19 + TypeScript + Vite, Vitest, CSS in `src/styles.css`, using the Feira tokens.

**Spec:** `docs/superpowers/specs/2026-10-24-noite-de-jogos-banco-imobiliario-design.md` (sections 5 and 6b; section 7, including "Board direction"; section 8 "Engine notes")

## Global Constraints

- **Computers** (width ≥ 900 px) get "Neighborhood map":
  - the 40-square ring drawn as the bairro seen from above;
  - shop-front squares with an awning in their rua's color;
  - a road around the ring;
  - the Pracinha in the middle, holding the dice, the last move and the buttons;
  - a side column with the players and your escrituras.
- **Phones** (< 900 px) get "Street in focus":
  - a mini-map with your token highlighted;
  - a strip of large squares around your token, scrolled horizontally with scroll-snap;
  - then the dice, the last move, the buttons and a compact players line.
- **Both layouts:**
  - the owner's color appears as a strip on the square;
  - puxadinhos are drawn as ⌂ and a prédio as ▮ on the awning;
  - mortgaged squares are striped and faded;
  - tokens use player colors;
  - tapping a square opens its escritura.
- All player-facing text comes from `src/games/bairro/i18n/{pt,en}.ts` (game content: squares, cards, log, reasons, terms) or `src/i18n/{pt,en}.ts` (shared UI chrome). The coverage tests must stay green.
- Use the Feira design tokens and existing shared components (Avatar, ConfirmDialog, Icon, Loader, TimerBar, LangToggle, Centered). Dark mode must work through the tokens. Honor `prefers-reduced-motion`.
- Dominion is unchanged except that the Lobby becomes shared.
- The engine stays pure. No UI code imports `Math.random`.
- Money is shown as `$1.240` in pt and `$1,240` in en.
- Commits end with a `Co-Authored-By: Claude …` line naming the model that wrote them. No pushes.

## Review Focus

1. **A phone 375 px wide:** no sideways page scroll. The strip scrolls on its own, the buttons stay at least 44 px tall, and the current square is centered in the strip after each move. Covered in Task 5 by the browser check.
2. **An intent sent while another is in flight:** buttons are disabled while `awaiting`, as in Dominion, so double taps can't buy twice or roll twice. Covered in Task 4 by the `actionsFor` tests plus the browser check.
3. **Off-turn prompts:** a trade offer for you, or a debt you owe on someone else's turn, must be impossible to miss. It opens as a dialog over either layout, on both phone and computer. Covered in Tasks 7 and 8.
4. **Going broke is irreversible:** "Faliu" needs a confirmation, and only shows when the engine would accept it (liquidation value < debt). Covered in Task 7.
5. **Reconnecting mid-game:** a refreshed guest rejoins and sees the same board, with the same open dialog for a pending debt or trade. Views carry everything, so no client-only state may be required. Covered in Task 11 by the browser check.

---

### Task 1: Shared Lobby with a game options slot; route Bairro screens

**Files:**
- Modify: `src/ui/screens/Lobby.tsx`, `src/ui/App.tsx`, `src/ui/gameScreens.ts`, `src/ui/gameScreens.test.ts`, `src/net/protocol.ts` (`GuestMessage.intent: unknown`)
- Create: `src/games/dominion/ui/DominionLobbyOptions.tsx` (moves the kingdom picker block out of Lobby), `src/games/bairro/ui/BairroScreens.tsx` (placeholder board: "Em construção" plus a Leave button)

**Interfaces:**
- `Lobby` props gain `options?: ReactNode`. The kingdom section is rendered by `<DominionLobbyOptions lobby host />`, which App passes for Dominion rooms.
- `screensFor(game): 'dominion' | 'bairro' | 'unsupported'`. It returns `'bairro'` for bairro.
- `GuestMessage.intent` is typed `unknown`. `parseGuestMessage` keeps validating only the envelope.
- **Rules button:** today the Lobby passes the Dominion kingdom to `RulesDialog`. It becomes an `onRules?: () => void` prop; App supplies the right dialog per game.

- [ ] **Step 1:** Update `gameScreens.test.ts`: `screensFor('bairro') === 'bairro'`. Run it and watch it fail.
- [ ] **Step 2: Implement.** Dominion's Lobby must look and behave exactly as before.
- [ ] **Step 3:** `npm test && npm run typecheck` → all pass.
- [ ] **Step 4: Dev-only access to unfinished games.** In dev builds only (`import.meta.env.DEV`), the front page shows a "Criar (dev)" button on unavailable game rows, so later tasks can host a Bairro room locally. Production builds are unchanged, and Task 11 needs no cleanup.
- [ ] **Step 5: Browser check:**
  - Dominion lobby: kingdom picker, randomize, timer and start all work as before.
  - A Bairro room created through "Criar (dev)": the lobby shows no options section, and the game opens the placeholder.
- [ ] **Step 6: Commit:** `refactor: shared Lobby with a game options slot; route Bairro screens`

### Task 2: Text, money and log helpers

**Files:**
- Create: `src/games/bairro/ui/text.ts`, `src/games/bairro/ui/text.test.ts`, `src/games/bairro/ui/useBairroText.ts`

**Interfaces:**
- `money(lang: Lang, n: number): string` gives `$1.240` (pt) and `$1,240` (en). Negative amounts get a leading minus: `-$50`.
- `bairroText(lang)` returns:
  ```ts
  { square(pos: number): string; rua(id: RuaId): string; card(id: string): string;
    reason(key: string): string; term(key: string): string;
    logLine(entry: BairroLogEntry, names: string[]): string }
  ```
- **`logLine`** fills `{player}`, `{creditor}`, `{to}` and `{from}` params that are seat indexes with names. It fills `{pos}`/`{square}` with square names, `{card}` with the card text, and `{amount}`/`{price}`/`{rent}` with money. Unknown keys fall back to the key itself.
  Before writing it, read the actual param names the engine logs (`grep "log(s" src/games/bairro/*.ts`) and cover every one.
- **`useBairroText()`** combines `useLang().tr.lang` with `bairroText`.

- [ ] **Step 1: Write failing tests:**
  - money formatting in both languages, including 0 and negatives;
  - for every log key in `BAIRRO_DICTIONARIES.pt.log`, a line built from a representative entry has no leftover `{…}` placeholder (build the entries from a table of key → params in the test);
  - a `luck` entry renders the card's text;
  - an unknown reason key falls back to the key.
- [ ] **Step 2: Watch them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Watch them pass.**
- [ ] **Step 5: Commit:** `feat(bairro-ui): text, money and log helpers`

### Task 3: Board geometry and the Square component

**Files:**
- Create: `src/games/bairro/ui/geometry.ts`, `geometry.test.ts`, `Square.tsx`, `squareInfo.ts`, `squareInfo.test.ts`
- Modify: `src/styles.css` (a `/* Dono do Bairro */` section)

**Interfaces:**
- **`ringCell(pos): { row: number; col: number }`** places squares on an 11×11 grid: 0 bottom-right, going counter-clockwise, so 10 is bottom-left, 20 top-left and 30 top-right.
- **`stripWindow(center: number, size: number): number[]`** returns the positions around `center`, wrapping around the board. Example: `stripWindow(1, 5)` gives `[39, 0, 1, 2, 3]`.
- **`squareInfo(view: BairroView, pos: number)`** returns:
  ```ts
  { kind; name; ruaColor: string | null; price: number | null;
    owner: number | null; houses: number; mortgaged: boolean; tokens: number[] /* seat indexes */ }
  ```
  `ruaColor` comes from a `RUA_COLORS` map in `geometry.ts`: r1 `#8c5a2b`, r2 `#6fb6d9`, r3 `#d65d9a`, r4 `#e8862a`, r5 `#c8372d`, r6 `#f2b632`, r7 `#2f7a35`, r8 `#2c4ba8`. These are the mockup's colors.
- **`<Square info size="ring" | "strip" onOpen />`** renders the awning, the name, an icon for special squares, the price when unowned, the owner strip, the houses, the mortgaged style and the tokens. It is a `button` with an aria-label of "name, owner, houses". Size `strip` is larger.

- [ ] **Step 1: Write failing tests:**
  - `ringCell` for 0, 5, 10, 15, 20, 25, 30 and 35;
  - every position maps to a unique cell on the edge;
  - `stripWindow` wraps both ways;
  - `squareInfo` for an owned ponto with a prédio, a mortgaged serviço, a luck square with two tokens, and a bankrupt player's token, which isn't shown.
- [ ] **Step 2: Watch them fail.**
- [ ] **Step 3: Implement** the helpers, `Square` and its CSS.
- [ ] **Step 4: Watch them pass.**
- [ ] **Step 5: Commit:** `feat(bairro-ui): board geometry and squares`

### Task 4: Actions, and the computer board (neighborhood map)

**Files:**
- Create: `src/games/bairro/ui/actions.ts`, `actions.test.ts`, `BairroBoard.tsx`, `MapBoard.tsx`, `Pracinha.tsx`, `PlayersPanel.tsx`
- Modify: `src/games/bairro/ui/BairroScreens.tsx`, `src/styles.css`, `src/games/bairro/assets.ts` (widen helper parameter types)

**Interfaces:**
- **`actionsFor(view: BairroView, awaiting: boolean)`** returns `Action[]`, where `Action = { id: 'roll' | 'buy' | 'decline' | 'endTurn' | 'payJailFine' | 'useLawyer' | 'payDebt' | 'goBankrupt' | 'trade'; intent: BairroIntent | null; enabled: boolean; label: UiKey-like key; amount?: number }`. These are the main buttons for this player now. Per `pending`:
  - **roll:** Roll. When jailed, also Pay fine ($50) and Use lawyer card (if held). Plus Trade.
  - **buy:** Buy $price (disabled without cash) and Leave it.
  - **manage:** Roll again if `rollAgain`, otherwise End turn. Plus Trade.
  - **debt:** Pay $amount (enabled when cash ≥ the oldest debt). Plus "Faliu" when `liquidationValue < total owed`.
  - **tradeAnswer and wait:** no main buttons.
  - Everything is disabled while `awaiting`.
- **assets.ts:** helpers like `canBuild`, `liquidationValue` and the rest take `Pick<BairroState, 'players' | 'owned' | 'phase' | 'current' | 'offer' | 'debts'>`, so a view works too. The engine doesn't change behavior.
- **`<BairroBoard view lobby code clock error onIntent onDismissError onEndGame awaiting />`:**
  - picks `MapBoard` (≥ 900 px) or `StreetBoard` (Task 5) with a `matchMedia` hook;
  - renders `TimerBar`, the header (room code, Rules, End game for the host), an error toast like Dominion's, and the dialogs (Tasks 6–8).
- **`MapBoard`:** the ring of `Square`s, the road and the `Pracinha` (dice, last log line, the `actionsFor` buttons). `PlayersPanel` shows everyone's money, number of pontos, jail and bankrupt status, plus your escrituras grouped by rua (opening the escritura dialog).

- [ ] **Step 1: Write failing tests** in `actions.test.ts`. Use `src/games/bairro/testkit.ts` to build states and `viewFor` to make views. Cover:
  - each pending kind;
  - the jail options;
  - buy disabled without cash;
  - Faliu shown only when the liquidation value is below the debt;
  - all buttons disabled while awaiting.
- [ ] **Step 2: Watch them fail.**
- [ ] **Step 3: Implement** the helpers and the components, then route `BairroScreens` to `BairroBoard` while a game is running.
- [ ] **Step 4:** `npm test && npm run typecheck`.
- [ ] **Step 5: Browser check** with two tabs at desktop width, hosting through Task 1's "Criar (dev)" button:
  - roll, buy, decline, end turn;
  - the board updates in both tabs;
  - buttons disable while awaiting.
  - Take a screenshot.
- [ ] **Step 6: Commit:** `feat(bairro-ui): neighborhood map board for computers`

### Task 5: Phone board (street in focus)

**Files:**
- Create: `src/games/bairro/ui/StreetBoard.tsx`, `MiniMap.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- **`StreetBoard`** gets the same props as `MapBoard`. From top to bottom:
  - `MiniMap`: 40 small cells on the 11×11 grid, colored by rua, with your token's cell outlined. Tapping a cell scrolls the strip there.
  - The strip: `stripWindow(yourPos, 40)`, rendered as all 40 squares in a scroll-snap row, scrolled so your square is centered after each move. It uses smooth scrolling, or instant under reduced motion.
  - `Pracinha`, in compact mode.
  - A one-line players summary that opens `PlayersPanel` as a sheet.

- [ ] **Step 1: Implement.**
- [ ] **Step 2:** `npm test && npm run typecheck`.
- [ ] **Step 3: Browser check** at 375×812 in both the light and dark color schemes:
  - `document.documentElement.scrollWidth <= 375`;
  - buttons ≥ 44 px tall (read `getBoundingClientRect`);
  - your square is centered after a roll;
  - tapping the mini-map scrolls the strip.
  - Take screenshots, then reset to desktop.
- [ ] **Step 4: Commit:** `feat(bairro-ui): street-in-focus board for phones`

### Task 6: Escritura dialog: building, selling and mortgages

**Files:**
- Create: `src/games/bairro/ui/EscrituraDialog.tsx`, `escritura.ts`, `escritura.test.ts`

**Interfaces:**
- **`escrituraFor(view, pos)`** returns:
  ```ts
  { name; rua; price; rentRows: { label: 'base'|'1'|'2'|'3'|'4'|'predio'; amount: number; current: boolean }[];
    houseCost; mortgage; unmortgageCost; owner; houses; mortgaged;
    buttons: { id: 'build'|'sell'|'mortgage'|'unmortgage'; enabled: boolean; reason: string | null; amount: number }[] }
  ```
  - Buttons appear only for the viewer's own assets.
  - `enabled` and `reason` come from the widened `assets.ts` helpers.
  - Serviços show their multiplier rule instead of rent rows.
- **The dialog** shows the escritura card and the buttons, and sends `build`, `sellBuilding`, `mortgage` or `unmortgage` with the square's position.

- [ ] **Step 1: Write failing tests:**
  - rent rows mark the current one, including a full rua with no buildings, where it shows the double base rent;
  - the buttons for an owned whole rua (build enabled), an uneven rua (build disabled with its reason), a mortgaged asset (unmortgage enabled), and someone else's asset (no buttons);
  - a debtor in the buy phase can sell and mortgage.
- [ ] **Step 2: Watch them fail.**
- [ ] **Step 3: Implement**, and wire the square and escritura taps in both boards.
- [ ] **Step 4: Watch them pass.** In the browser, check that the dialog opens from a square and from your escrituras, and that mortgage and pay-off work. Building on a full rua is checked in Task 8, once trades can complete a rua.
- [ ] **Step 5: Commit:** `feat(bairro-ui): escritura dialog with building and mortgages`

### Task 7: Debt and waiting prompts

**Files:**
- Create: `src/games/bairro/ui/DebtDialog.tsx`, `waiting.ts`, `waiting.test.ts`

**Interfaces:**
- **`waitingFor(view)`** returns a `{ key, params }` message for players with `pending === 'wait'`. The cases are: "{name} is playing", "{names} must pay their debts", "{name} is answering a trade" and "Game over".
- **`DebtDialog`** opens whenever `pending === 'debt'`, on either layout:
  - it shows the amount owed and to whom (the oldest debt first, then the total);
  - your cash;
  - a list of your assets with sell and mortgage buttons (reusing `escrituraFor`'s buttons);
  - Pay (from `actionsFor`);
  - "Faliu", behind a `ConfirmDialog`.
  - It can't be dismissed while you owe.

- [ ] **Step 1: Write failing tests** for `waitingFor` in each case, with names joined in the language's style.
- [ ] **Step 2: Watch them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Watch them pass.**
- [ ] **Step 5: Commit:** `feat(bairro-ui): debt dialog and waiting messages`

### Task 8: Trades, plus the engine's per-turn proposal cap

**Files:**
- Create: `src/games/bairro/ui/TradeDialog.tsx`, `TradeAnswerDialog.tsx`, `trade.ts`, `trade.test.ts`
- Modify: `src/games/bairro/trades.ts`, `types.ts`, `engine.ts` (reset on turn change), the dictionaries, `trades.test.ts`

**Interfaces:**
- **Engine:**
  - `BairroState.tradesThisTurn: number`, reset to 0 on every turn change (in `passTurn`) and set at setup.
  - `proposeTrade` is refused with the new reason `tooManyTrades` once 3 proposals were made this turn.
  - Add the reason to both dictionaries. Update the fuzz/sim invariants only if needed.
- **`tradeOptions(view, to)`** returns the assets each side may offer, with an `enabled`/`reason` per asset (no buildings in its rua), plus each side's cash and lawyer cards.
- **`TradeDialog`** (the proposer):
  - pick a player;
  - toggle "I give" and "I get" assets;
  - set cash amounts with a number input (0 to holdings), and lawyer cards;
  - Send → `proposeTrade`. Then a waiting state with Cancel → `cancelTrade`.
- **`TradeAnswerDialog`** (the recipient):
  - a clear summary of both sides with names and money;
  - Accept → `answerTrade {accept: true}`, Decline → `answerTrade {accept: false}`.
  - It shows the response clock from `TimerBar` if one is running.

- [ ] **Step 1: Write failing tests:**
  - engine: the 4th proposal in a turn is refused with `tooManyTrades`, and the count resets next turn;
  - `tradeOptions` excludes assets in a rua with buildings, with a reason, and caps cash at holdings.
- [ ] **Step 2: Watch them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Watch them pass.** Then run `npx vitest run src/games/bairro` (including the sim and fuzz).
- [ ] **Step 5: Browser check** with two tabs: propose, the other tab sees the answer dialog, accept moves the assets; then propose, decline; then propose, cancel.
- [ ] **Step 6: Commit:** `feat(bairro): trades UI and a per-turn proposal cap`

### Task 9: Log, dice and token motion, and a "timed out" log line

**Files:**
- Create: `src/games/bairro/ui/BairroLog.tsx`, `motion.ts`, `motion.test.ts`
- Modify: `src/games/bairro/timeout.ts` and the dictionaries (log key `timedOut` with `{player}`, written once per player per expiry), `Pracinha.tsx`, both boards

**Interfaces:**
- **`BairroLog`** shows the last 50 entries through `logLine`. It's a panel on computers and a tab or sheet on phones.
- **`movesBetween(prev: BairroView, next: BairroView)`** returns `{ player: number; from: number; to: number; steps: number[] }[]`, the token moves to animate:
  - a normal move walks square by square, about 120 ms per step;
  - a jump (go to Xilindró, advance to start) moves directly.
- **Motion:** a dice roll animation (a short shake, then the faces), and tokens animating along `steps`. Both are skipped under reduced motion and while the tab is hidden, as in Dominion's motion rules.

- [ ] **Step 1: Write failing tests:**
  - `movesBetween` for a normal move, a wrap past 0, go-to-jail (a jump), and no move;
  - the timeout writes `timedOut` for the timed-out player (in `timeout.test.ts`).
- [ ] **Step 2: Watch them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Watch them pass.**
- [ ] **Step 5: Commit:** `feat(bairro-ui): log, dice and token motion, timeout log line`

### Task 10: Rules dialog and end screen

**Files:**
- Create: `src/games/bairro/ui/BairroRules.tsx`, `BairroEnd.tsx`, `ranking.ts`, `ranking.test.ts`
- Modify: `src/i18n/{pt,en}.ts` or the bairro dictionaries (the rules text lives in the bairro dictionaries under a new `rules` section, and the coverage test is extended)

**Interfaces:**
- **`BairroRules`** covers, in PT and EN:
  - the goal and a turn (roll, land, buy or leave, build, trade, end);
  - the squares (Ponto de Ônibus +$200, Deu Bom/Deu Ruim, IPTU, Bolão, Xilindró, Pracinha, serviços × dice);
  - building evenly;
  - mortgages (+20% to pay off);
  - debts and Faliu;
  - trades (on your own turn, up to 3 offers);
  - a note that the board's values are provisional working values (spec section 8).
  It opens from the Lobby (via the `onRules` prop) and from the board header.
- **`ranking(view)`** returns the seats in finishing order: the winner first, then the bankrupt players in reverse order of going broke. Track that order through the `bankruptOrder: number[]` state field added in this task, appended to when a player goes broke. It's reset at setup, which needs a small engine change with a test.
- **`BairroEnd`** shows the ranking with avatars, "Dono do Bairro" for the winner, and the Play again, Back to lobby and Leave buttons, same as Dominion's end screen.

- [ ] **Step 1: Write failing tests:**
  - `ranking` with 4 players going broke in a known order;
  - the engine appends to `bankruptOrder`;
  - coverage: every `rules` key exists in both languages.
- [ ] **Step 2: Watch them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Watch them pass.**
- [ ] **Step 5: Commit:** `feat(bairro-ui): rules dialog and end screen`

### Task 11: Turn it on

**Files:**
- Modify: `src/games/catalog.ts` (`bairro.available = true`), `src/games/catalog.test.ts`, `docs/CHANGELOG.md`, `docs/ROADMAP.md`

- [ ] **Step 1:** Update the catalog test so Dono do Bairro is available, then implement.
- [ ] **Step 2:** `npm test && npm run typecheck && npm run build`.
- [ ] **Step 3: Full browser check.** Three tabs at mixed sizes: two at desktop width, one at 375 px. Play at least 10 turns, covering:
  - buy, rent, a Deu Bom/Deu Ruim card, the Xilindró;
  - a trade that completes a rua, then building;
  - a mortgage;
  - with the turn timer on, a timeout;
  - refreshing a guest mid-turn, who rejoins with the same state and dialog;
  - one player going broke. Force this by trading most of their cash away, then landing on rent.
  - The end screen.
  - The console has no errors.
  - Take screenshots of each layout.
- [ ] **Step 4: Docs:**
  - Changelog entry "Dono do Bairro": a player-facing summary, noting the provisional values;
  - Roadmap: tick board mockups and screens, and leave Partida rápida and Playtest open.
- [ ] **Step 5: Commit:** `feat: Dono do Bairro is playable`
