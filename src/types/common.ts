/** Base file entry shared across modules */
export type FileEntryBase = {
  id: number;
  name: string;
  path: string;
  isDir: boolean;
};

/** Bookmark information for files */
export type Bookmark = {
  path: string; // absolute path
  hash: string; // content hash of the file
  color?: string | null;
};

/** Shared bookmark colour cycle used by UI and settings */
export const bookmarkColorOptions = [
  { hex: "#FF6B6B", label: "Red" },
  { hex: "#6BCB77", label: "Green" },
  { hex: "#FFD700", label: "Gold" },
  { hex: "#4D96FF", label: "Blue" },
] as const;

export type BookmarkColor = (typeof bookmarkColorOptions)[number]["hex"];

export const bookmarkColors: BookmarkColor[] = bookmarkColorOptions.map(
  (entry) => entry.hex,
);

export const bookmarkCycle = [null, ...bookmarkColors] as const;
