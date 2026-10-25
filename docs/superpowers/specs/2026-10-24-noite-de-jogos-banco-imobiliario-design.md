# Noite de Jogos + Banco Imobiliário — Design Spec

**Date:** 2026-10-24
**Status:** Draft for review

## 1. Summary

Dominion Friends becomes **Noite de Jogos** ("game night"), a site for one group of friends that holds more than one game. The first screen becomes a front page where you choose a game or join a room. The second game is **Dono do Bairro**: the classic rules of **Banco Imobiliário**, the Brazilian Monopoly, with its own neighborhood theme (6b). A lobby option turns on a short game.

The two projects are built in this order:

1. **Noite de Jogos (platform):** rename the site, add the front page, and split the reusable parts out of the Dominion code. Dominion keeps working the whole time.
2. **Banco Imobiliário:** a new rules engine and UI built on those shared parts.

## 2. Why

The group plays on a call, each person on their own device. Dominion Friends already handles the hard parts of that: rooms, join links, host-in-browser PeerJS, rejoining, the turn timer, player colors, PT/EN and the Feira look. Adding games should reuse all of that rather than start a new site. Banco Imobiliário was chosen because everyone in the group already knows it. The short-game option exists because a full game (2–3 hours) is too long for a call.

## 3. Goals, non-goals, anti-goals

**Goals**
- A front page that lists the games and lets you join by code without an extra click.
- The site is renamed to Noite de Jogos, with a new address, and the old address still works.
- Banco Imobiliário for 2–6 players with the classic rules enforced by the engine. It includes trading, building, mortgages, jail and bankruptcy.
- A short-game option in the lobby.
- Same quality bar as Dominion: rejoin after a refresh, the turn timer, PT/EN with the coverage test, phone layout, dark mode and engine tests.

**Non-goals (for now)**
- Bots in Banco Imobiliário.
- Auctions. Classic rules have none.
- The current app edition's rules (millions in money, a banking app, an auction mode).
- Save/resume and host migration (same as Dominion).
- A third game.

**Anti-goals (a failure even if it works)**
- Dominion breaks or gets worse during the split. Its tests must stay green after every step.
- The rules feel "Monopoly, not Banco Imobiliário": for example, auctions, two card decks, or railroads instead of companhias.
- Trading turns into a free-for-all where other players get interrupted with offers on someone else's turn.
- A friend who opens an old link or bookmark lands on a 404.

## 4. Noite de Jogos (platform)

### 4.1 Name and address
- The site name is **Noite de Jogos** in both languages. Only the subtitle is translated.
- Rename the GitHub repo `trakinos/dominion-friends` to `trakinos/noite-de-jogos`. The new address is `https://trakinos.github.io/noite-de-jogos/`.
- GitHub redirects git and repo URLs after a rename, but **not GitHub Pages**. Keep the old address alive by creating a new tiny repo named `dominion-friends`. It contains only a static `index.html` that redirects to the new address and **keeps the `#join=CODE` hash**, so old invite links still land in the right room.
- *(My call:)* the plan does the rename and creates the redirect repo itself, with `gh`, at the moment it's needed, after asking the user right then. Order: build and test the redirect page first, rename, create the `dominion-friends` repo with Pages on right away, then check that an old `#join=` link works. The gap is a few minutes, while no game is running.
- Update the local git remote, the Pages workflow if it names the repo, page `<title>`, README/docs and the project memory.

### 4.2 Front page (option C, with a join row)
Mockup: `.superpowers/brainstorm/*/content/front-page-v2.html` (not committed).

From top to bottom, phone-first:
- Site name and the PT/EN switch.
- "Seu nome: **Ana** · trocar". Players type their name once, and every game uses it. It's saved per device, as it is today. The first visit with no saved name shows the name input inline.
- **Join row:** one row, styled like a game row, with a code input and an **Entrar** button. You never pick a game to join, because the room tells the client which game it is (see 4.3).
- A label "Criar uma sala", then **one row per game**: art strip, name, a short tag, player count, length, and a **Criar** button that hosts a room for that game and goes to its lobby.
  - Dominion Friends: "Construção de baralho · 2–4 · 30–45 min"
  - Dono do Bairro (Banco Imobiliário rules, see 6b): "Compra e venda no bairro · 2–6 · 45 min–2 h"
