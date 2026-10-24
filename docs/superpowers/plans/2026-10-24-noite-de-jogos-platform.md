# Noite de Jogos Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Dominion Friends into Noite de Jogos. The site gets a front page that lists the games and joins rooms. Rooms say which game they are. The site moves to a new address and the old one redirects.

**Architecture:** A small game catalog (`src/games/catalog.ts`) feeds the front page and tags every lobby with its game id. The front page replaces `Home.tsx`. Invite links auto-join when a name is saved. The deeper split (a generic `HostSession` parameterized by a game module) is **deferred to the Dono do Bairro plan**: designing that interface around one engine would be guesswork, and the second engine will show its real shape. This plan only adds the seams that plan needs, `LobbyState.game` and the catalog. The rename and redirect happen last, outside the codebase, with the user's go-ahead.

**Tech Stack:** React 19 + TypeScript + Vite, Vitest, PeerJS, GitHub Pages via Actions, `gh` CLI.

**Spec:** `docs/superpowers/specs/2026-10-24-noite-de-jogos-banco-imobiliario-design.md` (sections 4.1–4.3 and the front-page part of 6b)

## Global Constraints

- Site name **"Noite de Jogos"** in both languages. Only the subtitle is translated.
- New repo `trakinos/noite-de-jogos`, new address `https://trakinos.github.io/noite-de-jogos/`. Old address `https://trakinos.github.io/dominion-friends/` redirects there and **keeps `#join=CODE`**.
- Dominion's existing tests stay green after every task (`npm test`, `npm run typecheck`).
- Every player-facing string goes in both `src/i18n/pt.ts` and `src/i18n/en.ts`.
- Keep the `dmf-` localStorage keys and peer-id prefix. The origin (`trakinos.github.io`) doesn't change, so saved names, language and rejoin tokens survive the rename.
- Ask the user before every push to `main` (a push redeploys), and before renaming or creating any GitHub repo.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **An old invite link after the rename** (`…/dominion-friends/#join=ABCD`) lands in room ABCD's lobby on the new address, not on a 404 or the bare front page. Covered by Task 4 Step 2 and Task 5 Step 6.
2. **An invite link opened with no saved name** shows a name prompt with the code already filled in, and doesn't auto-join as "Player". Covered by the `entryAction` tests in Task 2.
3. **An invite link opened after the room is gone** shows the "room not found" error on the front page and clears the hash, so a refresh doesn't retry forever. Covered by Task 2 Step 1 (`entryAction` ignores an invalid hash) and the App change in Task 2 Step 5.
4. **A Dominion game in progress during the deploy:** the old client gets a lobby with an extra `game` field. Adding a field must not break `parseHostMessage`. Covered by a protocol test in Task 1.
5. **A phone 375 px wide:** the front page has no sideways scroll, and the join row's input and button stay on one line. Covered by Task 3 Step 6.

---

### Task 1: Game catalog and game-tagged lobbies

**Files:**
- Create: `src/games/catalog.ts`
- Test: `src/games/catalog.test.ts`
- Modify: `src/net/protocol.ts` (`LobbyState`), `src/net/host.ts` (`lobby` getter), `src/net/protocol.test.ts`, `src/net/host.test.ts`

**Interfaces:**
- Produces:
  - `type GameId = 'dominion' | 'bairro'`
  - `interface GameInfo { id: GameId; nameKey: UiKey; tagKey: UiKey; minPlayers: number; maxPlayers: number; lengthKey: UiKey; available: boolean }`
  - `const GAMES: readonly GameInfo[]` in front-page order: Dominion (`available: true`, 2–4), then Dono do Bairro (`id: 'bairro'`, `available: false`, 2–6)
  - `function isGameId(x: unknown): x is GameId`
  - `LobbyState.game: GameId`. `HostSession` always reports `'dominion'` for now (the Dono do Bairro plan makes it a constructor option).

- [ ] **Step 1: Write the failing tests**

