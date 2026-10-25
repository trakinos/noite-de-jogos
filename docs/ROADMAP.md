# Noite de Jogos — Roadmap

Last updated: 2026-10-24

Noite de Jogos (formerly Dominion Friends) is a site where one group of friends plays board games online, each person on their own device, usually while on a call. It has two games:
- **Dominion Friends:** Dominion with the Feira theme. Playable now.
- **Dono do Bairro:** the classic rules of Banco Imobiliário with a neighborhood theme. Planned.

Design: `docs/superpowers/specs/2026-10-24-noite-de-jogos-banco-imobiliario-design.md`

## Done (Dominion Friends)

- [x] **Rules engine:** Dominion 2nd-edition base set with all 26 kingdom cards. Tested with 200 simulated games and fuzzed against malformed input. (Plan 1)
- [x] **Online play:** one player hosts from their browser and friends join by room code or link over PeerJS. Includes rejoining after a refresh, heartbeat-based disconnect detection, and an "End game" button for the host. (Plan 2)
- [x] **UI:** Home, Lobby with kingdom picker, Board with choice dialogs, and End screen with Play again. Supports dark mode and a phone layout.
- [x] **Deploy workflow:** GitHub Actions runs typecheck, tests and build, then publishes to GitHub Pages.
- [x] **Solo test:** two tabs on one machine.

## Noite de Jogos

### A. Platform: rename, front page, shared parts
Dominion must keep working and its tests must stay green after every step.
- [x] Lobbies say which game they are (`LobbyState.game`), and a game catalog feeds the front page.
- [x] A room tells the guest which game it is, so joining never asks you to choose.
- [x] **Front page** (option C with a join row): the site name and PT/EN switch, "Seu nome · trocar", a join row (code + Entrar), then one "Criar" row per game with its name, tag, player count and length. It replaces the Dominion Home screen. Invite links skip it.
- [x] **Rename** the site to Noite de Jogos: the repo becomes `trakinos/noite-de-jogos`, and the new address is `trakinos.github.io/noite-de-jogos/`. Ask before doing it.
- [x] **Redirect** the old address: a tiny `dominion-friends` repo whose page redirects to the new address and keeps `#join=CODE`. Check that an old invite link still works.
- [x] Update the title, docs, CHANGELOG and git remote.

### B. Dono do Bairro (Banco Imobiliário rules)
Classic rules, 2–6 players, playable on working values first. The user checks the board on screen and real values replace the working ones later.
- [x] Generic host: split the reusable host parts (lobby, seats, colors, rejoin, turn clock, per-player views) away from Dominion's engine, so a game module plugs in. Deferred from A until the second engine shows its real shape.
- [x] **Board data:** 40 squares, 22 pontos in 8 ruas, 6 serviços (companhias), and the Deu Bom / Deu Ruim deck. All of it is one data file, and the names live in a theme file (PT/EN). The values are working values (classic geometry, Monopoly-proportioned prices and rents) until the user checks them.
- [x] **Engine:** rolling and moving, doubles (3 doubles = Xilindró), the Ponto de Ônibus pay ($200), buy or leave (no auction), rent (full street doubles it, puxadinhos/prédio, serviços = dice × multiplier, all 6 doubles it), Bolão and IPTU, the cards deck, the Carta do Advogado (Habeas Corpus).
- [x] **Building:** only on your own turn and only with the full rua, built evenly, up to 4 puxadinhos then a prédio, sold back at half price.
- [x] **Mortgage** at the printed value, paid off at +20%.
- [x] **Xilindró:** up to 3 turns; leave with doubles, the $50 fine or the Carta do Advogado.
- [x] **Trading on your own turn only:** pontos, money and Carta do Advogado in either direction, which the other player accepts or declines. It has its own short answer clock.
- [x] **Debts and bankruptcy:** sell and mortgage to pay (also off-turn, only to settle a debt), "Faliu", and the last player left wins.
- [x] **Turn timer and timeouts:** the cautious move (never spends money by choice).
- [x] Engine tests: unit tests, simulated games and fuzzed intents, the same as Dominion.
- [x] **Board mockups** (a neighborhood map around the pracinha) for the user to choose from, then the screens: lobby, board, your panel, opponents, trade dialog, animated dice and token, log, end screen, rules dialog. Phone first, dark mode.
- [ ] **Partida rápida** (lobby options, all off by default, one switch turns on the bundle): a time limit (30/45/60/90 min, the round finishes, the richest player wins), prédio after 3 puxadinhos, deal out pontos at the start, leave the Xilindró early.
- [ ] Playtest with friends on a call. **The user checks the board's names and values** against a real classic set and sends corrections. Only the data file changes.

