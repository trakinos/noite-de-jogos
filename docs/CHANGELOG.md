# Changelog — Noite de Jogos

What changed for players, newest first. Every push to `main` deploys to https://trakinos.github.io/noite-de-jogos/.

## Unreleased — Dono do Bairro, after the second playtest

### Added
- **Pick your piece.** Under your name on the front page there are ten neighborhood pieces to play as: vira-lata 🐕, chinelo 🩴, bola ⚽, moto 🛵, coco 🥥, papagaio 🦜, cafezinho ☕, violão 🎸, pipa 🪁 and abacaxi 🍍. A first visit gets one at random, and your pick is remembered. You can change it in the lobby too, next to your color; two players may pick the same piece, since their colors tell them apart. In Dono do Bairro your token on the board is now your piece on a disc of your color (also in the players list, on the phone's money line, and when the cop carries you off); the lobby shows it as your avatar in both games.
- **The Prefeitura's auction.** A player who goes bankrupt owing the Prefeitura no longer just hands the escrituras back: the Prefeitura auctions them, one at a time in board order, free of buildings and mortgages. Everyone still in the game makes one sealed bid per escritura (or passes) in the auction window, which shows who has bid but never how much. The highest bid wins and pays the bank; a tie goes to whoever comes first in turn order; with no bids it stays with the Prefeitura. Nothing else happens until the auction ends, and with a turn timer, whoever runs out of time passes. Going bankrupt to a player works as before: the creditor takes everything.
- **Esquema theme (lobby setting).** Before the game starts the host can pick the theme: Bairro, as always, or **Esquema**, where the escrituras are the neighborhood's illegal businesses (from the Camelódromo to the Patrimônio Ilegal's Mansão com Dinheiro Vivo and Ilha do Jogador de Futebol), the milícia runs the serviços, the Tigrinho cards are about the politicians who protect it all, and the corners are the Mensalinho, the Pagamento do Fiscal, the Jogo do Bicho, the Baile and the Batida Policial. Buildings become laranjas and then the esquema; the winner is the Dono do Esquema. Only names, icons and wording change: rules and values are the same.
- **Watch the walk on phones.** The street strip now follows the token of whoever's turn it is, not just yours, so everyone sees the move.
- **See the board during a trade.** Every trade window (making an offer, waiting, answering, watching an open trade) has a "Ver o tabuleiro" button that tucks it away; a "Troca em andamento · Mostrar" pill brings it back with everything as you left it. A new offer opens it again.
- **Esquema names.** The top building is now an assessor (up to 4 laranjas, then an assessor), and the Rinha de Galo is now the Jogo da Galera.
- **No more cigarette.** The Pracinha's cigarette is hidden for now; it was always on screen.
- **Less luck: three table rules (lobby settings, on by default).** The host can turn each off before the game starts.
  - **Leilão das recusadas.** An escritura someone lands on and doesn't buy goes straight to a sealed-bid auction for everyone, the one who declined included; with no bids it stays for sale.
  - **Habilidades.** Each player gets a different skill at random, shown to everyone in the players list (and yours under the dice): **Dono da Casa** (stopping on your own escritura pays you half its rent), **Rei da Pracinha** (passing or stopping at the Pracinha pays $100), **Empreiteiro** (buildings 25% cheaper), **Corretor** (escrituras 10% cheaper), **Malandro** (once per lap, roll again after moving) and **Bicheiro** (whenever anyone stops at the Pé de Meia, the IPTU or the Bolão, you get $100).
  - **Cartas na manga.** The Tigrinho gets 12 cards to keep, up to 3 in hand (a fourth goes back under the deck): **Dado Viciado** (pick one die's value), **Marcha à Ré** (back up to 3 squares instead of rolling), **Carona** (go to any square on your side of the board instead of rolling), **Calote** (landing on a rent, choose to pay or skip it), **Fiscal na Porta** (someone can't buy, bid or build until the end of their next turn) and **Seguro** (blocks the next Fiscal na Porta on its own). Your cards sit under the dice; tap one to read it, pick its choice and play it. In the Esquema theme they are the Resultado Combinado, Recurso Protelatório, Carro Oficial, Anistia, Denúncia Anônima and Foro Privilegiado.

