# design-sync notes — EditUp.dev (editor UI)

- Repo is an app, not a packaged DS: no `dist/`, no barrel. The bundle entry is the hand-written `.design-sync/ds-entry.tsx` (wired via `cfg.entry`). **When a new editor component is added to `src/components/`, add its re-export to `ds-entry.tsx` AND pin it in `cfg.componentSrcMap`.**
- `HistoryPanel` is deliberately excluded (`componentSrcMap: null`): it imports `@tauri-apps/api` at module level and would break browser previews. Re-evaluate only with a mock strategy.
- All components assume the app's dark shell. Every authored preview wraps cells in a `background: var(--color-bg); color: var(--color-fg)` frame — without it, cells screenshot as light-on-white and grade unreadable. Keep the frame in any new preview.
- `ApprovalToast` is `position: fixed`; previews scope it with a `transform: translateZ(0)` wrapper. Card uses `cardMode: single` (primaryStory WithSideEffects) because fixed positioning escapes grid cells.
- `cardMode: column` overrides applied to AIInput, ApplyBar, ElementIdentity, StateSelector, UpdateBanner (wide, full-row bars) after `[GRID_OVERFLOW]` warns.
- Render check: repo's own playwright (1.59.1) pins chromium 1217, present in the local `%LOCALAPPDATA%\ms-playwright` cache — no install was needed.
- pnpm 9 via corepack worked with plain `pnpm i --frozen-lockfile` at repo root.
- Docs: 0/22 matched (repo has no per-component docs) — all `.prompt.md` are synthesized from `.d.ts` + previews. Fine; revisit if a docs/ tree appears.
- Known render warns: none recorded — final validate was 22/22 clean (the 3 early `[RENDER_BLANK]` were pre-authoring floor states, fixed by authored previews).

## Re-sync risks

- `ds-entry.tsx` and `componentSrcMap` are parallel lists — a component added to one but not the other either drops from the bundle or fails the build. Check both.
- Preview props inline realistic `EditPlan` / `LicenseHook` / `UpdaterHook` objects. If those types change in `src/types/` or hooks, the previews still compile as stale shapes may fail — recapture will surface it, but expect `.tsx` fixes.
- `SetupScreen`/`LicenseGate` previews depend on `.setup-*` classes in `src/styles.css`; a styles.css refactor (e.g. moving to CSS modules) changes the whole styling scrape (`cfg.cssEntry`).
- The app has no fonts shipped (system stacks only) — if Geist is ever bundled into the app UI, wire it via `cfg.extraFonts`.
- Landing page (`landing/`) was explicitly scoped OUT of this project; syncing it later should target a separate Claude Design project.
