# Hush

A cozy, bilingual, pass-and-play social deduction game for 3–12 friends and one phone. No account, server, or game download required. After its first visit, the app caches everything for offline play.

## Game modes

| Mode | How it plays |
| --- | --- |
| Classic | Describe your secret word, debate, and vote. Adjustable 10–180-second speaking timer; extra clue cycles are allowed. |
| Blitz | Each player gets 15 seconds and one turn before voting. Timer expiry advances to the next player; the last turn goes straight to the vote. |
| Chaos | A new clue challenge each elimination round: comparisons, questions, tiny stories, sounds, and more. Challenges never repeat consecutively. |

All three modes support group voting or **secret ballots**. Group voting lets the host select the group's chosen player. Secret ballots pass the phone to each surviving player, record one locked vote per person, exclude self-votes, and show only aggregate totals. Ties have a runoff among the tied candidates. Eliminated players sit out clues and votes.

## Roles and winning

Civilians and Imposters see their word without knowing which role they have. Either word in a pair can be assigned to the Civilians; the sides are randomized each game.

| Role | Secret | Goal |
| --- | --- | --- |
| Civilian | The Civilian word | Eliminate all Imposters, Mr. Whites, and Accomplices. |
| Imposter | A related word | Leave only one Civilian in play. |
| Mr. White | No word; knows their role | Bluff with the infiltrators. When voted out, gets one exact guess at the Civilian word to win alone. |
| Accomplice, optional | Knows their role and sees the Civilian word | Help the infiltrators win without knowing their identities. |
| Jester, optional | Knows their role and sees the Imposter word | Win alone by being voted out. Surviving never wins. |

Special roles unlock with 5 or more players, with at most one of each. Every setup keeps at least two Civilians and at least one Imposter or Mr. White. The Jester is neutral: it does not count as an infiltrator, and its elimination resolves its solo victory first. Mr. White cannot begin the opening discussion round.

## Made for passing the phone

- Hold to reveal secrets, with keyboard and screen-reader support.
- Secrets and unfinished ballot choices hide when the app loses focus or goes into the background.
- Return Home to pause and save a game; Continue resumes safely, including after reopening the app. Start over explicitly discards it.
- Player avatars, a surviving-player tracker, optional timer sound and vibration, and a local hall of fame.
- Wins are recorded once per completed game for named players. Winning faction members share the win, even if eliminated; solo wins belong only to the winner. Scores can be reset for a new group.
- English / 中文 on the start screen translates the whole app, including help, controls, private votes, and accessibility labels.

## Word packs

`words.js` includes **400 English** and **320 independently curated Simplified Chinese** word pairs, across eight categories: Everyday, Food, Places, Animals, Wild card, Cozy things, Activities, and Singapore treats. **Surprise me** mixes all built-in packs. Each language has its own custom pairs and saved word history.

A pair does not repeat until the selected library is exhausted, even when switching between Surprise me and individual packs. The first draw after exhaustion avoids the previous pair when another pair exists. Custom pairs remain playable even when only one is saved.

To expand a pack, add a pair such as `["Coffee", "Tea"]`. Use two related, meaningfully different words, at most 40 characters each. Avoid identical, duplicate, or reversed pairs. Keep category keys aligned across both languages and add Chinese category labels when introducing a pack.

## Play locally

Service workers require HTTP, so serve the folder rather than opening `index.html` directly:

```bash
python3 -m http.server 8000
```

Visit `http://localhost:8000`. The game has no runtime package dependencies.

## Publish on GitHub Pages

The included GitHub Actions workflow tests and deploys whenever `main` is updated.

1. Push the repository to GitHub.
2. Open **Settings → Pages**.
3. Set **Build and deployment → Source** to **GitHub Actions**.
4. Push to `main` or run **Deploy Hush to GitHub Pages** manually.

Increment the cache version in `sw.js` when changing cached app files. Include any new local assets in its asset list.

## Quality checks

```bash
npm test
```

The dependency-free suite covers word-library integrity, modes, role balance and victories, private ballots and runoffs, timers, localization, scores, nonrepeating draws, storage migration, custom words, and reveal privacy. Shared pure gameplay rules live in `rules.js`; browser flows and bilingual views live in `app.js`.

## Rules reference

Classic follows the [official Undercover pass-and-play rules](https://www.yanstarstudio.com/undercover-how-to-play). Blitz, Chaos, Jester, Accomplice, and secret ballots are optional Hush variations, explained in the app.
