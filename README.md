# Hush

A mobile-first, pass-and-play Imposter / Undercover game. It is a dependency-free static site designed for GitHub Pages and works offline after the first visit.

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
