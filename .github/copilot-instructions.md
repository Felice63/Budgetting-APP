# Project Rules: Budget PWA

## Technology Stack Philosophy
- **Strictly Vanilla:** Only Vanilla JavaScript (ES6+), Semantic HTML5, and Modern CSS.
- **No Frameworks:** DO NOT suggest React, Vue, Svelte, Tailwind, or external bundlers unless explicitly requested. Use native platform features.
- **Component Architecture:** Use native Web Components (`customElements.define`) with encapsulated Shadow DOM.

## Data & Storage
- **Local Client-Side Storage:** Use IndexedDB for all relational, time-series transactional data. Avoid localStorage for core app states.
- **Date Management:** Use native `Intl.DateTimeFormat` and the `Date` object.

## Code Style & Consistency
- Use clean, modular, self-contained functional modules or explicit Web Component classes.
- Define custom style properties using native CSS variables (`--variable-name`) inside `:host` blocks.


## Structure & Organization
- **File Naming:** Use kebab-case for file names (e.g., `user-profile-card.js`).
- **Directory Structure:** Organize components in a `components/` directory, with each component in its own subdirectory containing its JS, CSS, and HTML template files.
- **Shadow DOM:** All component styles must be encapsulated within the Shadow DOM. Avoid global stylesheets

├── .github/
│   ├── copilot-instructions.md
│   └── agents/
├── docs/
├── src/
│   ├── components/
│   │   ├── budget-app.js
│   │   └── budget-calendar.js
│   ├── storage/
│   │   └── db.js
│   ├── index.html
│   └── sw.js (Service Worker)
├── manifest.json
└── vercel.json