# CLAUDE.md

Guidance for AI coding agents working in this repository. Read this before adding or moving files.

## What this app is

Polymer CRM surfaces a client's Shopify orders and products (and eventually inventory) in one place. **Shopify sync is a backend concern** — this frontend must never call Shopify's Admin API directly (that needs credentials that don't belong in a browser). It calls our own backend through `src/lib/api/client.ts` (Axios), which syncs with Shopify. Orders and Products currently run on mock data (`features/*/api/mock*.ts`) shaped like the eventual sync payload — see "Mock data" below.

## Stack (do not change without a strong reason)

- **React 19, Vite 8, TypeScript** (`strict: true`) — every source file is `.ts`/`.tsx`. Don't add a new `.js`/`.jsx` file.
- Package manager: **npm** (`package-lock.json` is committed — don't switch to yarn/pnpm).
- **Styling: Tailwind CSS v4** (`@tailwindcss/vite`), utility classes directly in JSX. **No per-component `.css` files and no hand-written CSS** — the only CSS file in the project is `src/styles/globals.css` (the `@import 'tailwindcss'`, the `@theme` token block, and the dark-mode variable overrides). See "Styling" below.
- Linting: **Oxlint** (`.oxlintrc.json`, with the `typescript` plugin enabled) — not ESLint.
- Formatting: **Prettier** (`.prettierrc.json`, with `prettier-plugin-tailwindcss` — it sorts class lists on format, don't hand-order them).
- Routing: **react-router-dom** (`createBrowserRouter`).
- **Server state: TanStack Query** (`@tanstack/react-query`) — every feature's `hooks/use*.ts` that fetches data wraps `useQuery`/`useMutation`, not a hand-rolled `useEffect`+`useState` fetch. The `QueryClient` lives in `src/app/queryClient.ts` and is provided in `AppProviders`.
- **Client/global state: Redux Toolkit** (`@reduxjs/toolkit` + `react-redux`) — the store is `src/app/store/store.ts`, with one slice per concern (currently just `ui`, for theme + sidebar-collapsed). Use the typed hooks in `src/app/store/hooks.ts` (`useAppDispatch`/`useAppSelector`), never the plain `react-redux` ones.
- **HTTP: Axios**, wrapped by `src/lib/api/client.ts` (`apiClient`). Never call `axios`/`fetch` directly from a feature.
- **Runtime validation: Zod** — a feature that fetches data defines a schema in `features/<name>/schemas/`, derives its TS types from that schema (`z.infer`), and validates network responses against it at the API boundary. See "Mock data" below.
- Testing: **Vitest** + **React Testing Library**, jsdom environment.

## Architecture: feature-based

```
src/
├── main.tsx               # entry point only — no logic here
├── vite-env.d.ts            # Vite client types + ImportMetaEnv typing
├── app/                     # composition root, not a feature
│   ├── App.tsx              # AppProviders > AppRouter, nothing else
│   ├── providers/            # AppProviders.tsx — Redux + React Query providers
│   ├── store/                 # Redux: store.ts, uiSlice.ts, hooks.ts (typed dispatch/selector)
│   ├── queryClient.ts           # the app's single QueryClient
│   ├── router/                   # route table (AppRouter.tsx) + navigation.ts + NotFoundPage
│   └── layouts/                    # shared page chrome, rendered via <Outlet/>
├── features/<name>/          # one directory per business domain
│   ├── components/            # feature-only components
│   ├── hooks/                  # feature-only hooks — use*.ts wrapping useQuery/useMutation
│   ├── api/                     # this feature's requests, built on lib/api/client.ts
│   ├── schemas/                  # Zod schemas — the source of truth for this feature's types
│   ├── pages/                     # route-level components
│   ├── utils/                      # feature-local helpers
│   └── index.ts                     # PUBLIC EXPORTS — the only import surface
├── components/ui/            # generic reusable primitives (Button, Logo, StatCard,
│                              # PageHeader, Table, Badge, ThemeToggle, icons.tsx, ...)
├── hooks/                     # generic shared hooks (used by 2+ features)
├── lib/api/                    # apiClient (Axios wrapper) + ApiError
├── lib/format.ts                 # shared Intl currency/date formatters
├── config/env.ts                   # the only place import.meta.env is read
├── assets/                          # static files (logo, ...) imported by components
├── styles/globals.css                # the ONLY .css file — @theme tokens + dark-mode overrides
└── test/                              # setup.ts (jest-dom) + renderWithProviders.tsx
```

`app/router/navigation.ts` is the single list of top-level routes (path, label, icon). Both `Navbar` (links) and `AppBar` (page-title heading) read from it — add a route there, not in each component separately.

### Styling

Every component is styled with **Tailwind utility classes in `className`** — no `ComponentName.css` files, no `styled-components`, no CSS modules.

- The brand palette lives in `src/styles/globals.css` under `@theme` (`--color-accent`, `--color-text`, `--color-border`, ...). Because `@theme` declares real CSS custom properties, every Tailwind utility it generates (`bg-accent`, `text-text-muted`, `border-border`, `font-sans`, ...) compiles to `background-color: var(--color-accent)` etc — **not** a literal hex value.
- Dark mode is **not** done with Tailwind's `dark:` variant. It's done by re-declaring those same custom properties under `@media (prefers-color-scheme: dark)` and `:root[data-theme='dark']` in `globals.css` (see `src/app/store/uiSlice.ts` for how `[data-theme]` gets set). Since every color utility already resolves through `var(--color-*)`, this re-themes the whole app automatically — **don't add `dark:` variant classes anywhere**, they're redundant and will drift from the real mechanism.
- When a warning/danger/etc. tone needs a color Tailwind doesn't ship a semantic token for (e.g. a tinted background), add it to `@theme` in `globals.css` (see `--color-warning-bg`, `--color-danger-bg`) rather than hand-picking a Tailwind palette color that won't adapt for dark mode.
- For layout constants that matter exactly (sidebar width, header height), use Tailwind's arbitrary value syntax (`w-[232px]`) rather than the nearest scale step.
- A component's own file is `.tsx` only — if two or more class names always travel together, extract a local `const` (e.g. `FILTER_LABEL = '...'` in `OrdersPage.tsx`) rather than reaching for a CSS class.
- Run `npm run format` after editing className strings — `prettier-plugin-tailwindcss` sorts them into Tailwind's canonical order; don't hand-order them.

### Import extensions

`tsconfig.app.json`/`tsconfig.node.json` use `moduleResolution: "bundler"` with `allowImportingTsExtensions: true`. **Import with the real extension** (`'./Foo.tsx'`, `'./bar.ts'`), not a `.js` placeholder — that convention is for Node's `nodenext` resolution, which this project doesn't use.

## Where things go

- **New page/route** → `features/<name>/pages/`, then export it from `features/<name>/index.ts`, then add a route entry in `app/router/AppRouter.tsx` pointing at that export.
- **New feature** → create `features/<name>/` with only the subdirectories it needs (a simple feature might only need `pages/` and `index.ts` — don't scaffold empty `schemas/`/`utils/` folders in advance).
- **Data fetch** → define the shape in `features/<name>/schemas/` (Zod schema + `z.infer` type), add a function in `features/<name>/api/` that calls `apiClient` and validates the response against that schema, then a `hooks/use*.ts` that wraps it in `useQuery` (or `useMutation` for writes). Never call `apiClient`/Axios/`fetch` directly from a component. (Orders/Products currently have a `mock*.ts` in `api/` instead of a real backend call — see "Mock data" below for how to graduate one to real.)
- **New backend-facing error handling** → throw/catch `ApiError` (`src/lib/api/ApiError.ts`); check `.status`/`.data`, don't re-parse Axios errors in feature code.
- **Reusable UI with zero feature knowledge** (Button, Modal, Input, Card) → `components/ui/`. If it references a specific feature's data shape, it isn't generic — keep it in the feature.
- **Reusable hook with zero feature knowledge**, used by 2+ features → `hooks/`. Otherwise keep it inside the feature that uses it.
- **Env var** → add it to `.env.example`, declare it on `ImportMetaEnv` in `src/vite-env.d.ts`, and read it through `src/config/env.ts`. Never call `import.meta.env` from anywhere else.
- **Global client state** (something read/written from 2+ unrelated components, needs to persist, or both) → a new slice under `src/app/store/`, registered in `store.ts`'s `reducer` map. Expose it to the app through a small hook in `src/hooks/` (see `useTheme.ts`/`useSidebarCollapsed.ts`) rather than having components call `useAppSelector`/`useAppDispatch` directly everywhere — that hook is the seam if the underlying state mechanism ever changes.
- **Server state** (anything fetched from an API) → TanStack Query via a feature's `hooks/use*.ts`, not Redux. Redux is for client-owned state only.
- **New top-level route** → add it to `src/app/router/navigation.ts` (path, label, icon), then wire the route in `AppRouter.tsx`. Don't add nav links directly in `Navbar.tsx`.
- **Icon** → `src/components/ui/icons.tsx` has a small hand-written set (no icon library is installed). Add new ones there in the same stroke style rather than pulling in a dependency for one glyph. **Never use emoji as icons** — always an SVG from this file.

## Backend API (auth)

- **All real backend endpoints live in one file: `src/lib/api/endpoints.ts`** — path (`ENDPOINTS`), Zod response schema, and request function (`api.auth.requestOtp`, ...). Add new endpoints there. Its schemas live in that file (not in `features/*/schemas/`) so `lib/` never imports from a feature. Orders/Products still use their `mock*.ts` until they're moved over.
- **Auth is passwordless (email OTP) and runs on Redux Toolkit**: `src/app/store/authSlice.ts` holds the login-flow state (`step`, `email`, statuses, `error`) and the persisted `session`; `requestOtp`/`verifyOtp` are `createAsyncThunk`s that call `api.auth.*`. Components use `features/auth/hooks/useLogin.ts` (flow) and `hooks/useAuth.ts` (session/logout), never the slice directly. This is a deliberate exception to "server state → TanStack Query": a login flow is client-owned state, not a cached resource.
- **Google sign-in** (`POST /auth/google`) sends the Google ID token; `features/auth/utils/googleIdentity.ts` loads Google's GIS script (no npm package) and `GoogleSignIn.tsx` renders Google's own button. It needs `VITE_GOOGLE_CLIENT_ID`; when empty, production hides the Google option and development shows a disabled placeholder with setup instructions. The thunk is `googleSignIn` in `authSlice.ts`.
- **Products** (`GET /products`) is real-API and lives in Redux: `src/app/store/productsSlice.ts` holds the filters, a per-query page cache (stale-while-revalidate, 30s), the previous results shown while the next query loads, accumulated filter options, recently-opened products and the open product. `features/products/hooks/useProducts.ts` is the only consumer; `DashboardLayout` calls `usePrefetchProducts()` so the list is cached before the page opens, and the next page is prefetched so paging is instant. This is a deliberate exception to "server state → TanStack Query" (Orders still use TanStack Query + mock data). The cache is cleared on logout/expired session.
- **Product details** (`GET /products/{id}`, UUID or Shopify ID — not the handle) render in the _same page_ at `/products/:id` (route `products/*` → `ProductsPage`), never in a slide-over. Opening is only via the View button/card. The page keeps a strip of open-product **tabs** (`tabs` in `productsSlice`). Details are cached in the slice (`details`); hovering View prefetches them, and the header draws from the already-loaded list row (`preview`) while the rest loads. The large Shopify `raw_json` is requested only when the "Raw data" tab opens (`include_raw=true`, cached separately). Product description HTML is only ever shown as plain text (`htmlToText`) and links go through `safeUrl`.
- The API has no endpoint listing vendors/types/tags, so those dropdowns fill from products seen so far (`facets`); a backend facets endpoint would make them exact.
- **Routes**: everything under `DashboardLayout` is behind `ProtectedRoute`; a 401 on an authenticated request clears the session (`setUnauthorizedHandler` in `lib/api/client.ts`) and the guard redirects to `/login`. Below 768px the sidebar always renders as its icon rail.
- Error messages shown to users come from the backend: `lib/api/client.ts` turns a failed response into an `ApiError` whose `message` is the first field error (422) or the body's `message`, with a friendly fallback for network failures/timeouts.
- The backend rejects browser CORS from localhost, so dev/preview proxy `/api` to `https://polymeruk-api.vercel.app` (see `vite.config.ts`). A production host must route `/api` the same way, or set `VITE_API_BASE_URL` to the full URL and have the backend allow that origin.
- Not done yet: showing the real signed-in user (`currentUser.ts` is still a placeholder) and `GET /auth/me`.

## Rules

1. **Import features only through their `index.ts`.** Never `import { X } from '../../features/other/components/X.tsx'`. If it's not exported from `index.ts`, it's private to that feature.
2. **Features don't reach into each other's internals**, and avoid feature-to-feature dependencies where practical — prefer lifting shared code to `lib/`, `hooks/`, or `components/ui/`.
3. **No raw Axios/`fetch` in components or pages.** Go through a feature's `api/` module, which goes through `apiClient`.
4. **Don't add a dependency without checking this file and `package.json` first** for something that already solves the problem. The state/data/HTTP/validation/styling stack (Redux Toolkit, TanStack Query, Axios, Zod, Tailwind) is deliberately chosen — don't add a second competing library for any of those roles (no RTK Query _and_ a hand-rolled fetch hook; no a second HTTP client; no a second schema/validation library; no CSS-in-JS or CSS Modules alongside Tailwind).
5. **Server state goes through TanStack Query; client state goes through Redux.** Don't put fetched data in a Redux slice, and don't reach for `useState`/prop-drilling for something two+ unrelated components need — add a slice instead. Local component state is still the default for anything that's neither.
6. **Don't create empty placeholder directories** "for later." Add a subdirectory when the first file that belongs in it exists.
7. **Keep `App.tsx`, `main.tsx`, and `AppRouter.tsx` thin.** They wire things together; they don't contain business logic, data fetching, or complex JSX.
8. **Secrets never get committed.** Anything sensitive goes in `.env.local` (git-ignored), not `.env.example`, and never hardcoded.
9. **Type safety is not optional.** `strict` mode is on; don't add `any` or `@ts-expect-error`/`@ts-ignore` to route around a type error — fix the type. A feature's types come from its Zod schema (`z.infer`), not a hand-written `interface` duplicating it.

## Mock data

`features/orders/` and `features/products/` follow this pattern for data that doesn't have a real backend yet:

- `schemas/*.ts` defines a Zod schema for the shape (e.g. `orderSchema`) and derives the TS type from it (`export type Order = z.infer<typeof orderSchema>`) — the schema is the source of truth, the type is generated from it, not maintained separately.
- `api/mock*.ts` exports a `get*()` function returning a `Promise` that resolves with an array after a simulated delay (real loading states, no real network call), validated against the schema (`orderSchema.array().parse(...)`).
- `hooks/use*.ts` wraps that in TanStack Query's `useQuery` and normalizes its status to `{ data, status: 'loading' | 'success' | 'error', error }` (React Query's own status is `'pending' | 'success' | 'error'` — mapped so pages don't need to know that).
- The page renders all three states via `components/ui/Table`'s `TableState` row, not just the happy path.

**To connect a real backend**, change only what's inside `get*()` — call `apiClient` from `src/lib/api/client.ts` instead of returning mock data, `.parse()` that response against the same schema, and delete the `TODO` comment above it. The hook and page don't need to change. Follow the same `schemas/` + `api/` + `hooks/` shape for any new feature that fetches data — don't invent a different pattern per feature.

## Commands

```bash
npm run dev           # dev server
npm run build          # typecheck (tsc -b) + production build
npm run typecheck       # tsc -b only, no build output
npm run lint              # Oxlint
npm run format             # Prettier — write
npm run format:check        # Prettier — check only, no writes
npm test                     # Vitest, single run
npm run test:watch            # Vitest, watch mode
```

Run `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, and `npm run build` before considering a change complete — all five should pass.

## Testing conventions

- Co-locate: `Foo.tsx` → `Foo.test.tsx`, in the same directory.
- Use React Testing Library queries by role/label/text (`getByRole`, `getByLabelText`) — avoid querying by class name or test-only attributes unless nothing else identifies the element.
- Anything that renders a component touching Redux, TanStack Query, or routing needs `src/test/renderWithProviders.tsx` instead of RTL's plain `render` — it wraps the tree in a **fresh** Redux store and QueryClient per call (not the app's singletons), so tests don't need to manually reset shared state between runs, plus a `MemoryRouter`.
- `vitest.config`'s `test` block lives in `vite.config.ts`; `src/test/setup.ts` registers jest-dom matchers. `globals: true` is set, so `describe`/`it`/`expect` are available without importing them (this repo's tests import them explicitly for clarity — either style works).

## Common mistakes to avoid

- Putting a feature-specific component in `components/ui/` because it "might be reused later." Wait until it actually is.
- Importing `features/x/pages/SomePage.tsx` directly from another feature or from `app/router` instead of importing it from `features/x/index.ts`.
- Calling `axios`/`fetch` directly instead of extending `lib/api/client.ts`.
- Fetching data with `useEffect` + `useState` instead of TanStack Query, or putting server data in a Redux slice instead of a query cache.
- Reaching for a second global-state approach (Context-for-everything, a new store library) instead of adding a Redux slice.
- Hand-writing a type that duplicates a Zod schema's shape instead of deriving it with `z.infer`.
- Reading `import.meta.env.VITE_*` outside `src/config/env.ts`.
- Adding a second formatter/linter (e.g. ESLint) alongside the existing Prettier/Oxlint setup.
- Adding an icon library or a new global font import — the icon set is hand-rolled in `components/ui/icons.tsx`, and `'Neue Haas Unica Pro'` (commercially licensed, not bundled) is the intended typeface; self-host a licensed webfont file rather than pulling one from a public CDN.
- Adding a `.js`/`.jsx` file, or importing with a `.js` extension that actually points at a `.ts`/`.tsx` file.
- Creating a new `ComponentName.css` file, or writing a `dark:` variant class — see "Styling" above for why neither is needed.
