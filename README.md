# Polymer CRM Frontend

React frontend for Polymer CRM — a CRM that surfaces a client's Shopify orders and products (and eventually inventory) in one place. Shopify sync is a backend concern: this frontend never talks to Shopify's Admin API directly (that needs credentials that don't belong in a browser); it calls our own backend, which syncs with Shopify. Orders and Products currently run on mock data shaped like the eventual sync payload — see [Mock data →](#mock-data) below.

## Tech stack

- **[React 19](https://react.dev/)** — UI library
- **[Vite 8](https://vite.dev/)** — dev server & build tool
- **[React Router 7](https://reactrouter.com/)** — client-side routing
- **[Oxlint](https://oxc.rs/docs/guide/usage/linter.html)** — linting
- **[Prettier](https://prettier.io/)** — formatting
- **[Vitest](https://vitest.dev/) + [React Testing Library](https://testing-library.com/react)** — testing
- Plain JavaScript (no TypeScript)

## Requirements

- Node.js 20.19+ or 22.12+

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in real values
npm run dev
```

The dev server runs at http://localhost:5173.

## Environment variables

Copy `.env.example` to `.env.local` (git-ignored) and fill in real values. Only variables prefixed with `VITE_` are exposed to client code — see [`src/config/env.js`](src/config/env.js), which is the single place env vars are read from. Never read `import.meta.env` directly elsewhere.

| Variable            | Purpose                        | Default |
| ------------------- | ------------------------------ | ------- |
| `VITE_API_BASE_URL` | Base URL for backend API calls | `/api`  |

## Commands

| Command                | Description                        |
| ---------------------- | ---------------------------------- |
| `npm run dev`          | Start the dev server with HMR      |
| `npm run build`        | Build for production into `dist/`  |
| `npm run preview`      | Serve the production build locally |
| `npm run lint`         | Lint the source with Oxlint        |
| `npm run format`       | Format the codebase with Prettier  |
| `npm run format:check` | Check formatting without writing   |
| `npm test`             | Run the test suite once            |
| `npm run test:watch`   | Run tests in watch mode            |

## Color theme

The palette in [`src/styles/globals.css`](src/styles/globals.css) is sourced from [polymeruk.com](https://polymeruk.com)'s storefront theme (sage-green accent, warm cream secondary, near-black text on white):

| Token                  | Light     | Meaning                                                   |
| ---------------------- | --------- | --------------------------------------------------------- |
| `--color-accent`       | `#648c6e` | Brand sage green — primary actions, links, active states  |
| `--color-accent-hover` | `#4a5a4e` | Darker green for hover/pressed states                     |
| `--color-accent-tint`  | `#eef7ef` | Light green background for active/highlighted UI          |
| `--color-secondary`    | `#f2dec4` | Warm cream secondary accent (dividers, subtle highlights) |
| `--color-text`         | `#1a1a1a` | Primary text                                              |
| `--color-text-muted`   | `#7c7c7c` | Secondary/muted text                                      |
| `--color-bg`           | `#ffffff` | Page background                                           |
| `--color-surface`      | `#fcfcfd` | Card/surface background                                   |
| `--color-border`       | `#e5ebe5` | Default border color                                      |

A dark-mode variant of the same palette is defined alongside it. Components should always reference these CSS custom properties rather than hardcoding colors, so the theme stays swappable from one place.

### Typeface

`--font-sans` leads with `'Neue Haas Unica Pro'`, falling back to the system font stack. **That font is commercially licensed and isn't bundled with this project** — the fallback stack is what actually renders today. If you have a licensed webfont file, self-host it with an `@font-face` rule in `src/styles/globals.css` and it'll be picked up automatically; don't load it from a public CDN (most aren't licensed to redistribute it).

### Light/dark mode

**Light is the default** — the app doesn't defer to the OS preference unless the user explicitly picks "System". The `ThemeToggle` (a Light/Dark/System segmented control, icon-based — no emoji) lives inside the AppBar's `UserMenu` dropdown, not as its own AppBar button:

- `src/hooks/useTheme.js` holds the current choice, persists it to `localStorage`, and sets `data-theme="light"`/`"dark"` on `<html>` (or removes it for `"system"`, deferring to the OS).
- `src/styles/globals.css` applies the dark palette either when the OS prefers dark (and there's no explicit `"light"` override) or when `[data-theme="dark"]` is set explicitly.
- A small inline script in `index.html` applies the stored (or default-light) choice before first paint, so there's no flash of the wrong theme on load.

### App shell

`DashboardLayout` renders a full-height `Navbar` on the left and an `AppBar` + page content column on the right:

- `src/app/router/navigation.js` is the single list of top-level routes (path, label, icon) — both the Navbar's links and the AppBar's page-title heading read from it, so they can't drift apart.
- The Navbar collapses to icons-only via `src/hooks/useSidebarCollapsed.js` (persisted to `localStorage`, same pattern as `useTheme`).
- The Navbar's bottom section (avatar, name, email, log out) and the AppBar's `UserMenu` dropdown both read the same placeholder identity from `src/app/layouts/currentUser.js` — see the `TODO` there for wiring up a real session once `features/auth` has one.

## Project structure

```
src/
├── main.jsx                 # entry point — renders <App />
├── app/                      # app shell: composition root, not a feature
│   ├── App.jsx               # wires providers around the router
│   ├── providers/            # app-wide context providers
│   ├── router/                # route table + top-level route components
│   └── layouts/               # shared page chrome (header/nav/etc.)
├── features/                  # one directory per business feature
│   ├── auth/                   # login
│   ├── orders/, products/       # stat cards + a filterable table (mock data, see below)
│   │   ├── api/                  # mock*.js — swap for a real fetch here later
│   │   ├── hooks/                  # use*.js — loads via api/, exposes {data, status, error}
│   │   └── pages/
│   ├── dashboard/, inventory/     # coming-soon placeholders for now
│   └── <feature>/pages/, index.js  # the feature's public API
├── components/ui/             # generic, reusable UI primitives
│                               # (Button, Logo, StatCard, PageHeader, Table, Badge,
│                               #  ThemeToggle, icons, ...)
├── hooks/                     # generic shared hooks
├── lib/api/                   # HTTP client + typed API errors
├── lib/format.js               # shared Intl currency/date formatters
├── config/                    # env var access
├── styles/                    # global CSS
└── test/                      # test setup (jest-dom matchers, etc.)
```

See [`src/features/README.md`](src/features/README.md) for the convention each feature follows, and [`CLAUDE.md`](CLAUDE.md) for the fuller architecture rationale and rules for extending it.

## Mock data

Orders and Products are wired up end-to-end against **mock data**, not a real backend yet:

- `features/orders/api/mockOrders.js` and `features/products/api/mockProducts.js` export a `get*()` function that resolves with an array after a short simulated delay — shaped like the fields this app will eventually sync from the client's Shopify store (order/fulfillment status, SKU, inventory, etc. — see the `TODO` comments in those files).
- `features/orders/hooks/useOrders.js` / `features/products/hooks/useProducts.js` call that `get*()` function and expose `{ orders/products, status, error }`, where `status` is `'loading' | 'success' | 'error'` — so `OrdersPage`/`ProductsPage` render real loading/empty/error states, not just a happy path.
- **Swapping in the real thing** means changing what's inside `get*()` to call `apiClient` from `src/lib/api/client.js` instead of returning mock data — the hook and page don't need to change, since the return shape stays the same.

## Testing

- Co-locate tests next to the code they test: `Button.jsx` → `Button.test.jsx`.
- Use React Testing Library — query by role/label/text, not by implementation detail (class names, internal state).
- Run `npm test` before committing; `npm run test:watch` while developing.

## Architecture principles

1. **Feature isolation** — a feature's internals are only reachable through its `index.js`.
2. **Separation of concerns** — UI (`pages`/`components`), business logic (`hooks`/`utils`), and data access (`api`) stay in separate files within a feature.
3. **One API boundary** — all HTTP calls go through `src/lib/api/client.js`, never raw `fetch` in components.
4. **Promote code deliberately** — something only moves to `components/ui`, `hooks/`, or `lib/` once a second feature genuinely needs it, not preemptively.
