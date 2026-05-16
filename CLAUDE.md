# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

Tauri v2 desktop app (Windows/Linux). Frontend: React 18 + TypeScript + Mantine v7 + React Router v7. Backend: Rust. Package manager: Bun.

## Commands

```bash
# Dev (frontend + Tauri backend together)
bun run tauri dev

# Frontend only (no Tauri backend; Tauri APIs will fail)
bun run dev

# Build
bun run tauri build

# Lint + format (runs via lint-staged on commit)
bunx eslint .
bunx prettier --write .

# Rust backend only
cd src-tauri && cargo build
cargo clippy
cargo check
```

Debug flags for `tauri dev`:
- `--debug-randomiser` — enables debug output in the randomiser
- `--log-file <path>` — write logs to a file

## Architecture

### Frontend → Backend communication

All Tauri commands are invoked via typed wrappers in `src/core/api/`:
- `fileRandomiserApi.ts` — file randomiser commands
- `fileSorterApi.ts` — file sorter commands
- `appSettingsApi.ts` — settings commands
- `presetsApi.ts` — preset CRUD

These call `invoke("command_name", { args })`. The Rust command handlers live in:
- `src-tauri/src/filerandomisercommands.rs`
- `src-tauri/src/filesortercommands.rs`
- `src-tauri/src/setting_commands.rs`

All commands are registered in `src-tauri/src/lib.rs`.

### Frontend state

File Randomiser has a React Context (`FileRandomiserProvider` in `src/core/hooks/fileRandomiserStateProvider.tsx`) that wraps the whole app and holds all runtime state: loaded files, presets, current index, shuffle mode, tracking, crawl status, etc.

Settings are loaded via `useAppSettings` hook (`src/core/hooks/useAppSettings.tsx`), which reads from the Tauri store plugin.

### Shared types

`src/types/` mirrors the Rust model structs:
- `common.ts` — `FileEntryBase`, `Bookmark`
- `filerandomiser.ts` — `AppStateData`, `FileEntry`, `FilterRule`, `RandomiserPreset`, etc.
- `filesorter.ts` — sorter-specific types
- `settings.ts` — `AppSettings`

Rust models are in `src-tauri/src/models/` with the same split. Serde uses `rename_all = "camelCase"` throughout, so field names match between layers.

### Routing

Routes are defined in `src/core/app/App.tsx`:
- `/` — Main page (tool picker)
- `/FileRandomiser` — File Randomiser tool
- `/FileRandomiserSettings` — Randomiser-specific settings
- `/FileSorter` — File Sorter tool
- `/Settings` — Global app settings

### Translations

i18next with locales in `src/core/translations/locales/` (en, nl, bs, de, pl). Language defaults from `sys_locale` on the Rust side and from `navigator.language` on the frontend. All UI strings should use `useTranslation()`.

### Windows-only features

Process tracking (auto-advance when a file closes) uses Windows APIs via the `windows` crate. Guarded at runtime by OS checks — do not add Windows-only Rust code outside of `#[cfg(windows)]` blocks or runtime OS detection.

### Settings persistence

Settings are stored via `tauri-plugin-store` (JSON file managed by Tauri). Presets are stored as individual JSON files in the app data directory. Access via `setting_commands.rs`.