### Changed
- **The board waits for the dice.** The log line, everyone's money, the owners and every dialog (buying, debts, trades) now update only once the dice have landed, the token has walked and any Tigrinho card has been read. So "pagou $X a Y" no longer shows before the roll, and a debt's mortgage window opens after the card that caused it. Your buttons come back at the same moment, so a turn can't be ended mid-walk.
- **Longer Tigrinho cards.** The card now stays face up for about 3 seconds, up from about 1.
- **Paying a debt: pick, then confirm.** The debt window now has a checkbox for each building to sell and each escritura to mortgage. A tally shows what the picks raise and whether that covers the debt; "Confirmar" then sells and mortgages them all (buildings first). A stray tap no longer mortgages anything by itself.
- **Cards in hand.** A Carta do Advogado now shows as a 📜 tag next to its holder in the players list ("📜 2" for two), on your money line on phones, and in a "Cartas na mão" box under the escrituras of whoever you're looking at, with what it does.
- **Mortgage stamps.** Mortgaging an escritura slams a red "HIPOTECADA" stamp onto it, with the cash floating up in green; paying it off lands a green "QUITADA" stamp that lifts away, with the payment in red. Everyone sees it, one stamp after another when several land at once.
- **Someone's been in the Pracinha.** A park bench on the Pracinha's lawn has a cigarette left burning on it: the ember glows and smoke curls up. On phones the cigarette sits in the corner of the Pracinha panel. It stays still under reduced motion.

## Unreleased — Dono do Bairro, after the first playtest

### Added
- **Open trades (lobby setting).** The host can turn on "Trocas abertas" before the game starts. Then everyone not in a trade sees the offer on the table, with each side's escrituras, prices and totals, until it is answered. With it off (the default), only the two players see the terms; everyone else learns only who is trading with whom, and the terms are no longer sent to their devices at all.

### Changed
- **New names.** The card deck is now **Tigrinho**, the start square is **Pé de Meia**, the jail is the **Papuda**, and the Sorveteiro service (right next to the Sorveteria) is now the **Carro da Pamonha**.
- **Easier to follow the turn.** The token of the player whose turn it is is bigger and pulses gently, on the map and on the phone strip.
- **Slower walk.** Tokens walk around the board a little slower, so everyone can see where they land.
- **Real dice.** The dice show pips instead of numbers. They tumble and hop while rolling, then bounce as they land.
- **Tigrinho cards for everyone.** Drawing a card lifts it off the Tigrinho square to the middle of every screen, where it flips over: green "Deu bom!" or red "Deu ruim!", who drew it and what it says. A card that sends you to the Pé de Meia or the Papuda shows first, then the token moves.
- **Arrests.** Landing on "Vá pra Papuda", drawing a Tigrinho card that sends you there, or rolling three doubles calls the cop: a 👮 with a siren grabs the token where it stands, carries it across the board to the Papuda, and the bars drop.
- **Your own arrest hits home.** When it's you, bars slam down over your whole screen with "Você foi pra Papuda!" and how to get out.
- **Getting out of the Papuda.** The bars lift off the square and the token hops out, with 💸 and the fine, 📜 for the Carta do Advogado, or 🎲 for doubles.
- **Doubles feel like doubles.** The dice glow and cheer and a "Dobrada!" burst pops over them for everyone: "Jogue de novo", "Saiu da Papuda", or in red, "Três dobradas! Direto pra Papuda".
- **Trades show what they're worth.** Each escritura in a proposal shows its price (a mortgaged one also shows what lifting the mortgage costs), each side shows its total, and a line says who comes out ahead on paper, for both the one proposing and the one answering.
- **Counter-offers.** Whoever gets a trade offer can now answer with a counter-offer instead of just accepting or declining. It opens with the terms on the table, ready to change, and goes back to the other player, who can accept, decline or counter again, up to 3 counter-offers per trade. Counter-offers don't use up the turn's 3 proposals, and whoever sent one can still withdraw it.
- **New tiles.** On the map, every rua's color band now faces the Pracinha, on whichever side of the board it sits. An owned tile is tinted in its owner's color with a thin ring of it, on the map and on the phone strip, and it shows the rent landing there costs right now (doubled for a whole rua, more with puxadinhos, "8×🎲" for a serviço). A mortgaged tile shows no rent.
- **See anyone's escrituras.** Tap a player in the players list (or in the phone's players sheet) and the list below shows their escrituras by rua, under "Escrituras de Ana". Tapping one opens its card. Your own come back when you tap yourself.
- **Money from the board.** Passing the Pé de Meia or landing on the Bolão pops a green "+$200" off the square with coins bursting out; the IPTU pops a red "-$200" with coins falling in. It plays for everyone, as the token gets there.
- **Dice numbers.** Once the dice land, the numbers show below them ("4 + 2 = 6").
- **Who's locked up.** At the Papuda, players serving time sit behind bars in a little cell on the tile; anyone just visiting stands apart, as before.
- **Walks aren't cut short.** Ending the turn (or any move that doesn't move a token) while a token is still walking used to make it jump to the end and skip what was on the way; now the walk and its scenes finish.
- **Rules fix.** The rules said the Bolão charges $200; it pays you $200, as the game always did.
- **Clearer failed join.** When the room exists but no direct connection can be made (seen in Firefox on a Mac), the front page now says so in the player's language, "Não deu para abrir uma conexão direta com a sala…", instead of PeerJS's English "Negotiation of connection … failed".

