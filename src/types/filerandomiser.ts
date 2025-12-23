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
  excludedFolders: FolderExclusion[];
  excludedFilenames: FilenameExclusion[];
};

export type FolderExclusion = {
  id: string;
  path: string;
};

export type FilenameExclusion = {
  id: string;
  pattern: string;
  isRegex: boolean;
};
