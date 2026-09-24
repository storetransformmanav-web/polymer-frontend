# CLAUDE.md

Guidance for AI coding agents working in this repository. Read this before adding or moving files.

## Stack (do not change without a strong reason)

- React 19, Vite 8, plain JavaScript (no TypeScript) — files are `.jsx`/`.js`.
- Package manager: **npm** (`package-lock.json` is committed — don't switch to yarn/pnpm).
- Linting: **Oxlint** (`.oxlintrc.json`) — not ESLint. Run `npm run lint`.
- Formatting: **Prettier** (`.prettierrc.json`). Run `npm run format`.
- Routing: **react-router-dom** (`createBrowserRouter`).
- Testing: **Vitest** + **React Testing Library**, jsdom environment.
- No global state library (Redux/Zustand/Context-for-everything) is installed. Don't add one speculatively — see "State management" below.

## Architecture: feature-based

```
src/
├── main.jsx              # entry point only — no logic here
├── app/                   # composition root, not a feature
│   ├── App.jsx            # AppProviders > AppRouter, nothing else
│   ├── providers/          # app-wide context providers (add here as needed)
│   ├── router/             # route table (app/router/AppRouter.jsx) + NotFoundPage
│   └── layouts/            # shared page chrome, rendered via <Outlet/>
├── features/<name>/        # one directory per business domain
│   ├── components/         # feature-only components
│   ├── hooks/               # feature-only hooks
│   ├── api/                 # this feature's requests, built on lib/api/client.js
│   ├── schemas/              # validation schemas
│   ├── pages/                 # route-level components
│   ├── utils/                  # feature-local helpers
│   └── index.js                 # PUBLIC EXPORTS — the only import surface
├── components/ui/           # generic reusable primitives (Button, Input, Modal, ...)
├── hooks/                    # generic shared hooks (used by 2+ features)
├── lib/api/                   # apiClient (fetch wrapper) + ApiError
├── config/env.js               # the only place import.meta.env is read
├── styles/globals.css           # global CSS custom properties + resets
└── test/setup.js                  # vitest setup (jest-dom matchers)
```

## Where things go

- **New page/route** → `features/<name>/pages/`, then export it from `features/<name>/index.js`, then add a route entry in `app/router/AppRouter.jsx` pointing at that export.
- **New feature** → create `features/<name>/` with only the subdirectories it needs (a simple feature might only need `pages/` and `index.js` — don't scaffold empty `schemas/`/`utils/` folders in advance).
- **API call** → add a function in `features/<name>/api/` that calls `apiClient` from `src/lib/api/client.js`. Never call `fetch` directly from a component.
- **New backend-facing error handling** → throw/catch `ApiError` (`src/lib/api/ApiError.js`); check `.status`/`.data`, don't re-parse `Response` objects in feature code.
- **Reusable UI with zero feature knowledge** (Button, Modal, Input, Card) → `components/ui/`. If it references a specific feature's data shape, it isn't generic — keep it in the feature.
- **Reusable hook with zero feature knowledge**, used by 2+ features → `hooks/`. Otherwise keep it inside the feature that uses it.
- **Env var** → add it to `.env.example` and read it through `src/config/env.js`. Never call `import.meta.env` from anywhere else.
- **Global provider** (theme, auth, query client) → register it in `src/app/providers/AppProviders.jsx`, not in `App.jsx` or `main.jsx`.

## Rules

1. **Import features only through their `index.js`.** Never `import { X } from '../../features/other/components/X.jsx'`. If it's not exported from `index.js`, it's private to that feature.
2. **Features don't reach into each other's internals**, and avoid feature-to-feature dependencies where practical — prefer lifting shared code to `lib/`, `hooks/`, or `components/ui/`.
3. **No raw `fetch` in components or pages.** Go through a feature's `api/` module, which goes through `apiClient`.
4. **Don't add a dependency without checking this file and `package.json` first** for something that already solves the problem. Before adding one, confirm it's genuinely necessary, isn't trivial to implement locally, and doesn't duplicate an existing choice (e.g. don't add axios — `lib/api/client.js` already wraps fetch; don't add a second routing or state library).
5. **State management**: default to local component state. Only reach for shared/global state when two+ unrelated components genuinely need the same value, and prefer the smallest tool that works (lift state up, or a feature-local context) before introducing a new global state library.
6. **Don't create empty placeholder directories** "for later." Add a subdirectory when the first file that belongs in it exists.
7. **Keep `App.jsx`, `main.jsx`, and `AppRouter.jsx` thin.** They wire things together; they don't contain business logic, data fetching, or complex JSX.
8. **Secrets never get committed.** Anything sensitive goes in `.env.local` (git-ignored), not `.env.example`, and never hardcoded.

## Commands

```bash
npm run dev           # dev server
npm run build          # production build
npm run lint            # Oxlint
npm run format           # Prettier — write
npm run format:check      # Prettier — check only, no writes
npm test                   # Vitest, single run
npm run test:watch          # Vitest, watch mode
```

Run `npm run lint`, `npm run format:check`, `npm test`, and `npm run build` before considering a change complete — all four should pass.

## Testing conventions

- Co-locate: `Foo.jsx` → `Foo.test.jsx`, in the same directory.
- Use React Testing Library queries by role/label/text (`getByRole`, `getByLabelText`) — avoid querying by class name or test-only attributes unless nothing else identifies the element.
- `vitest.config`'s `test` block lives in `vite.config.js`; `src/test/setup.js` registers jest-dom matchers. `globals: true` is set, so `describe`/`it`/`expect` are available without importing them (this repo's example test imports them explicitly for clarity — either style works).

## Common mistakes to avoid

- Putting a feature-specific component in `components/ui/` because it "might be reused later." Wait until it actually is.
- Importing `features/x/pages/SomePage.jsx` directly from another feature or from `app/router` instead of importing it from `features/x/index.js`.
- Calling `fetch` or `axios` directly instead of extending `lib/api/client.js`.
- Adding Redux/Zustand/React Query the moment a feature needs one piece of server or global state — try local/feature state first.
- Reading `import.meta.env.VITE_*` outside `src/config/env.js`.
- Adding a second formatter/linter (e.g. ESLint) alongside the existing Prettier/Oxlint setup.