```ts
// src/games/catalog.test.ts
it('lists Dominion first and playable, Dono do Bairro as coming soon', () => {
  expect(GAMES.map((g) => [g.id, g.available, g.minPlayers, g.maxPlayers])).toEqual([
    ['dominion', true, 2, 4],
    ['bairro', false, 2, 6],
  ]);
});
it('recognises game ids', () => {
  expect(isGameId('dominion')).toBe(true);
  expect(isGameId('bairro')).toBe(true);
  expect(isGameId('monopoly')).toBe(false);
  expect(isGameId(undefined)).toBe(false);
});
it('every catalog key exists in both dictionaries', () => {
  for (const g of GAMES) for (const k of [g.nameKey, g.tagKey, g.lengthKey]) {
    expect(DICTIONARIES.pt.ui[k]).toBeTruthy();
    expect(DICTIONARIES.en.ui[k]).toBeTruthy();
  }
});
```

In `src/net/host.test.ts`: `expect(new HostSession().lobby.game).toBe('dominion')`.
In `src/net/protocol.test.ts`: a `lobby` message whose `lobby` has `game: 'dominion'` parses and keeps the field (`parsed.lobby.game === 'dominion'`).

- [ ] **Step 2: Run them and make sure they fail**

Run: `npx vitest run src/games src/net/host.test.ts src/net/protocol.test.ts`
Expected: FAIL (module `src/games/catalog` not found; `game` is undefined).

- [ ] **Step 3: Implement the catalog and add the `game` field**

Add these UI keys to both dictionaries (`en.ts` defines `UiKey`):

| key | pt | en |
|---|---|---|
| `gameDominionName` | Dominion Friends | Dominion Friends |
| `gameDominionTag` | Construção de baralho | Deck-building |
| `gameDominionLength` | 30–45 min | 30–45 min |
| `gameBairroName` | Dono do Bairro | Dono do Bairro |
| `gameBairroTag` | Compra e venda no bairro | Buying up the neighborhood |
| `gameBairroLength` | 45 min–2 h | 45 min–2 h |

`HostSession.lobby` returns `game: 'dominion'`.

- [ ] **Step 4: Run all tests and the typecheck**

