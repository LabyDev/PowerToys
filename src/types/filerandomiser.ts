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

export type FilterTarget = "filename" | "folder"; // what the rule applies to
export type FilterAction = "include" | "exclude"; // inclusion or exclusion
export type FilterMatchType = "contains" | "startsWith" | "endsWith" | "regex"; // match type

export type FilterRule = {
  id: string;
  target: FilterTarget;
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
};

export type PresetState = {
  currentId: string | null;
  name: string;
  dirty: boolean; // paths/filters changed since last save
};
