# Hush

A mobile-first, pass-and-play Undercover game with Civilians, Imposters, and Mr. White. Civilians and Imposters receive related words without being told their roles; Mr. White receives no word. Either word in a pair can be assigned to the Civilians because the sides are randomized for every game. The discussion screen includes an adjustable, reusable per-person timer that resets as play moves to the next speaker. Mr. White is excluded from starting the opening round but may start later rounds. The game tracks eliminations across rounds, handles Mr. White's final guess, and automatically detects the official victory conditions.

## Play locally

Service workers require HTTP, so serve the folder rather than opening `index.html` directly:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Publish on GitHub Pages

The included GitHub Actions workflow tests and deploys the game automatically whenever `main` is updated.

1. Push the repository to GitHub.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, select **GitHub Actions** as the source.
4. Push to `main` or run **Deploy Hush to GitHub Pages** manually from the Actions tab.

GitHub will provide the public URL after the first deployment.

## Word packs

The built-in library lives in `words.js`: 240 pairs across Everyday, Food, Places, Animals, Wild card, Cozy things, Activities, and Singapore treats. This local script loads before the game and is included in the offline cache. Player-created pairs still live in browser storage under **My words**.

To expand a pack, add a pair such as `["Coffee", "Tea"]` to its array. Use two related but different words, at most 40 characters each. Avoid duplicate pairs, including reversed pairs. Either word can be assigned to Civilians. New categories appear automatically in the word-pack menu.

When publishing changes to `words.js`, increment the cache version in `sw.js` so existing installations receive the updated library.

## Quality checks

```bash
npm test
```

The dependency-free test suite covers victory conditions, Mr. White guesses, starter rules, role swapping, speaker order, result labels, privacy hiding, and saved-game recovery.

## Rules reference

The game flow follows the [official Undercover rules](https://www.yanstarstudio.com/undercover-how-to-play): Civilians share one word, Imposters receive a related word, Mr. White receives no word, Civilians win by eliminating every infiltrator, infiltrators win when only one Civilian remains, and an eliminated Mr. White gets one final guess.
