AGENTS guide for Narratrix (React + Tauri)

## Code style (Biome + TS)
- Formatting: spaces, lineWidth 200 (biome.json). Run lint:fix before commits.
- Imports: std/react, third-party, then internal "@/"; keep side-effects isolated; prefer type-only imports when useful.
- Types: strict TS; avoid any; non-null (!) sparingly; validate external input with zod in src/schema.
- Naming: camelCase vars/functions; PascalCase components/types; UPPER_SNAKE_CASE constants; files kebab-case.
- React: functional components; hooks at top level; respect exhaustive-deps; heavy logic in services/hooks; immutable updates via Immer when needed.
- Errors: never swallow; try/catch async; bubble typed results from services; user-facing via toasts; add error boundaries where appropriate.
- Async/effects: await properly; cancel/cleanup in useEffect; debounce/throttle via utils; avoid fire-and-forget.
- Structure: UI in components/pages; business logic in services; helpers in lib/utils.ts and utils/; schemas in src/schema; state in hooks/ (Zustand/Jotai).
- Security: keep API keys per profile; follow Tauri FS/security constraints; avoid leaking secrets in logs.

## Core Application Structure

Package Manager: PNPM

### Frontend Architecture (`src/`)

- **Main Entry**: `App.tsx` handles profile authentication and theme
  initialization
- **Layout**: `components/layout/` contains `Sidebar.tsx` and `Content.tsx`
- **Pages**: Feature-specific pages in `pages/` (agents, characters, chat,
  models, etc.)
- **State Management**: Global stores in `hooks/` using Zustand pattern
- **Services**: Business logic in `services/` for API calls and data processing
- **Schemas**: Zod schemas in `schema/` for type validation

### Backend Architecture (`src-tauri/`)

- **Database**: SQLite with migrations in `database/migrations/`
- **Inference**: LLM integration in `inference/` supporting multiple providers
- **Filesystem**: File operations in `filesystem/`
- **Security**: Encryption utilities in `utils/`

## Notes
- Also follow: defensive programming (validation, null safety, resource cleanup), single-responsibility, reusable components, hook/service abstraction, and DI-friendly code. Keep PRs small; run pnpm and biome lint/tests before pushing.
