# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Obsidian plugin to randomly review vault notes and track progress.

The current next step for this repo is tracked in the workspace backlog at `../NEXT.md` (the `obsidian-review` row). Read it when starting work; update it when that step ships.

## Architecture

### Data Model

The plugin persists only the set of reviewed file paths plus excluded folders (via Obsidian's `loadData`/`saveData` into `data.json`). The vault itself is the source of truth for which files exist — so `ReviewState.renameFolder`/`renameFile` (rename) and `deleteFolder`/`deleteFile` (delete) reconcile the stored set against current vault state rather than maintaining an authoritative file list.

### Release Process

Use the `obsidian-release-gate` then `obsidian-release-ship` skills — do not tag by hand.

Never hand-create GitHub releases — the workflow attaches `main.js`, `manifest.json`, and `styles.css` to the tag.

## Gotchas

- `tsc --noEmit` reports errors for `obsidian`, `bun:test`, and `node:fs` modules — these resolve only inside the Obsidian/Bun runtime. CI passes because it installs all type packages. Local failures are expected.
- `bun run deploy` requires `OBSIDIAN_DEPLOY_DEST` to be set (path to the plugin folder inside a vault). See `.env.local.example`. Bun auto-loads `.env.local`.
- If issue descriptions (line numbers, function names, code structure) don't match the current codebase, stop and flag the discrepancy before proceeding with a fix.

## Testing

`ReviewState` and `isExcluded` live in `src/reviewState.ts`, free of Obsidian APIs, and are tested directly in `src/reviewState.test.ts` (clock and rng are injectable). Plugin integration (Obsidian API calls) is not unit-tested — the `__mocks__/` stubs only cover what the tests need.
