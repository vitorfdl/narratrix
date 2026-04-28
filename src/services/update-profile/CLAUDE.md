# Profile Data Migrations

Per-profile *data* migrations layered on top of the SQLite *schema* migrations in `src-tauri/database/migrations/`. Schema migrations run on DB open; these run on profile login and reshape profile-owned data (seed bundled templates, move localStorage values into the profile row, etc.).

Entry: `runProfileMigrations(profileId)` in `index.ts`, called from `ProfileStore.tsx` right after `loginProfile`/`getProfileById` and before `currentProfile` is set.

## Model

- Each profile row carries a numeric `version` (`schema/profiles-schema.ts`, defaults to 0).
- `index.ts` holds a `migrations` map keyed by target version. Versions strictly greater than the profile's current version run in ascending order.
- Each step is `(profile) => Promise<ProfileResponse>`. After it resolves, `index.ts` writes the returned profile back via `updateProfile` with `version` bumped to that step's key, then feeds the persisted result into the next step.
- Steps are **not idempotent** — gating is purely the version number, so seeding migrations (v11, v12) duplicate rows if rerun against the same profile. Don't manually roll a profile's `version` back.

## Failure handling

Per-item `try/catch` inside a step logs and continues; the step still resolves. A thrown error from a step (or the `updateProfile` write) aborts the loop — earlier steps stay persisted, the failing version is not recorded, so it retries on next login. The caller in `ProfileStore.tsx` toasts and proceeds with the un-migrated profile.

## Adding a migration

New file `version_N.ts` exporting an async migrator, registered in the `migrations` map in `index.ts`. Bundled seed data goes in `data/` (JSON modules).