- Errors (room not found, room full, game in progress) show on this page, as Home does today.
- This page replaces the current Dominion Home screen.

**Invite links** (`#join=CODE`) skip the front page and go straight into the room's lobby, with the name prompt if no name is saved.

### 4.3 Which game is a room?
Today the PeerJS id is `dmf-${code}` and the code alone identifies the room. After the split, a guest must learn the game from the room. **Builder's call** on the mechanism. Two acceptable options:
- The host's first lobby message includes `game: 'dominion' | 'banco'`, and the client then mounts that game's lobby and board. The code format stays the same.
- The game is encoded in the peer id prefix, and the guest tries both.

The first option is preferred. The game id for the new game is `bairro`. Old `dmf-` codes don't need to keep working across the deploy, because rooms only live while the host's tab is open.

### 4.4 Shared parts vs per-game parts
Split by moving code. Avoid rewriting it. Shared, under a platform folder:
- room codes and join links, transport, PeerJS peer, heartbeat, memory transport for tests;
- a **generic host**: lobby (seats, colors, ready, kick/refuse, rejoin), turn clock, sending per-player views, applying intents. It is parameterized by a game module;
- player colors, i18n plumbing (LangProvider, toggle, coverage test), design tokens and shared components (Avatar, ColorPicker, ConfirmDialog, Loader, Icon, TimerBar, Centered);
- the front page and the app shell.

Per game: the rules engine, intents, the view function, the random-answer function for timeouts, lobby options, board UI, end screen, rules dialog and dictionaries.

A game module exposes roughly: `id`, display info for the front page, min/max players, default and validated lobby options, `create(players, options, rng)`, `apply(state, playerId, intent)`, `viewFor(state, playerId)`, `timeoutMove(state, playerId)`, and the React screens. The exact interface is the builder's call. It must fit Dominion's existing engine without changing Dominion's rules code.

## 5. Banco Imobiliário — rules

The classic Estrela edition, enforced by the engine. Money is shown as **$** with classic-size amounts (hundreds, not millions).

### 5.1 Board
40 squares, played counter-clockwise from Ponto de Partida:
- **22 properties** in 8 color groups (two groups of 2, six groups of 3).
- **6 companhias.** No houses. Rent = dice total × the multiplier printed on the card.
- **Sorte ou Revés** squares, which draw from one shared deck.
- **Lucros ou Dividendos:** receive money from the bank.
- **Imposto de Renda:** pay money to the bank.
- **Ponto de Partida, Prisão** (just visiting when you land), **Parada Livre** (nothing happens), **Vá para a Prisão.**

**Board data is a single data file** (name, position, group, price, rent table, house cost, mortgage value, company multiplier). Below is a draft layout reconstructed from memory of the classic board. **It must be checked against a physical copy or a trustworthy scan before it ships** (see 8). The rent tables, house costs and company multipliers are not listed here and come from the same check.

| # | Square | # | Square |
|---|---|---|---|
| 0 | Ponto de Partida | 20 | Parada Livre |
| 1 | Leblon | 21 | Flamengo |
| 2 | Sorte ou Revés | 22 | Sorte ou Revés |
| 3 | Av. Presidente Vargas | 23 | Botafogo |
| 4 | Av. Nossa Sra. de Copacabana | 24 | Imposto de Renda |
| 5 | Companhia Ferroviária | 25 | Companhia de Navegação |
| 6 | Av. Brigadeiro Faria Lima | 26 | Av. Brasil |
| 7 | Companhia de Viação | 27 | Sorte ou Revés |
| 8 | Av. Rebouças | 28 | Av. Paulista |
| 9 | Av. 9 de Julho | 29 | Jardim Europa |
| 10 | Prisão | 30 | Vá para a Prisão |
| 11 | Av. Europa | 31 | Copacabana |
| 12 | Sorte ou Revés | 32 | Companhia de Aviação |
| 13 | Rua Augusta | 33 | Av. Vieira Souto |
| 14 | Av. Pacaembu | 34 | Av. Atlântica |
| 15 | Companhia de Táxi | 35 | Companhia de Táxi Aéreo |
| 16 | Sorte ou Revés | 36 | Ipanema |
| 17 | Interlagos | 37 | Sorte ou Revés |
| 18 | Lucros ou Dividendos | 38 | Jardim Paulistano |
| 19 | Morumbi | 39 | Brooklin |

