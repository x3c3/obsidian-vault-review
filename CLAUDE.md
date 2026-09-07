# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Obsidian plugin to randomly review vault notes and track progress.

The current next step for this repo is tracked in the workspace backlog at `../NEXT.md` (the `obsidian-review` row). Read it when starting work; update it when that step ships.

## Architecture

### Data Model

The plugin persists only the set of reviewed file paths plus excluded folders (via Obsidian's `loadData`/`saveData` into `data.json`). Both belong to `Review`, which is their single owner — the vault is the source of truth for what exists, so `Review.rename`/`remove` reconcile *both* stored sets against current vault state rather than maintaining an authoritative file list. The file-vs-folder distinction crosses that boundary as a boolean, so `instanceof TFolder` stays in `plugin.ts` and `Review` needs no Obsidian import.

`Review.setExcludedFolders` is the only way to write excluded folders. It trims, strips trailing slashes, drops empties, and dedupes — a folder stored unnormalized matches nothing, silently.

### Release Process

Use the `obsidian-release-gate` then `obsidian-release-ship` skills — do not tag by hand.

Never hand-create GitHub releases — the workflow attaches `main.js`, `manifest.json`, and `styles.css` to the tag.

## Gotchas

- `tsc --noEmit` reports errors for `obsidian`, `bun:test`, and `node:fs` modules — these resolve only inside the Obsidian/Bun runtime. CI passes because it installs all type packages. Local failures are expected.
- `bun run deploy` requires `OBSIDIAN_DEPLOY_DEST` to be set (path to the plugin folder inside a vault). See `.env.local.example`. Bun auto-loads `.env.local`. It runs `build` first, so it will not copy a stale `main.js` — and it refuses to deploy at all when `check` fails, formatting drift included. Use `bun run dev` for a tight edit loop.
- If issue descriptions (line numbers, function names, code structure) don't match the current codebase, stop and flag the discrepancy before proceeding with a fix.

## Testing

`Review` lives in `src/review.ts` and the persisted-shape helpers in `src/data.ts`, both free of Obsidian APIs, and both are tested directly (`src/review.test.ts`, `src/data.test.ts`; clock and rng are injectable). Keep those two modules import-free — there is no Obsidian mock, and adding one would mean the boundary has leaked. Plugin integration (Obsidian API calls) is not unit-tested.
