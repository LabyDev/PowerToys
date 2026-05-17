<p align="center">
  <img src="./public/powertoys.svg" alt="Laby's PowerToys Logo" height="120" />
</p>

<h1 align="center">Laby's PowerToys</h1>

<p align="center">
  A personal collection of file management utilities built with Tauri.<br/>
  Originally Python tools from nearly a decade ago, now a proper desktop app.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20Linux-blue" alt="Platform" />
  <img src="https://img.shields.io/badge/license-LSAPL%20v1.0-lightgrey" alt="License" />
  <a href="https://www.buymeacoffee.com/aperturecoffee">
    <img src="https://img.shields.io/badge/Buy%20Me%20A%20Coffee-support-yellow" alt="Buy Me A Coffee" />
  </a>
</p>

---

## Tools

| Tool | Purpose |
|------|---------|
| [File Randomiser](#file-randomiser) | Pick files at random or sequentially with filters, bookmarks, and presets |
| [File Sorter](#file-sorter) | Group files into folders by name similarity. Preview before committing |
| [File Auditor](#file-auditor) | Keyboard-driven file review: keep, delete, or bookmark at speed |

---

## File Randomiser

**Break out of routine.** Load one or more folders, apply filter rules, and let the randomiser pick your next file. Or step through sequentially. Bookmarks, weighted picks, and presets make it as simple or as granular as you want.

<!-- Screenshot: File Randomiser main view (file tree, toolbar, filters panel) -->

### Workflow

> **Add paths -> Crawl -> Filter -> Pick**

The file tree shows all indexed files with included/excluded counts. Paths can be added individually or as a batch.

### Toolbar

| Action | Description |
|--------|-------------|
| Add path | Select one or more folders |
| Crawl | Index all files under the added paths |
| Next | Step to the next file (sequential mode) |
| Random | Pick a random file |
| Shuffle | Toggle shuffle / sequential mode |
| Tracking | Auto-advance when the current file closes (Windows only) |
| Search | Search across paths, files, and history |

### Filtering

The **Filters & Exclusions** panel supports rule-based filtering. Rules are evaluated in order and can be rearranged by drag.

| Rule type | Description |
|-----------|-------------|
| Contains | Filename contains a string |
| Starts with | Filename starts with a string |
| Ends with | Filename ends with a string |
| Regex | Full regex match |
| Bookmark | Match by bookmark color / scope |

Each rule can **include or exclude**, and toggle **case sensitivity**. If no include rules exist, all files are included unless excluded.

### Bookmarks

Files can be color-marked with four colors: **Red**, **Green**, **Gold**, **Blue**.

- Click the bookmark icon to cycle colors
- <kbd>Shift</kbd>+click to set as a **global bookmark** (persists across presets)
- Preset bookmarks are local to the active preset
- Bookmarking a **folder** applies the color to all files inside it. Requires a second click to confirm as it is a destructive bulk action

Bookmarks can be referenced directly in filter rules using the `@bookmarks` syntax.

> **Advanced:** Global bookmarks are stored in `%APPDATA%\eu.laby.powertoys\store.json` and can be edited manually if needed.

<details>
<summary>Bookmark filter syntax</summary>

```
@bookmarks[:global|:nonglobal][:color1,color2,...]
```

| Option | Effect |
|--------|--------|
| `@bookmarks` | All bookmarks |
| `@bookmarks:global` | Global bookmarks only |
| `@bookmarks:nonglobal` | Preset-local bookmarks only |
| `@bookmarks:red` | Red bookmarks only |
| `@bookmarks:global:red,blue` | Global red or blue bookmarks |

</details>

### Bookmark Preference

Give bookmarked files a higher pick probability. Configured in **File Randomiser Settings**:

- Set a weight multiplier per color for local and global bookmarks
- `1.0` is neutral; higher values increase pick chance for that color
- Applied on top of the randomness level

### Path Weights

Assign a pick-probability multiplier to individual files or folders.

- Enable in **File Randomiser Settings** so weight buttons appear in the file tree
- Range: **0.1x** to **5x** (default **1x**)
- Click to set a preset-local weight; <kbd>Shift</kbd>+click to set a global weight
- Folder weights multiply through to all files inside

### Randomness Level

A slider from **0** to **100** controls how the randomiser selects files:

- **0** favors sequential order
- **50** is the balanced default
- **100** is fully random

Changes save automatically.

### Shuffle & Sequential Mode

- **Shuffle on** picks randomly
- **Shuffle off** traverses sequentially, respecting current filters

### Process Tracking *(Windows only)*

When enabled in settings and toggled on in the toolbar, closing a file automatically triggers the next pick. Manual picking is disabled while active.

> [!CAUTION]
> Unstable or fast-closing apps may cause unexpected behavior including high resource usage or system instability.

### History

Every opened file is logged with a timestamp. Click a history entry to scroll the file tree to that file. Searchable alongside paths and filenames.

### Presets

Presets store: **paths**, **filter rules**, **shuffle state**, and **local bookmarks**.

Available actions: Save, Save As, Rename, Clear, Open presets folder. Unsaved changes are flagged automatically.

---

## File Sorter

**Stop manually sorting downloads folders.** Pick a directory, preview how files would be grouped by name similarity, adjust the threshold, then execute. Fully undoable.

<!-- Screenshot: File Sorter - preview tree with statistics panel -->

### Workflow

> **Select directory -> Build preview -> Adjust threshold -> Review -> Execute -> Optionally restore**

### Similarity Matching

Files are grouped by filename similarity (extension stripped):

- Compared against existing and candidate folders
- If similarity meets the threshold, the file moves to the best match
- If no folder matches, a new one is created
- When multiple folders match, the highest similarity wins

### Match Threshold

Adjustable from **10%** to **100%**. Preview updates live.

| Value | Behavior |
|-------|----------|
| Low (10-40%) | Aggressive grouping, broad matches |
| Medium (50-70%) | Balanced default |
| High (80-100%) | Strict matching, near-identical names only |

### Preview

The live tree shows existing folders, new folders to be created, and planned file moves, color-coded for clarity. Statistics update in real time:

- Files to move
- Folders to create
- Total folders affected
- Total size to move

### Per-File Controls

| Action | Description |
|--------|-------------|
| Exclude | Remove a file from the plan |
| Include | Re-add a previously excluded file |
| Force target | Manually assign a destination folder |
| Reveal in explorer | Open the file's current location |

### Execution & Undo

- Folders are created as needed; name collisions are handled safely
- All moves are recorded. The last operation can be **fully restored** at any time
- A console panel logs all operations and feedback

---

## File Auditor

**Tear through a backlog of files without touching the mouse.** Navigate, delete to trash, and bookmark, all from the keyboard. Your position is saved automatically so you can pick up exactly where you left off.

<!-- Screenshot: File Auditor - review interface with file info panel and sidebar -->

### Workflow

> **Select folder -> Start auditing -> Navigate -> Keep / Delete / Bookmark -> Resume later**

### Keyboard Controls

All keys are configurable in **File Auditor Settings** (gear icon in the navbar). Two built-in presets are available:

| Action | Left Hand (default) | Right Hand |
|--------|---------------------|------------|
| Previous file | <kbd>A</kbd> | <kbd>←</kbd> |
| Next file | <kbd>D</kbd> | <kbd>→</kbd> |
| Delete to trash | <kbd>S</kbd> | <kbd>Delete</kbd> |
| Bookmark 1–N | <kbd>1</kbd>–<kbd>N</kbd> | <kbd>1</kbd>–<kbd>N</kbd> |
| Clear bookmark | <kbd>0</kbd> | <kbd>0</kbd> |
| Stop auditing | <kbd>Esc</kbd> | <kbd>Esc</kbd> |

Bookmark slots are dynamic — one key per color defined in the global bookmark color settings.

### File Info Panel

For each file the panel shows:

- Filename (large), full path
- File size (auto-formatted: B / KB / MB / GB)
- Last modified timestamp
- Bookmark badge (if set)
- Position counter, e.g. **5 / 127**

### Session Persistence

Your audit session is saved automatically. On reopen, a **Resume** dialog shows the folder path and last position so you can continue immediately or start fresh.

### Bookmarks

Shares the global bookmark color palette with File Randomiser. Press the configured bookmark keys or click the color buttons to assign; the clear key to remove. Colors are defined globally in `store.json` and apply across all tools.

### Auto-Open

A toggle enables opening each file in its default application as you navigate. Useful for reviewing media or documents without manually launching them.

### Sidebar

Files are grouped by subfolder with relative paths displayed. The current file is always scrolled into view automatically.

---

## App Features

### Appearance

- **Dark mode**: Light, Dark, or follow system preference
- **Custom background**: Set any image from the Settings page

### Language

Available in: **English**, **German**, **Dutch**, **Polish**, **Bosnian**

Language is detected automatically from system locale.

---

## Development & Building

### Prerequisites

<details>
<summary>Windows</summary>

- [Rust](https://rustup.rs/)
- [Bun](https://bun.sh/)
- [Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (MSVC + Windows SDK)
- [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (pre-installed on Windows 10/11)

</details>

<details>
<summary>WSL2 / Linux</summary>

```bash
# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Bun
curl -fsSL https://bun.sh/install | bash

# Tauri v2 system dependencies (Ubuntu/Debian)
sudo apt update && sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  patchelf
```

</details>

### Running in dev mode

```bash
bun run tauri dev
```

Debug flags:

| Flag | Effect |
|------|--------|
| `--debug-randomiser` | Enables debug output in the randomiser |
| `--log-file <path>` | Write logs to a file |

Frontend only (Tauri APIs unavailable):

```bash
bun run dev
```

### Building for release

```bash
bun run release
```

Builds the Windows installer and all Linux packages, then copies artifacts to `release/`.

---

## Support the Project

If you find this useful, consider supporting its development:

<a href="https://www.buymeacoffee.com/aperturecoffee" target="_blank">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="45">
</a>

Support is entirely optional and greatly appreciated.

---

## License

Licensed under the **Laby's Source Available Passion License LSAPL v1.0**. Personal, non-commercial use only. No redistribution of source or modified versions.

See the [LICENSE](./LICENSE) file for full terms.
