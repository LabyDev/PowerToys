import { FileEntryBase, FilterRule, SavedPath } from "./common";

export type HistoryEntry = {
  id: number;
  name: string;
  path: string;
  openedAt: Date; // ISO string from Rust DateTime<Utc>
};

export type AppStateData = {
  paths: SavedPath[];
  files: FileEntry[];
  history: HistoryEntry[];
  filterRules: FilterRule[];
};

export type RandomiserPreset = {
  id: string;
  name: string;
  paths: SavedPath[];
  filterRules: FilterRule[];
  shuffle?: boolean;
  bookmarks: Bookmark[];
};

export type PresetState = {
  currentId: string | null;
  name: string;
  bookmarks: Bookmark[];
  dirty: boolean; // paths/filters changed since last save
};

export type FileTreeNode = {
  name: string;
  path: string;
  children?: FileTreeNode[];
  file?: FileEntry;
  depth: number;
};

// Flattened node for Virtuoso
export type FlattenedNode = {
  node: FileTreeNode;
  depth: number;
};

export type Bookmark = {
  path: string; // absolute path
  hash: string; // content hash of the file
  color?: string | null;
};

export type FileEntry = FileEntryBase & {
  excluded: boolean;
  hash: string;
  bookmark?: BookmarkInfo;
};

export type BookmarkInfo = {
  color: string | null;
  isGlobal: boolean;
};
