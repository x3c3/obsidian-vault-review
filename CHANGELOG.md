# Changelog

## 2.2.0

### Fixed

- Review commands now distinguish "nothing eligible to review" from "nothing left to review" (#102)
- The "Status bar" setting now actually hides the status bar. It toggled Obsidian's `is-hidden` class, whose rules are scoped to ribbon and stacked-tab elements and so styled nothing on a status-bar item.
- Modals override `onClose` instead of shadowing it, so Obsidian's own cleanup still runs (#103)
- Persisted data is validated before it becomes live state, and unreadable saved data is never overwritten (#94, #96)
- Only mutations that were actually persisted are committed to in-memory state (#97)
- `bun run deploy` builds before copying to the vault, so a stale `main.js` can no longer be deployed (#105)
- The build reports failures instead of dying on them (#93)
- `version-bump.ts` fails loudly when `manifest.json` has no `minAppVersion` (#104)

### Changed

- All persisted review state consolidated under a single owner: `ReviewState` becomes `Review` (`src/review.ts`), with the persisted-shape helpers split into `src/data.ts` (#101)
- Folder autocomplete uses `AbstractInputSuggest`'s own `onSelect` (#100)
- Removed the v1 schema migration (#99). Data written by a pre-2.0.0 version now falls back to the default for "show status bar" instead of carrying the old nested setting forward; reviewed paths and excluded folders are unaffected.
- Deleted dead and duplicated code, including the hand-rolled Obsidian mock (#98)
- Update dependencies (typescript 7.0.2, biome 2.5.12, @types/node 26.5.0, @types/bun 1.4.1)

## 2.1.0

### Fixed

- Declare `minAppVersion` 1.6.0 to match actual Obsidian API usage (#60)
- Surface async failures from UI handlers via Notice instead of swallowing them (#68)
- Handle loadData/saveData failures; act on the schema version with a downgrade guard (#61, #64)
- "Add excluded folder" no longer persists an empty entry; empty rows are pruned when settings close (#56)

### Changed

- Settings tab: remove redundant "Not reviewed" stats line, tighten layout (#51)
- Split `main.ts` into focused modules; extract testable `ReviewState` class (#59, #70)
- Update dependencies (obsidian 1.13.1, biome 2.5, typescript 6.0.3)

## 2.0.1

### Fixed

- Replace stale `.in-snapshot` CSS class with `.review-stats`
- Update `actions/checkout` to v6 in Claude workflows

### Changed

- CI workflow updates
- Remove `validate-plugin` script
- Bump `@types/node` to 25.5.2
- Update dependencies

## 2.0.0

**Breaking:** Review data model redesigned. Old snapshot data is discarded on upgrade.

- Replace snapshot model with reviewed-paths set — vault is now the source of truth for file existence
- Two states: reviewed or not reviewed (no more snapshot management)
- Add excluded folders setting with folder autocomplete
- Fix status bar click listener leak — use `registerDomEvent` for automatic cleanup (#37)
- Fix status bar menu not updating file review status correctly (#34)
- Fix deleted files accumulating in snapshot data forever (#35)
- Fix linear scan for every file lookup — `Set` gives O(1) (#36)
- Fix negative "not in snapshot" count (#33)
- Fix `bun run dev` not watching for changes — use `bun --watch` (#38)
- Fix TypeScript 6 compatibility — add `node` and `bun` types to tsconfig
- Add `FolderSuggest` autocomplete component for excluded folder inputs
- Update dev dependencies (biome, @types/bun, typescript)

## 1.2.0

- Restrict release workflow tag filter to version tags only (#4)
- Mark missing files as deleted instead of removing from snapshot (#6)
- Handle folder rename by updating child file paths in snapshot (#8)
- Add schemaVersion field to settings for future migrations (#15)
- Enable linked source maps for development builds (#19)
- Extract rewritePaths as testable pure function with tests
- Refactor: simplify types, naming, and code structure throughout

## 1.1.0

- Add repository settings configuration
- Fix deleteSnapshot promise double-resolve guard
- Include styles.css in deploy script
- Normalize CI workflow whitespace and manifest.json field order
- Update LICENSE to MIT with current copyright
- Update @biomejs/biome and @types/node

## 1.0.0

Initial release. Randomly review your vault and track progress.
