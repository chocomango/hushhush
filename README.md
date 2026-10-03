# Hush

A mobile-first, pass-and-play Undercover game with Civilians, Imposters, and Mr. White. Civilians and Imposters receive related words without being told their roles; Mr. White receives no word. The game tracks eliminations across rounds, handles Mr. White's final guess, and automatically detects the official victory conditions.

## Play locally

Service workers require HTTP, so serve the folder rather than opening `index.html` directly:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Publish on GitHub Pages

1. Push the repository to GitHub.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, select **Deploy from a branch**.
4. Choose `main`, `/ (root)`, and save.

GitHub will provide the public URL after the first deployment.

## Rules reference

The game flow follows the [official Undercover rules](https://www.yanstarstudio.com/undercover-how-to-play): Civilians share one word, Imposters receive a related word, Mr. White receives no word, Civilians win by eliminating every infiltrator, infiltrators win when only one Civilian remains, and an eliminated Mr. White gets one final guess.
