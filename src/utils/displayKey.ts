// Only map keys where e.key is genuinely unreadable or too long.
// Named keys like "Delete", "Enter", "PageUp" are already fine as-is.
const KEY_DISPLAY: Record<string, string> = {
  " ": "Space",
  ArrowLeft: "←",
  ArrowRight: "→",
  ArrowUp: "↑",
  ArrowDown: "↓",
  Escape: "Esc",
  Backspace: "⌫",
};

export const displayKey = (key: string): string =>
  KEY_DISPLAY[key] ?? (key.length === 1 ? key.toUpperCase() : key);
