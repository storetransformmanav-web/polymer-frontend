# Features

Each subdirectory here is one self-contained feature (e.g. `auth`, `contacts`, `deals`). A feature owns everything specific to its domain:

```
features/<name>/
├── components/   # components used only within this feature
├── hooks/        # hooks used only within this feature (use*.ts wraps
                   # TanStack Query for anything that fetches data)
├── api/          # requests + response shaping for this feature's data,
                   # built on src/lib/api/client.ts
├── schemas/      # Zod schemas — the source of truth for this feature's
                   # types (derive them with z.infer, don't hand-write a
                   # duplicate interface)
├── pages/        # route-level components, wired up in app/router
├── utils/        # feature-local helper functions
└── index.ts      # the feature's public exports — the only thing
                   # other code is allowed to import
```

Only create the subdirectories a feature actually needs — `dashboard`, for example, currently only needs `pages/`.

## Rules

- **Import through `index.ts` only.** Other features and app code must not import a feature's internals directly (e.g. `features/contacts/components/ContactCard.tsx`). This keeps features swappable and prevents tangled cross-feature dependencies.
- **Features don't import each other's internals.** If two features need to share logic, either lift it to `src/lib`, `src/hooks`, or `src/components/ui`, or have one feature depend on the other's public `index.ts` export deliberately.
- **Feature-specific UI stays in the feature.** Only move a component to `src/components/ui` once it's genuinely generic and used by more than one feature.