## Dono do Bairro

### Added
- **Dono do Bairro is playable.** Pick "Criar" next to Dono do Bairro on the front page and send the code. It takes 2 to 6 players, each on their own device, in Portuguese or English.
- **Classic rules.** Roll and walk the neighborhood, buy escrituras (no auctions), collect rent, draw Tigrinho cards, and get sent to the Papuda. Build puxadinhos and a prédio once you hold a whole rua, mortgage when cash runs short, and trade escrituras, money and the Carta do Advogado on your turn. Whoever can't pay goes bust ("Faliu"), and the last one left is the Dono do Bairro.
- **Two boards.** On a computer you see the whole neighborhood as a map, with the dice and your buttons in the pracinha in the middle. On a phone you see a small map on top and a strip of the squares around you, with players and the log one tap away.
- **Escritura cards.** Tap any square to see its price, rents and owner, and to build, sell or mortgage it.
- **Debts and trades in dialogs.** A debt opens a dialog that shows what you owe and lets you sell or mortgage until you can pay. A trade offer opens a dialog for the other player to accept or decline.
- **Turn timer, refresh and rules.** The lobby's turn timer works here too: when it runs out, the game makes the careful move for you. Refreshing the page puts you back in your seat with the same dialog open. A Rules button explains everything.
- **End screen** with everyone's place, and Play again.

### Note
- **The values are provisional.** Prices, rents and the other numbers on the board are working values and may change once they are checked against a real set.

## Unreleased — Noite de Jogos

### Added
- **Noite de Jogos.** The site is now a home for several games. Dominion is playable; "Dono do Bairro" is listed as "Em breve".
- **New front page.** It shows the site name, "Seu nome · trocar", a join row (code + Entrar) and one "Criar" row per game. It replaces the old Home screen.
- **Rooms know their game.** Each lobby is tagged with its game, so a guest who joins never has to choose one.
- **Invite links join straight away.** If your name is already saved, an invite link takes you into the room. If not, it asks for your name with the code filled in.

### Changed
- **New address.** The site now lives at https://trakinos.github.io/noite-de-jogos/. Old Dominion Friends links keep working: they forward to the new address and keep the invite code.

## Unreleased — Simultaneous attacks, rulebook, pile alerts

### Changed
- **Attacks are answered by everyone at once.** When an Attack such as Rapa hits several players, they all choose at the same time instead of one after another. Moat (Guarda-chuva) holders decide first, then everyone hit makes their choice together. The effects still apply in turn order.

### Added
- **Waiting for the others.** While an attack's choices are open, whoever isn't choosing sees a dialog listing everyone involved, with each player's status updating live from "Choosing…" to "Done". It can be hidden into a banner and shown again.
- **Rulebook.** A Rules button in the board header and the lobby opens a short guide to the rules, in both languages, plus the rule text of this game's 10 Kingdom cards.
- **Pile ran out.** When a Supply pile reaches 0, a dialog shows its counter dropping to 0, how many piles are empty, and whether the game ends this turn.
- **Low piles stand out.** A pile with 2 or fewer cards shows its count in orange, with a slow pulse.
- **Design system.** `docs/DESIGN-SYSTEM.md` documents the colors, type, motion and components.

