# Shared hooks

Generic hooks with no feature-specific knowledge (e.g. `useDebouncedValue`, `useMediaQuery`, `useLocalStorage`) belong here.

A hook that only makes sense for one feature (e.g. `useContactForm`) belongs inside that feature's own `hooks/` directory instead — don't promote it here until a second feature genuinely needs it.
