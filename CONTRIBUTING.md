# Contributing to Nimazi

Thank you for your interest in contributing! Nimazi is a lightweight, vanilla JavaScript prayer-times app — no build step, no bundler, no dependencies to install.

---

## Project Structure

```
nimazi/
├── index.html        # Main prayer times page
├── settings.html     # Settings page
├── guide.html        # Prayer guide
├── about.html        # About page
│
├── js/
│   ├── app.js        # Core prayer-times logic (fetch, cache, display, athan)
│   ├── settings.js   # Settings page logic (save/load preferences)
│   ├── guide.js      # Guide page (theme application + section toggles)
│   └── utils.js      # Shared utilities (Ramadan dates, location detection, autocomplete)
│
├── css/
│   └── styles.css    # All styles — themes at the bottom, design tokens at the top
│
├── athan/            # Athan audio files (MP3)
└── assets/           # Images, favicon, branding
```

---

## Running Locally

No setup needed. Just open `index.html` in your browser:

```bash
# Option 1 — open directly
open index.html

# Option 2 — serve locally (avoids any file:// quirks)
npx serve .
# or
python -m http.server 8080
```

---

## Code Style

- **Vanilla JS** — no frameworks, no TypeScript, no build step.
- **No modules** — scripts are loaded via `<script>` tags in order: `utils.js` first, then the page-specific script.
- **Shared logic lives in `utils.js`** — if you find yourself writing the same function in more than one file, it belongs there.
- Indentation: **4 spaces**.
- Prefer `const` / `let` over `var`.
- Keep functions focused and named clearly — no abbreviations in function names.

---

## Updating Ramadan Dates

Ramadan dates are stored in one place: **`utils.js`** at the top of the file in the `RAMADAN_DATES` object.

```js
const RAMADAN_DATES = {
    2025: { start: new Date(2025, 2,  1), end: new Date(2025, 2, 30) },
    2026: { start: new Date(2026, 1, 17), end: new Date(2026, 2, 18) },
    2027: { start: new Date(2027, 1,  6), end: new Date(2027, 2,  7) },
    // Add next year before the current year ends
};
```

Months are **0-indexed** (January = 0, February = 1, …).
A new entry should be added before the current year ends so the app is ready when Ramadan begins.

---

## Adding a New Theme

1. Add a new option to the `<select id="themeSelect">` in `settings.html`.
2. Add a CSS class (e.g. `body.my-theme`) in `styles.css`, following the Ramadan and Kids patterns.
3. Handle the new theme class in `applyTheme()` in `app.js`.
4. Handle it in the theme-application IIFE at the top of `guide.js`.

---

## Submitting a Pull Request

1. Fork the repo and create a branch: `git checkout -b my-feature`
2. Make your changes.
3. Test by opening `index.html` in a browser — check all four pages and both mobile and desktop layouts.
4. Verify the browser console has no errors.
5. Open a PR with a clear description of what changed and why.

---

## Reporting Issues

Please open a [GitHub Issue](https://github.com/iamshipon1988/nimazi/issues) and include:
- What you expected to happen
- What actually happened
- Your browser and OS
- Steps to reproduce