### 5.2 Setup
- 2–6 players. Each player gets the classic starting money (to be confirmed in the check; working value **$3,000**). The bank has unlimited money.
- Turn order is random (the engine's seeded RNG). The physical "highest roll goes first" step is skipped.
- The bank is automatic. No player acts as banker.

### 5.3 A turn
1. **Roll** two dice and move.
   - Passing or landing on Ponto de Partida pays **$200**. The engine pays it automatically, so the "must claim it" rule doesn't apply.
   - **Doubles:** after resolving the square and doing optional actions, roll again. **Three doubles in a row** sends you straight to Prisão.
2. **Resolve the square:**
   - Unowned property or companhia: **buy at the printed price, or leave it.** No auction.
   - Owned by another player and not mortgaged: pay rent. A property's rent doubles if its owner holds the whole color group and it has no buildings (classic rule; confirm in the check). Rent with houses or a hotel comes from the card's table. Companhia rent = dice total × multiplier. If the owner holds all 6 companhias, the rent doubles.
   - Sorte ou Revés: draw, apply, put the card on the bottom. Habeas Corpus is kept until used and goes back to the bottom afterwards.
   - Lucros ou Dividendos / Imposto de Renda: receive or pay the printed amount.
   - Vá para a Prisão: go to Prisão without passing Ponto de Partida.
3. **Optional actions, on your own turn only, in any order:** build, sell buildings, mortgage, pay off a mortgage, propose trades.
4. **End turn.**

### 5.4 Building
- Only on your own turn, and only when you own the whole color group with no property in it mortgaged.
- **Even building:** no property in the group may have 2 houses more than another. The same applies when selling.
- Up to 4 houses, then a hotel (replacing the 4 houses), unless the short-game rule "hotel after 3 houses" is on.
- Houses and hotels sell back to the bank at **half** their cost.
- **Builder's call:** no house/hotel shortage. The bank's supply is unlimited, which keeps the UI simpler.

### 5.5 Mortgage
- Only properties with no buildings in their whole group, and companhias.
- The bank pays the mortgage value printed on the card. No rent is charged while it's mortgaged.
- Paying it off costs the mortgage value **+ 20%**, on your own turn.
- Mortgaged properties can be traded. The receiver takes over the mortgage.

### 5.6 Prisão
- Ways in: Vá para a Prisão, three doubles, or a Sorte ou Revés card.
- On each turn in jail, before rolling, the player can **pay the $50 fine** or **use Habeas Corpus** and then roll normally. Otherwise they roll: **doubles** gets them out and they move by that roll, but don't roll again.
- After the **third** failed roll, they pay the fine and move by that roll.
- Rent can still be collected while in jail.

### 5.7 Trading (on your own turn only)
- Only the player whose turn it is can **propose** a trade. They can propose to any other player, as many times as they like during their turn.
- An offer can contain properties/companhias **without buildings in their group**, money and Habeas Corpus cards, in either direction.
- The other player **accepts or declines**. Declining has no cost. Counter-offers are not part of v1; the receiver declines, and the proposer can try again.
- Players are never interrupted with offers outside the proposer's turn.
- **Builder's call:** the turn timer pauses while an offer is waiting for an answer, and the answer has its own short clock (like Dominion's 30 s attack response). On timeout, the offer is declined.

### 5.8 Owing money and bankruptcy
- When a player owes more than they hold, they must raise it by selling buildings and mortgaging (and, on their own turn, trading) before paying. The UI shows how much is still owed. Loans are not allowed.
- *(My call:)* a debt can happen on someone else's turn (rent paid to the active player, "pay every player" cards). In that case the debtor may sell and mortgage **off-turn**, but only to settle that debt. Several debtors can do this at the same time, the same way Dominion's simultaneous attack responses work. The turn waits until every debt is settled or ends in bankruptcy. The response clock and the timeout rule from 5.10 apply.
- If they cannot raise it, they are **bankrupt**:
  - Owed to a player: that player gets their money, properties (mortgages stay as they are) and Habeas Corpus cards. Buildings are sold to the bank first, and the proceeds go to the creditor.
  - Owed to the bank: their properties go back to the bank as unowned and unmortgaged.
