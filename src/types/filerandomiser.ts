export type SavedPath = {
  id: number;
  name: string;
  path: string;
};

export type FileEntry = {
  id: number;
  name: string;
  path: string;
  excluded: boolean;
  bookmarkColor?: string | null;
};

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

export type FilterAction = "include" | "exclude"; // inclusion or exclusion
export type FilterMatchType = "contains" | "startsWith" | "endsWith" | "regex"; // match type

export type FilterRule = {
  id: string;
  action: FilterAction;
  type: FilterMatchType;
  pattern: string; // string or regex pattern
  caseSensitive?: boolean; // default false
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
  path: string; // absolute path (primary key)
  color?: string | null;
  nameOverride?: string; // optional future-proofing
};
