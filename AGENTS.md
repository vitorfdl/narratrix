# Narratrix

React + Tauri desktop app. Package manager: pnpm. Linter/formatter: Biome (see `biome.json`).

IMPORTANT: Run `pnpm biome check --fix` before committing. Do not skip this.

IMPORTANT: Never log, print, or embed API keys, tokens, or secrets. Tauri FS/security constraints apply — respect scoped permissions.

# Code Style

- Strict TypeScript. No `any`. Use `!` (non-null assertion) only when you can prove the value exists.
- Validate all external input (API responses, file reads, user input) with Zod schemas in `src/schema/`.
- Naming: `camelCase` variables/functions, `PascalCase` components/types, `UPPER_SNAKE_CASE` constants, `kebab-case` files.
- Imports order: std/react → third-party → internal `@/`. Prefer `import type` where possible.
- Line width 200 (configured in `biome.json`). Spaces, not tabs.

# React Patterns

- Functional components only. Hooks at the top level — never inside conditions or loops.
- Respect `exhaustive-deps`. If a dependency feels wrong, restructure the effect — don't suppress the warning.
- Heavy logic belongs in `services/` or custom hooks in `hooks/`, not in component bodies.
- Immutable state updates. Use Immer when the update shape is complex.
- State management: Zustand/Jotai stores in `hooks/`. No prop-drilling past two levels.
- Clean up effects: cancel pending requests, clear timers, unsubscribe listeners in `useEffect` cleanup.
- Debounce/throttle via `utils/`. No fire-and-forget promises — always `await` or handle the rejection.

# Error Handling

- Never swallow errors. Every `catch` must log, surface to the user (error toasts), or re-throw.
- Toasts are for errors and warnings only. Do not add success toasts — if the UI accepted the action (form closed, item appeared in list, etc.), that is sufficient feedback. If you find existing success toasts, remove them.
- Async services return typed results — bubble errors up, don't handle them silently at the service layer.
- Add React error boundaries around independently-failing UI regions.

# Architecture Decisions

- UI: `components/` and `pages/`. Business logic: `services/`. Helpers: `lib/utils.ts` and `utils/`. Schemas: `src/schema/`.
- Backend (Tauri): SQLite with migrations in `src-tauri/database/migrations/`. Inference engine in `src-tauri/inference/` supports multiple LLM providers.
- API keys are stored per profile. Never share keys across profiles.

# Domain Knowledge

Before working on a feature area you're unfamiliar with, check for relevant skill. These contain domain-specific context about app subsystems, conventions, and known gotchas that aren't obvious from the code alone. Read the matching skill before making changes.

# When Making Changes

- Read the relevant code before proposing changes. Don't guess at existing patterns.
- Match the style of surrounding code. If unsure, check a similar file first.
- Don't add abstractions, utilities, or refactors beyond what was asked. Three similar lines beat a premature abstraction.
- Keep changes small and focused. One concern per commit.
- If something looks wrong in the existing code, mention it — but fix only what was requested unless asked.

# Profile Restrictions
- Whenever you have to access database, ensure to always filter with current Profile ID.
- Double-check that you're not exposing data from other profiles

IMPORTANT: Run `pnpm biome check --fix` before committing. Verify the build passes.

IMPORTANT: Never log or expose secrets. API keys stay per-profile and never leave the encryption layer.