### C. Dono do Bairro, later
- [ ] Replace the working values with the checked classic numbers and Sorte ou Revés cards.
- [ ] Counter-offers in trades.
- [ ] Bots to fill seats.
- [ ] Sounds (dice, buying, rent, going to the Xilindró).

## Dominion Friends

### 1. Put it online ✅
Nothing else is needed before friends anywhere can play.
- [x] Create a GitHub repository and push `main`: https://github.com/trakinos/dominion-friends
- [x] Set **Settings → Pages → Source** to **GitHub Actions**.
- [x] Open the Pages URL and host a game from it: **https://trakinos.github.io/dominion-friends/**

### 2. Playtest with friends
Real players will find what two tabs on one machine can't.
- [x] Play a 2-player game with a friend on another network.
- [ ] Play a 3–4 player game, including at least one player on a phone.
- [ ] Try the awkward cases: someone refreshes, someone's phone locks, the host leaves.
- [ ] Watch for players who can't connect at all. Strict networks (office, university, some mobile carriers) can block direct browser-to-browser connections. If that happens, see "Relay server" under Next.
- [ ] Write down what was confusing, slow or annoying. That feedback ranks the polish items below.

Round 1 feedback and what changed: `docs/superpowers/specs/2026-10-05-playtest-round-1-design.md`

### Next

### 3. Theme (the Tanto Cuore step)
The game rules don't change; only the presentation does.
- [ ] Choose the theme.
- [ ] Rename all 33 cards in `src/theme/index.ts`.
- [ ] Set colors and fonts in `src/styles.css`.
- [ ] Add card art: images supplied or generated, plus an image slot in the card frame.
- [ ] Optionally, rewrite the card text in the theme's voice. The rules stay the same.
- [ ] **End-screen art:** an illustration per VP card (for example a stall or market scene) that fills with the scoring player's color as the card is counted in the tally. Replaces the card chips.

### 4. Learning the game
New players should be able to learn without someone explaining it.
- [ ] **Rules:** an in-game rules page that covers setup, the turn (Action, Buy, Clean-up), card types, how the game ends and scoring. Open it from the Home screen, the Lobby and the Board.
- [ ] **Tutorial tips:** short hints that point out key moments for first-time players, such as "Play your Treasures, then buy a card" or "Actions let you play more cards". They can be dismissed, a player can turn them off, and they stay off once dismissed.

### 5. Gameplay polish
Order these by playtest feedback.
- [ ] **Animations:**
  - cards moving between zones: drawing, playing, buying, discarding, trashing;
  - shuffling;
  - highlights when a turn passes and when a choice prompt opens;
  - support for reduced motion (`prefers-reduced-motion`).
- [ ] Show set-aside and revealed cards (Library, Sentry, Bandit). Today they vanish from view while the choice is open.
- [ ] **Sounds**, with a mute toggle and volume remembered per device:
  - drawing cards, playing a card, attacks, reactions (counters), game start, turn start, buying at the market, discarding;
  - your turn starting while the tab is in the background (plus a changing tab title);
  - a choice dialog opening, a shuffle, the timer's last-10-seconds tick.
- [x] Turn timer (host setting) with random auto-moves and a 30 s clock for attack responses.
- [ ] Add bots to fill empty seats or to practice solo. Build on the simple bot in `src/sim/bigMoney.ts`.
- [ ] Relay server, if playtests show connection failures: add a TURN server (free tier on Metered or Cloudflare) to the PeerJS config.

### Small known gaps
- [ ] The double-click guard can rarely let a second click through when another player's move arrives at the same instant.
- [ ] The choice dialog doesn't manage keyboard focus.
- [ ] Connections from refused players stay open until those players leave.

### Later

### 6. Bigger additions
- [ ] Custom cards. The engine already supports them as data plus a small effect function.
- [ ] A Tanto Cuore-style twist, such as a separate scoring area that opponents can attack.
- [ ] Expansion cards (Intrigue, Seaside and so on).
- [ ] Save and resume a game. This would need the card effects rewritten as steps that can be saved, instead of paused functions held in the host's memory.
- [ ] Hand hosting over to another player if the host leaves.

## References
- Noite de Jogos + Dono do Bairro design: `docs/superpowers/specs/2026-10-24-noite-de-jogos-banco-imobiliario-design.md`
- Design spec: `docs/superpowers/specs/2026-10-04-dominion-friends-design.md`
- Plan 1 (engine): `docs/superpowers/plans/2026-10-04-engine-and-cards.md`
- Plan 2 (networking and UI): `docs/superpowers/plans/2026-10-04-networking-and-ui.md`
- Playtest round 1 spec: `docs/superpowers/specs/2026-10-05-playtest-round-1-design.md`
- Noite de Jogos platform plan: `docs/superpowers/plans/2026-10-24-noite-de-jogos-platform.md`
- Playtest round 1 plan: `docs/superpowers/plans/2026-10-05-playtest-round-1.md`
