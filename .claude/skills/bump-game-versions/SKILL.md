---
name: bump-game-versions
description: Bump the per-game version numbers in src/games/catalog.ts. Use before every git commit in this repo (and whenever the user says "bump versions"), so each game touched by the commit gets a new semver.
---

# Bump game versions

Each game has a `version` (semver string) in `GAMES` in `src/games/catalog.ts`. It is shown on the front page and in the lobby game picker. Run this **before every commit**, so the version bump goes into the same commit.

## Steps

1. List what the commit touches: `git status --short` and `git diff --stat HEAD` (include staged and unstaged files).
2. Map changed files to games. A file under `src/games/<id>/` belongs to that game (ids: dominion → also `src/engine/`, `src/cards/`; bairro, chess, pista, vida, naval, zerou, velha, forca, stop, sudoku, catan). `src/games/newGames.tsx` and the screens it wires belong to the game named in the diff. Shared code (`src/games/shared/`, `src/ui/`, `src/net/`, `src/styles.css`, `src/i18n/`) does not bump anything by itself — but a style or text change that clearly targets one game (e.g. `.stop__*` classes, a `gameStopX` string) bumps that game.
3. Pick the bump for each touched game:
   - **patch** (0.1.0 → 0.1.1): bug fix, balance/value tweak, copy or style change, more words/content.
   - **minor** (0.1.1 → 0.2.0): new feature, option, mode or rule change players will notice.
   - **major** (0.x → 1.0.0): only when the user says the game is ready for 1.0, or a rule change breaks saved/in-flight compatibility.
   If a commit holds several changes to one game, use the highest level among them (and reset lower numbers to 0).
4. Edit the `version: '…'` of just those games in `src/games/catalog.ts`. Leave untouched games alone. If the commit touches no game, bump nothing.
5. Mention the bumps in the commit message body (e.g. `Versions: stop 0.2.0, forca 0.1.1`).
6. Run `npm run typecheck` and `npx vitest run src/games/catalog.test.ts` to confirm the catalog is still valid.

## Notes
- `package.json` `version` is the app/platform version; bump it (patch) only for platform-wide changes (lobby, front page, PWA, networking), not for single-game changes.
- Never bump a game just because a shared file changed with no visible effect on it.