## 2026-10-06 — Buy animation

### Added
- **Buying.** A bought card pops out of its pile and flies to the buyer's discard pile (or their seat at the top, for other players). On phones, while you shop on the Supply tab, it flies to the Hand tab.

## 2026-10-06 — Card animations

### Added
- **Drawing.** Cards you draw fly from your deck into your hand, one after another.
- **Discarding.** Cards you discard fly from your hand or the play area onto your discard pile, including at Clean-up, before the new hand is drawn. Cards discarded straight from your deck (Vassal, Sentry, Library) fly from the deck. When another player's turn ends, their play area flies to their seat at the top.
- Animations are skipped with reduced motion and while the tab is in the background.

## 2026-10-05 — Playtest round 1

Feedback from the first game with friends. Spec: `docs/superpowers/specs/2026-10-05-playtest-round-1-design.md`. Reasoning behind the coding decisions: `docs/journal/dominion-friends-impl-10052026.md`.

### Added
- **Player colors.**
  - Each player gets one of 8 colors (blue, red, teal, amber, green, purple, pink, slate), starting with the first free one.
  - Players change colors in the lobby; colors someone else holds are greyed out.
  - Colors can't change during a game. A player who refreshes keeps their color, in the lobby and in a game.
- **Turn board in the play area.**
  - The turn label, the steps (Actions › Buys › End of turn, each with its ⓘ), the counters and the timer now sit at the top of the "On the table" area.
  - That area is tinted with the active player's color.
  - Your hand area takes your color only on your turn and is neutral otherwise.
  - On phones the turn board stays fixed at the top of the screen.
- **Turn timer.**
  - The host chooses Off (the default), 45, 60, 90 or 120 s in the lobby.
  - A player answering another player's card, such as an attack, gets their own 30 s clock, and the turn clock waits for them.
  - When time runs out, open choices are answered at random and the turn ends. A timeout never plays or buys a card: Throne Room and Vassal decline.
  - Each timeout shows in the log.
- **Action-phase click guard.** While you could still play an Action, clicking a Treasure, Play all Treasures or a Market card first asks "End your Actions?". The dialog closes by itself if the turn moves on.
- **Animated VP tally.**
  - The end screen counts victory cards onto a bar per player, in their color, one card at a time, round-robin. Curses count down in red.
  - It takes about 7 s. There's a Skip button, and it honours reduced motion.
  - The winner, the score table and the buttons follow. A tie broken by fewer turns is called out.

### Fixed
- The timer could briefly show more seconds than its total.
- On phones, the PT/EN toggle covered the first tally row.
- The turn clock kept running in the host's tab after the host left.
- White text on the amber turn label was hard to read. Amber and pink were darkened, and all 8 colors now reach 4.5:1 contrast.

### Roadmap
- Added sounds: drawing, playing, attacks, reactions, game start, turn start, buying and discarding. Also a turn start while the tab is in the background, a choice opening, a shuffle and the timer's last 10 s, plus a mute toggle and volume.
- Added end-screen art that fills with the player's color as each VP card is counted.

## 2026-10-04 — Feira theme and quality of life

### Added
- **Feira theme:** Brazilian street-market card names (Centavo/Moeda/Nota, Banca/Barraca/Mercadão, Fiado for Curse, and so on), the striped-awning visual system and new screen layouts.
- **Portuguese by default,** with an EN/PT toggle that each player sets for themselves.
- **Turn steps** Actions › Buys › End of turn, with completed steps checked off.
- **ⓘ explanation** for each phase.
- **End-of-game counter** in the Market header (Grand Markets left, empty piles x/3), with the rules behind an ⓘ.
- **"No Actions to play · End Actions" shortcut** above your hand when nothing can be played.
- **Default kingdom:** new rooms start with the rulebook's "First Game" kingdom, and a **Default** button resets to it.
- **Legend** of the card icons (+Card, +Action, +Buy, +$, cost), the pile icons and the card-type colors.
- **Invite links** open a join-only screen ("You've been invited"), with a link to host instead.

## Earlier

Rules engine (all 26 base-set kingdom cards), peer-to-peer online play over PeerJS, Home/Lobby/Board/End screens, dark mode, phone layout and deploys from GitHub Actions. See `docs/ROADMAP.md` → Done.
