# Tauri + React + Typescript

This template should help get you started developing with Tauri, React and Typescript in Vite.

bun run tauri dev

(explain linting)
(explain styling rules (everything in stylesheet with special notation.))

up next:

- integration extension
- file sorter

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

# Hidden Bookmark Filter Syntax

Trigger: `@bookmarks`

Format:

```
@bookmarks[:global|:nonglobal][:color1,color2,...]
```

- `@bookmarks` → required trigger
- `:global` → only global bookmarks (optional)
- `:nonglobal` → only non-global bookmarks (optional)
- `:color1,color2,...` → comma-separated colors (optional)

Examples:

```
@bookmarks             → all bookmarks
@bookmarks:global       → global bookmarks only
@bookmarks:nonglobal    → non-global bookmarks only
@bookmarks:red          → all bookmarks with red
@bookmarks:global:red,blue → global bookmarks with red or blue
@bookmarks:nonglobal:green,yellow → non-global bookmarks with green or yellow
```
