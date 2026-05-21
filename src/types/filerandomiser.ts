import { FileEntryBase, Bookmark } from "./common";

/** Per-pick algorithm diagnostics, attached to entries created by the randomiser. */
export type PickDiagnostics = {
  randomnessLevel: number;
  candidates: number;
  bookmarkPrefEnabled: boolean;
  recencyWindow: number;
  recencyPenalised: number;
  weightMin: number;
  weightMax: number;
  weightMean: number;
  weightMedian: number;
  bookmarkedCount: number;
  bookmarkedMean: number;
  unbookmarkedCount: number;
  unbookmarkedMean: number;
  chosenWeight: number;
  chosenOrderScore: number;
  chosenMemoryFactor: number;
  chosenColorStreakFactor: number;
  chosenFolderStreakFactor: number;
  chosenBookmarkColor: string | null;
  chosenBookmarkGlobal: boolean;
};

/** History of opened files */
export type HistoryEntry = {
  id: number;
  name: string;
  path: string;
  openedAt: Date; // ISO string from Rust DateTime<Utc>
  diagnostics?: PickDiagnostics | null;
};

/** Application state */
export type AppStateData = {
  paths: SavedPath[];
  files: FileEntry[];
  history: HistoryEntry[];
  filterRules: FilterRule[];
  pickCounts: Record<string, number>;
};

/** Per-file score from the randomiser algorithm */
export type FileScore = {
  id: number;
  name: string;
  isExcluded: boolean;
  orderScore: number;
  memoryFactor: number;
  bookmarkFactor: number;
  coverageFactor: number;
  totalWeight: number;
};

/** Preset for randomiser configuration */
export type RandomiserPreset = {
  id: string;
  name: string;
  paths: SavedPath[];
  filterRules: FilterRule[];
  shuffle?: boolean;
  bookmarks: Bookmark[];
  pathWeights?: Record<string, number>;
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