Run: `npm test && npm run typecheck`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/games src/net/protocol.ts src/net/host.ts src/net/*.test.ts src/i18n/pt.ts src/i18n/en.ts
git commit -m "feat: game catalog and game-tagged lobbies"
```

### Task 2: Entry logic: invite links auto-join

**Files:**
- Create: `src/ui/entry.ts`
- Test: `src/ui/entry.test.ts`
- Modify: `src/ui/App.tsx`

**Interfaces:**
- Consumes: `codeFromHash(hash)` from `src/net/roomCode.ts`, `loadName()` from `src/ui/storage.ts`
- Produces: `type EntryAction = { kind: 'front' } | { kind: 'invited'; code: string } | { kind: 'autoJoin'; code: string; name: string }` and `function entryAction(hash: string, savedName: string): EntryAction`

- [ ] **Step 1: Write the failing tests**

```ts
it('no hash: front page', () => expect(entryAction('', 'Ana')).toEqual({ kind: 'front' }));
it('invalid code in hash: front page', () => expect(entryAction('#join=XX', 'Ana')).toEqual({ kind: 'front' }));
it('invite with a saved name: join straight away', () =>
  expect(entryAction('#join=abcd', 'Ana')).toEqual({ kind: 'autoJoin', code: 'ABCD', name: 'Ana' }));
it('invite without a saved name: ask for the name first', () =>
  expect(entryAction('#join=ABCD', '  ')).toEqual({ kind: 'invited', code: 'ABCD' }));
```

- [ ] **Step 2: Run them and make sure they fail**

Run: `npx vitest run src/ui/entry.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `entryAction` in `src/ui/entry.ts`**

A name that is empty after trimming counts as "no saved name".

- [ ] **Step 4: Run them and make sure they pass**

Run: `npx vitest run src/ui/entry.test.ts`
Expected: PASS.

- [ ] **Step 5: Use it in `App.tsx`**

On mount (a one-time effect), compute `entryAction(location.hash, loadName())`. For `autoJoin`, call the existing join path (`connect(name, …joinGame…)`). For `invited`, pass the code to the front page (Task 3) as `invitedCode`. When a join is rejected or fails, clear the hash with `history.replaceState(null, '', location.pathname)` so a refresh doesn't retry a dead room. While auto-joining, the existing "Entrando na sala {code}…" loader shows.

- [ ] **Step 6: Run all tests and the typecheck, then commit**

Run: `npm test && npm run typecheck` (expected: all pass)

```bash
git add src/ui/entry.ts src/ui/entry.test.ts src/ui/App.tsx
git commit -m "feat: invite links join straight away when a name is saved"
```

### Task 3: Front page

**Files:**
- Create: `src/ui/screens/FrontPage.tsx`
- Delete: `src/ui/screens/Home.tsx`
- Modify: `src/ui/App.tsx`, `src/styles.css` (replace the `.home*` rules, including the `@media` block near line 765, with `.front*` rules), `src/i18n/pt.ts`, `src/i18n/en.ts`
- Mockup to match: `.superpowers/brainstorm/75667-1792873341/content/front-page-v2.html` (local only)

**Interfaces:**
- Consumes: `GAMES`, `GameId` (Task 1); `invitedCode` from `entryAction` (Task 2)
- Produces: `FrontPage` props: `{ initialName: string; invitedCode: string | null; busy: boolean; error: string | null; onHost(game: GameId, name: string): void; onJoin(code: string, name: string): void }`. `App` keeps calling `hostGame(name)` for `'dominion'`. The Dono do Bairro plan routes `'bairro'`.

- [ ] **Step 1: Add the UI keys and remove the dead Home keys**

New keys, in both dictionaries:

| key | pt | en |
|---|---|---|
| `siteName` | Noite de Jogos | Noite de Jogos |
| `siteTagline` | Jogos de tabuleiro com os amigos, cada um no seu aparelho. | Board games with friends, each on their own device. |
| `yourNameIs` | Seu nome: | Your name: |
| `changeName` | trocar | change |
| `joinRowTitle` | Entrar em uma sala | Join a room |
| `joinRowBlurb` | Digite o código que seu amigo mandou | Type the code your friend sent |
| `createRoomTitle` | Criar uma sala | Create a room |
| `createButton` | Criar | Create |
| `comingSoon` | Em breve | Coming soon |
| `playersRange` | {min}–{max} jogadores | {min}–{max} players |
| `invitedFrontTitle` | Você recebeu um convite para a sala {code} | You're invited to room {code} |

Delete `tagline`, `hostTitle`, `hostBlurb`, `hostButton`, `joinTitle`, `invitedTitle` and `hostInstead`, and fix anything that still uses them. Keep `appName` ("Dominion Friends"): the Dominion board header still uses it.

- [ ] **Step 2: Build `FrontPage.tsx`**

From top to bottom:
- `h1` with `siteName`, then `siteTagline`.
- **Name line:** with a saved name, "Seu nome: **Ana** · trocar". The link swaps in the existing name input (`MAX_NAME_LENGTH`). With no saved name, the input shows directly.
- **Join row:** a `.front__row` with a join icon, `joinRowTitle`/`joinRowBlurb`, a code input (`.input--code`, `CODE_LENGTH`, uppercase, `normalizeRoomCode`), and an "Entrar" button that is disabled until the code is valid. Enter in the input submits.
- `createRoomTitle` label, then **one `.front__row` per entry in `GAMES`**: an art strip, the name, "tag · playersRange · length", and a "Criar" button. Unavailable games show a `comingSoon` pill instead of the button, at reduced opacity.
- With `invitedCode` set: the join row comes first with the code filled in and focus on the name input, and `invitedFrontTitle` is shown above it.
- `busy` and `error` show the same way `Home` did (`tr.reason(error)`).

Art strips are CSS only: Dominion uses the existing `--stripe-a`/`--stripe-b` awning stripes, and Bairro uses a `--t-victory` → `--t-reaction` gradient.

- [ ] **Step 3: Wire it into `App.tsx`**

Replace `<Home …>` with `<FrontPage …>`. `onHost('dominion', name)` goes to `hostGame(name)`.

- [ ] **Step 4: Run all tests and the typecheck**

Run: `npm test && npm run typecheck`
Expected: all pass.

- [ ] **Step 5: Check it in the browser at desktop width**

Start preview `dev`. Check:
- The front page matches the mockup's order.
- "Criar" on Dominion opens a lobby.
- In a second tab, typing the code and pressing "Entrar" joins that lobby.
- `#join=CODE` with a saved name joins without a click.
- `#join=CODE` after clearing `dmf-name` shows the invited layout.
- `#join=ZZZZ` shows the not-found error and clears the hash.
- The console has no errors.

- [ ] **Step 6: Check phone width and dark mode**

`resize_window` mobile (375×812): `document.documentElement.scrollWidth <= 375`, and the join row's input and button stay on one line. Repeat in the dark color scheme. Take screenshots as proof, then reset to desktop.

- [ ] **Step 7: Commit**

```bash
git add -A src/ui src/styles.css src/i18n
git commit -m "feat: Noite de Jogos front page replaces Home"
```

### Task 4: Rename inside the repo and the redirect page

**Files:**
- Modify: `index.html` (`<title>Noite de Jogos</title>`), `package.json` (`"name": "noite-de-jogos"`), `docs/CHANGELOG.md`, `docs/ROADMAP.md` (tick platform items)
- Create: `tools/redirect/index.html` (published later as the `dominion-friends` repo's only file)

- [ ] **Step 1: Update the title, package name, changelog and roadmap**

Changelog: rename the heading to "Changelog — Noite de Jogos", point the deploy line at the new address, and add an entry "Noite de Jogos": front page, join row, invite links that join straight away, and the new address with old links still working.

- [ ] **Step 2: Write `tools/redirect/index.html`**

A standalone page with `<meta name="robots" content="noindex">` and a short pt-BR line, "Mudamos para Noite de Jogos…" plus a link. A script runs:

```js
location.replace('https://trakinos.github.io/noite-de-jogos/' + location.search + location.hash);
```

Add `<noscript>` with a plain link.

- [ ] **Step 3: Check the redirect locally**

Open `tools/redirect/index.html#join=ABCD` in the browser pane through a `file://` URL or a quick static preview. Check that it navigates to `https://trakinos.github.io/noite-de-jogos/#join=ABCD`. (It 404s until Task 5. Only the URL matters here.)

- [ ] **Step 4: Run all tests, typecheck and build, then commit**

Run: `npm test && npm run typecheck && npm run build` (expected: all pass)

```bash
git add index.html package.json package-lock.json docs/CHANGELOG.md docs/ROADMAP.md tools/redirect
git commit -m "chore: rename to Noite de Jogos; add old-address redirect page"
```

### Task 5: Rename the GitHub repo and go live (needs the user's go-ahead)

Every step here changes the user's GitHub account or the live site. **Ask the user once, before Step 1, naming all of these actions.** Pick a moment when nobody is playing.

- [ ] **Step 1: Push `main`** (with the go-ahead): `git push`. Wait for the Actions deploy to finish green: `gh run watch`.
- [ ] **Step 2: Rename the repo:** `gh repo rename noite-de-jogos --repo trakinos/dominion-friends --yes`
- [ ] **Step 3: Point the local remote at the new repo:** `git remote set-url origin git@github.com:trakinos/noite-de-jogos.git`, then `git remote -v` shows the new URL.
- [ ] **Step 4: Redeploy under the new name:** `gh workflow run deploy.yml` then `gh run watch`. The new address `https://trakinos.github.io/noite-de-jogos/` serves the front page (`curl -sI` returns 200).
- [ ] **Step 5: Create the redirect repo**
  - In a scratch directory, `git init` with only `tools/redirect/index.html` copied in as `index.html`, then `gh repo create trakinos/dominion-friends --public --source . --push`.
  - Turn on Pages from `main` / root: `gh api -X POST repos/trakinos/dominion-friends/pages -f 'source[branch]=main' -f 'source[path]=/'`.
- [ ] **Step 6: Check old links:** once `https://trakinos.github.io/dominion-friends/` returns 200, open `https://trakinos.github.io/dominion-friends/#join=ABCD` in the browser pane. It must end on `https://trakinos.github.io/noite-de-jogos/#join=ABCD` with the "room not found" error, since ABCD doesn't exist. Then host a real room on the new address and join it through the old-address link from a second tab.
- [ ] **Step 7: Update project memory** (`dominion-friends-project.md`): the new repo, address and remote, the redirect repo, and that the platform is live.