- A bankrupt player leaves the turn order and watches.
- **Win:** the last player who isn't bankrupt wins (the "Grande Milionário").

### 5.9 Sorte ou Revés deck
One shared deck of about 30 cards, using the classic edition's cards (confirmed in the check). A typical mix:
- 1–2 **Habeas Corpus** (kept, can be traded);
- 1–2 "go to Prisão";
- "advance to Ponto de Partida" (collect $200);
- receive from the bank, in several amounts;
- pay the bank, in several amounts;
- receive from every player / pay every player.

Card text lives in both dictionaries. The deck is data (id, kind, amount), the same way Dominion's cards are data.

### 5.10 Timer and disconnects
Same host setting and behavior as Dominion. On timeout, the engine makes the cautious move: roll if a roll is needed, **don't buy**, don't build or trade, pay owed money by selling buildings and mortgaging in a fixed order (or go bankrupt if that isn't enough), and decline pending offers. Dominion's "never plays cards" rule maps to "never spends money by choice".

## 6. Short game ("Partida rápida")

Lobby options for the host. The defaults are **all off**, which gives the classic game. One switch turns on the recommended bundle, and each rule can still be changed on its own:
- **Time limit:** 30 / 45 / 60 / 90 min (default 60). *(My call: it's wall-clock time measured by the host from the first roll, and it doesn't pause. It lives in the host's clock next to `turnClock`, and the engine gets an "end after this round" intent when it runs out.)*
  - When time runs out, **the current round is finished** so everyone has had the same number of turns. Then the game ends. *(My call.)*
  - **Winner:** the richest player, counting money + property and companhia values (the mortgage value for mortgaged ones) + buildings at the price the bank pays for them. A tie is settled by a die roll, which the engine does and shows.
  - The remaining time is always visible on the board.
- **Hotel after 3 houses.**
- **Deal out properties at the start:** shuffle the property and companhia titles and deal them evenly. Each player pays the bank the printed price of what they received. *(My call, so nobody starts broke: stop dealing a player titles once their total would pass half the starting money. Leftovers stay with the bank.)*
- **Early jail exit:** a player can only pay the fine on their first jail turn. *(The rulebook wording is unclear. The working reading: after the first round in jail, they must pay to leave. Confirm in the check.)*

## 6b. Theme: "Dono do Bairro"

The game ships as **Dono do Bairro**, Banco Imobiliário's rules dressed as a made-up Brazilian neighborhood. Like Feira did for Dominion, the theme changes only names, text and look. It never changes rules or numbers. It also keeps the trademarked name "Banco Imobiliário" off the public site (the rules dialog can say "regras do Banco Imobiliário clássico").

As with Dominion, every name lives in a theme file with a stable internal id (`propertyId → name`) in both dictionaries, so names can change without touching the engine. Rules text and this spec keep using the classic terms.

| Classic | Dono do Bairro |
|---|---|
| Banco Imobiliário | Dono do Bairro |
| Propriedade / título de posse | Ponto (spot) / escritura |
| Grupo de cor | Rua (street) |
| Casa | Puxadinho |
| Hotel | Prédio |
| Companhias | Serviços: Kombi, Mototáxi, Carro do Ovo, Caminhão do Gás, Sorveteiro, Van Escolar |
| Sorte ou Revés | Deu Bom / Deu Ruim (one deck; each card is labeled as one or the other) |
| Habeas Corpus | Carta do Advogado |
| Ponto de Partida | Ponto de Ônibus |
| Prisão / Vá para a Prisão | Xilindró / Vá pro Xilindró |
| Parada Livre | Pracinha |
| Lucros ou Dividendos | Bolão |
| Imposto de Renda | IPTU |
| Banco (the bank) | Prefeitura |
| Falência | Faliu |
| Grande Milionário | Dono do Bairro |

**Draft streets and spots** (cheapest to most expensive; the builder maps them onto the 8 classic color groups in price order, and the user may rename them):

| Rua | Pontos |
|---|---|
| Beco do Samba (2) | Borracharia, Lava-Jato |
| Rua do Campinho | Lan House, Bicicletaria, Chaveiro |
| Travessa da Feira | Quitanda, Açougue, Peixaria |
| Rua das Flores | Salão da Cida, Barbearia, Ateliê de Costura |
| Rua da Igreja | Papelaria, Loja de 1,99, Farmácia |
| Rua do Comércio | Pastelaria, Sorveteria, Padaria |
| Praça Central | Boteco, Pizzaria, Churrascaria |
| Alameda das Mansões (2) | Academia, Supermercado |

Deu Bom / Deu Ruim card text is written in the neighborhood's voice (for example "Ganhou o bingo da quermesse", "Multa do rapa", "Vizinho pagou a vaquinha"). Each card maps to one of the classic effects in 5.9.

**Look:** the shared Feira tokens and components, with the board styled as a neighborhood map seen from above (streets around a central pracinha). The streets' colors are the 8 group colors. The board mockups come first (see 7).

On the front page, the row reads **Dono do Bairro**: "Compra e venda no bairro · 2–6 · 45 min–2 h".

## 7. Banco Imobiliário — screens

Same Feira look and tokens. Phone-first.
- **Lobby:** the shared lobby plus the short-game options and a rules button.
- **Board:** the 40-square board as a ring, with player tokens in player colors, owner color marks on owned squares, houses/hotels and mortgaged marks. On a phone, the board scales down to fit the screen. Tapping a square opens its title card.
- **Your panel:** money, properties grouped by color, Habeas Corpus. Actions available this turn: Roll / Buy / Leave / Build / Sell / Mortgage / Pay off / Propose trade / End turn.
- **Others:** each opponent's money and property count. Tap one to see their titles.
- **Trade dialog:** pick the player, then build "I give" / "I get" lists. The receiver sees a clear accept/decline dialog.
- **Dice and token movement** are animated, using the existing motion settings and reduced motion support.
- **Log**, the same as Dominion's.
- **End screen:** the ranking, with net worth in a short game.
- **Rules dialog** in PT/EN.

The visual design of the board is the builder's call. Make mockups first and show them before building.

## 8. Things to confirm later

The user's decision (2026-10-24): **build and ship on the working values now.** The user checks the board on screen and supplies corrections afterwards, and only the data file changes. The working values should be close to the classic edition (prices and rents in classic proportions). The rules dialog and the changelog should mention that the values are provisional. Later, check these against a physical classic copy or a trustworthy scan: the square names and order, prices, rent tables, house costs, mortgage values, company multipliers, starting money, the Lucros ou Dividendos and Imposto de Renda amounts, the jail fine, the Sorte ou Revés card list, and whether the full-group double rent exists in this edition. Until then, use the working values above.

### Engine notes (2026-10-24)

Working values chosen in the engine (all in the one data file):
- Classic board geometry: start, 2 cheap pontos, IPTU at 4, serviços at 5/12/15/25/28/35, Deu Bom/Deu Ruim at 2/7/17/22/33/36, Xilindró 10, Pracinha 20, Vá pro Xilindró 30, Bolão at 38.
- Prices and rent tables in Monopoly proportions. Start with $1,500, $200 for passing start, $50 fine.
- Serviço rent is the dice times 5 (price 150) or times 8 (price 200). IPTU and Bolão are $200. The deck has 30 cards.

Engine rulings worth knowing:
- Mortgaged assets still count for a full rua and for all 6 serviços.
- While debts are open, only debtors can act.
- If several creditors are owed in a bankruptcy, the assets go to the oldest player-creditor and the other debts are dropped.
- Debts owed to a player who goes bankrupt are dropped.
- A trade acceptance that has become void is logged, not treated as an error.

Simulation finding: with bots that never trade, only 87 of 200 games finished, because split ruas stall the game. With one simple rua-completing trade, 200 of 200 finished. So trading and the Partida rápida time limit matter for real games.

## 9. Constraints
- React + TypeScript + Vite, static GitHub Pages deploy, PeerJS host-in-browser. No game server.
- Engines are pure and deterministic with a seeded RNG, and tested the same way Dominion is (unit tests, simulated games, fuzzed intents).
- Message size: keep views under the existing binary/size limits. The view log is capped.
- Every player-facing string goes in both `pt` and `en`. The coverage test must pass.
- Ask the user before every push to `main`, because a push redeploys.

## 10. Left to the builder
- The game-module interface and folder layout of the split.
- How a guest learns the room's game (4.3, first option preferred).
- The board's visual design (mockups first).
- Which shared components move, and when.
- The order of work inside each project, as long as Dominion stays green.
