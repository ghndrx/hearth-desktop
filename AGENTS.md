# AGENTS.md — Hearth desktop (Tauri + SvelteKit)

## Stack
- SvelteKit + TypeScript frontend in `src/`
- Tauri 2 (Rust) shell in `src-tauri/`
- Tailwind for styling
- Default branch: `main`

## Commands
- Dev: `pnpm dev` (web) or `pnpm tauri:dev` (native shell)
- Build: `pnpm build` then `pnpm tauri:build`
- Typecheck: `pnpm check`
- Lint: `pnpm lint`
- Format: `pnpm format`
- Tests: none configured yet — if you add features with logic, add vitest tests

## Conventions
- Commit format: Conventional Commits.
- Branch from `main`, name `feat/<feature-id>`.
- Components in `src/lib/components/`, stores in `src/lib/stores/`.
- Tauri commands: Rust side in `src-tauri/src/commands/`, TS wrappers in `src/lib/tauri/`.
- Use `$app/stores` for SvelteKit state, not ad-hoc globals.

## Do not touch without explicit task
- `src-tauri/tauri.conf.json` — bundle identifiers, signing keys
- `src-tauri/icons/` — generated from a master asset
- `renovate.json` — dependency automation policy

## Security
- No secrets in source. Desktop has no backend-of-its-own — it talks to the Hearth server.
- Tauri allowlist in `src-tauri/capabilities/` must stay minimal; widening it is a security review.
- Validate all IPC payloads in Rust before acting on them.

## Hearth-specific
- Thin client over the Hearth server API; parity with the web frontend is the goal.
- For native-only features (tray, notifications, global shortcuts), prefer Tauri plugins over custom Rust.
