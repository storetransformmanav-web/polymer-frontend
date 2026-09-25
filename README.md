# Polymer CRM Frontend

React frontend for Polymer CRM — a CRM that surfaces a client's Shopify orders and products (and eventually inventory) in one place. Shopify sync is a backend concern: this frontend never talks to Shopify's Admin API directly (that needs credentials that don't belong in a browser); it calls our own backend, which syncs with Shopify. Orders and Products currently run on mock data shaped like the eventual sync payload — see [Mock data →](#mock-data) below.

## Tech stack

- **[React 19](https://react.dev/)** — UI library
- **[Vite 8](https://vite.dev/)** — dev server & build tool
- **[TypeScript](https://www.typescriptlang.org/)** (`strict: true`) — every source file is `.ts`/`.tsx`
- **[Tailwind CSS v4](https://tailwindcss.com/)** (`@tailwindcss/vite`) — utility classes in JSX; no per-component CSS files
- **[React Router 7](https://reactrouter.com/)** — client-side routing
- **[TanStack Query](https://tanstack.com/query)** — server state (fetching, caching, loading/error states)
- **[Redux Toolkit](https://redux-toolkit.js.org/) + [react-redux](https://react-redux.js.org/)** — client/global UI state (theme, sidebar)
- **[Axios](https://axios-http.com/)** — HTTP client, wrapped by `src/lib/api/client.ts`
- **[Zod](https://zod.dev/)** — runtime schema validation; feature types are derived from schemas (`z.infer`)
- **[Oxlint](https://oxc.rs/docs/guide/usage/linter.html)** — linting (TypeScript-aware)
- **[Prettier](https://prettier.io/)** — formatting
- **[Vitest](https://vitest.dev/) + [React Testing Library](https://testing-library.com/react)** — testing

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

Copy `.env.example` to `.env.local` (git-ignored) and fill in real values. Only variables prefixed with `VITE_` are exposed to client code — see [`src/config/env.ts`](src/config/env.ts), which is the single place env vars are read from (declare new ones on `ImportMetaEnv` in [`src/vite-env.d.ts`](src/vite-env.d.ts) too, so they're typed). Never read `import.meta.env` directly elsewhere.

| Variable            | Purpose                        | Default |
| ------------------- | ------------------------------ | ------- |
| `VITE_API_BASE_URL` | Base URL for backend API calls | `/api`  |

## Commands

| Command                | Description                              |
| ---------------------- | ---------------------------------------- |
| `npm run dev`          | Start the dev server with HMR            |
| `npm run build`        | Typecheck (`tsc -b`), then build `dist/` |
| `npm run typecheck`    | Typecheck only, no build output          |
| `npm run preview`      | Serve the production build locally       |
| `npm run lint`         | Lint the source with Oxlint              |
| `npm run format`       | Format the codebase with Prettier        |
| `npm run format:check` | Check formatting without writing         |
| `npm test`             | Run the test suite once                  |
| `npm run test:watch`   | Run tests in watch mode                  |

## State management

- **Server state** (anything fetched from an API — currently Orders/Products) is owned by **TanStack Query**. A feature's `hooks/use*.ts` wraps `useQuery`, and the `QueryClient` (`src/app/queryClient.ts`) is provided once in `AppProviders`. Don't put fetched data in Redux.
- **Client/global state** (theme, sidebar-collapsed — read or written from more than one place, or persisted) lives in the **Redux** store (`src/app/store/store.ts`), one slice per concern. Use the typed `useAppDispatch`/`useAppSelector` from `src/app/store/hooks.ts`. Feature code doesn't call these directly — it goes through a small dedicated hook instead (`src/hooks/useTheme.ts`, `useSidebarCollapsed.ts`), which keeps the Redux dependency contained to one seam.
- **Local component state** (`useState`) is still the default for everything that's neither of the above — a form field, a dropdown's open/closed state, etc.

## Type safety

Every source file is TypeScript with `strict` mode on (see [`tsconfig.app.json`](tsconfig.app.json)). A feature that fetches data defines its shape as a **Zod schema** in `features/<name>/schemas/` and derives the TS type from it with `z.infer`, so the compile-time type and the runtime check can't drift apart — see [Mock data →](#mock-data) for how that's used end-to-end today, and how it validates a real API response once one exists.

## Styling

Every component is styled with **Tailwind utility classes** directly in `className` — there are no per-component `.css` files. [`src/styles/globals.css`](src/styles/globals.css) is the **only** CSS file in the project: it imports Tailwind and declares the brand palette under `@theme`.

Declaring the palette under `@theme` (rather than in a separate config file, Tailwind v4's default) does two things at once: it makes each token a real CSS custom property (`--color-accent`, etc.) **and** generates the matching utility class (`bg-accent`, `text-accent`, `border-accent`, ...). Because the generated utility compiles to `background-color: var(--color-accent)` rather than a literal hex value, re-theming for dark mode (see below) is just re-declaring those custom properties elsewhere — no `dark:` variant classes needed anywhere in the app.

## Color theme

The palette sourced from [polymeruk.com](https://polymeruk.com)'s storefront theme (sage-green accent, warm cream secondary, near-black text on white):

| Token                   | Light               | Tailwind utilities                        | Meaning                                                   |
| ----------------------- | ------------------- | ----------------------------------------- | --------------------------------------------------------- |
| `--color-accent`        | `#648c6e`           | `bg-accent` `text-accent` `border-accent` | Brand sage green — primary actions, links, active states  |
| `--color-accent-hover`  | `#4a5a4e`           | `bg-accent-hover` `text-accent-hover`     | Darker green for hover/pressed states                     |
| `--color-accent-tint`   | `#eef7ef`           | `bg-accent-tint` `text-accent-tint`       | Light green background for active/highlighted UI          |
| `--color-secondary`     | `#f2dec4`           | `bg-secondary`                            | Warm cream secondary accent (dividers, subtle highlights) |
| `--color-text`          | `#1a1a1a`           | `text-text`                               | Primary text                                              |
| `--color-text-muted`    | `#7c7c7c`           | `text-text-muted`                         | Secondary/muted text                                      |
| `--color-bg`            | `#ffffff`           | `bg-bg`                                   | Page background                                           |
| `--color-surface`       | `#fcfcfd`           | `bg-surface`                              | Card/surface background                                   |
| `--color-border`        | `#e5ebe5`           | `border-border`                           | Default border color                                      |
| `--color-warning`/`-bg` | `#b7791f`/`#fdf1de` | `text-warning` `bg-warning-bg`            | Warning tone (stat cards, badges)                         |
| `--color-danger`/`-bg`  | `#dc2626`/`#fbe4e4` | `text-danger` `bg-danger-bg`              | Danger/error tone                                         |

A dark-mode variant of the same palette is defined alongside it — see "Light/dark mode" below.

### Typeface

`--font-sans` leads with `'Neue Haas Unica Pro'`, falling back to the system font stack. **That font is commercially licensed and isn't bundled with this project** — the fallback stack is what actually renders today. If you have a licensed webfont file, self-host it with an `@font-face` rule in `src/styles/globals.css` and it'll be picked up automatically; don't load it from a public CDN (most aren't licensed to redistribute it).

### Light/dark mode

**Light is the default** — the app doesn't defer to the OS preference unless the user explicitly picks "System". The `ThemeToggle` (a Light/Dark/System segmented control, icon-based — no emoji) lives inside the AppBar's `UserMenu` dropdown, not as its own AppBar button:

- `src/app/store/uiSlice.ts` (Redux) holds the current choice and persists it to `localStorage`; `src/hooks/useTheme.ts` reads/writes it and sets `data-theme="light"`/`"dark"` on `<html>` (or removes it for `"system"`, deferring to the OS).
- `src/styles/globals.css` re-declares the `@theme` custom properties under `@media (prefers-color-scheme: dark)` and `:root[data-theme='dark']` — applying the dark palette either when the OS prefers dark (and there's no explicit `"light"` override) or when `[data-theme="dark"]` is set explicitly. No Tailwind `dark:` classes are used anywhere (see "Styling" above).
- A small inline script in `index.html` applies the stored (or default-light) choice before first paint, so there's no flash of the wrong theme on load.

### App shell

`DashboardLayout` renders a full-height `Navbar` on the left and an `AppBar` + page content column on the right:

- `src/app/router/navigation.ts` is the single list of top-level routes (path, label, icon) — both the Navbar's links and the AppBar's page-title heading read from it, so they can't drift apart.
- The Navbar collapses to icons-only via `src/hooks/useSidebarCollapsed.ts` (Redux-backed, persisted to `localStorage`, same pattern as `useTheme`).
- The Navbar's bottom section (avatar, name, email, log out) and the AppBar's `UserMenu` dropdown both read the same placeholder identity from `src/app/layouts/currentUser.ts` — see the `TODO` there for wiring up a real session once `features/auth` has one.

## Project structure

```
src/
├── main.tsx                 # entry point — renders <App />
├── vite-env.d.ts             # Vite client types + ImportMetaEnv typing
├── app/                      # app shell: composition root, not a feature
│   ├── App.tsx               # wires providers around the router
│   ├── providers/            # AppProviders.tsx — Redux + React Query providers
│   ├── store/                 # Redux: store.ts, uiSlice.ts, hooks.ts
│   ├── queryClient.ts          # the app's single QueryClient
│   ├── router/                  # route table + navigation.ts + NotFoundPage
│   └── layouts/                   # shared page chrome (header/nav/etc.)
├── features/                  # one directory per business feature
│   ├── auth/                   # login
│   ├── orders/, products/       # stat cards + a filterable table (mock data, see below)
│   │   ├── schemas/               # Zod schema — source of truth for this feature's types
│   │   ├── api/                    # mock*.ts — swap for a real fetch here later
│   │   ├── hooks/                    # use*.ts — TanStack Query, exposes {data, status, error}
│   │   └── pages/
│   ├── dashboard/, inventory/     # coming-soon placeholders for now
│   └── <feature>/pages/, index.ts  # the feature's public API
├── components/ui/             # generic, reusable UI primitives
│                               # (Button, Logo, StatCard, PageHeader, Table, Badge,
│                               #  ThemeToggle, icons, ...)
├── hooks/                     # generic shared hooks
├── lib/api/                   # Axios-backed HTTP client + typed API errors
├── lib/format.ts                # shared Intl currency/date formatters
├── config/                    # env var access
├── styles/globals.css         # the ONLY .css file — Tailwind import + @theme tokens
└── test/                      # setup.ts (jest-dom) + renderWithProviders.tsx
```

See [`src/features/README.md`](src/features/README.md) for the convention each feature follows, and [`CLAUDE.md`](CLAUDE.md) for the fuller architecture rationale and rules for extending it.

## Mock data

Orders and Products are wired up end-to-end against **mock data**, not a real backend yet:

- `features/orders/schemas/order.ts` and `features/products/schemas/product.ts` define a Zod schema for each shape; the `Order`/`Product` TS types are `z.infer`'d from those schemas, not hand-written separately.
- `features/orders/api/mockOrders.ts` and `features/products/api/mockProducts.ts` export a `get*()` function that resolves with an array after a short simulated delay — shaped like the fields this app will eventually sync from the client's Shopify store (order/fulfillment status, SKU, inventory, etc.), validated against the schema (`orderSchema.array().parse(...)`) before returning — see the `TODO` comments in those files.
- `features/orders/hooks/useOrders.ts` / `features/products/hooks/useProducts.ts` wrap that `get*()` function in **TanStack Query**'s `useQuery` and expose `{ orders/products, status, error }`, where `status` is `'loading' | 'success' | 'error'` (mapped from React Query's own `isPending`/`isError`) — so `OrdersPage`/`ProductsPage` render real loading/empty/error states, not just a happy path.
- **Swapping in the real thing** means changing what's inside `get*()` to call `apiClient` from `src/lib/api/client.ts` instead of returning mock data, and `.parse()` that response against the same schema — the hook and page don't need to change, since the return shape stays the same.

## Testing

- Co-locate tests next to the code they test: `Button.tsx` → `Button.test.tsx`.
- Use React Testing Library — query by role/label/text, not by implementation detail (class names, internal state).
- Anything that renders a component touching Redux, TanStack Query, or routing should use `src/test/renderWithProviders.tsx` instead of RTL's plain `render` — it wraps the tree in a fresh store/QueryClient/router per call.
- Run `npm test` before committing; `npm run test:watch` while developing.

## Architecture principles

1. **Feature isolation** — a feature's internals are only reachable through its `index.ts`.
2. **Separation of concerns** — UI (`pages`/`components`), business logic (`hooks`/`utils`), data access (`api`), and data shape (`schemas`) stay in separate files within a feature.
3. **One API boundary** — all HTTP calls go through `src/lib/api/client.ts` (Axios), never raw `axios`/`fetch` in components.
4. **Server state vs. client state** — TanStack Query owns fetched data; Redux owns client-side global state; everything else is local `useState`. Don't blur these.
5. **Promote code deliberately** — something only moves to `components/ui`, `hooks/`, or `lib/` once a second feature genuinely needs it, not preemptively.
