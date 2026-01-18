import { FileEntryBase, Bookmark } from "./common";

/** History of opened files */
export type HistoryEntry = {
  id: number;
  name: string;
  path: string;
  openedAt: Date; // ISO string from Rust DateTime<Utc>
};

/** Application state */
export type AppStateData = {
  paths: SavedPath[];
  files: FileEntry[];
  history: HistoryEntry[];
  filterRules: FilterRule[];
};

/** Preset for randomiser configuration */
export type RandomiserPreset = {
  id: string;
  name: string;
  paths: SavedPath[];
  filterRules: FilterRule[];
  shuffle?: boolean;
  bookmarks: Bookmark[];
};

/** State of current preset in UI */
export type PresetState = {
  currentId: string | null;
  name: string;
  bookmarks: Bookmark[];
  dirty: boolean; // paths/filters changed since last save
};

/** File tree representation */
export type FileTreeNode = {
  name: string;
  path: string;
  children?: FileTreeNode[];
  file?: FileEntry;
  depth: number;
};

/** Flattened node for virtualization */
export type FlattenedNode = {
  node: FileTreeNode;
  depth: number;
};

/** File entry in the randomiser */
export type FileEntry = FileEntryBase & {
  excluded: boolean;
  hash: string;
  bookmark?: BookmarkInfo;
};

/** Extra info for bookmarks */
export type BookmarkInfo = {
  color: string | null;
  isGlobal: boolean;
};

/** Filter rule definitions */
export type FilterAction = "include" | "exclude";
export type FilterMatchType =
  | "contains"
  | "startsWith"
  | "endsWith"
  | "regex"
  | "bookmarks";

export type FilterRule = {
  id: string;
  action: FilterAction;
  type: FilterMatchType;
  pattern: string;
  caseSensitive?: boolean;
};

/** Saved folder/path */
export type SavedPath = {
  id: number;
  name: string;
  path: string;
};
