export interface SavedPath {
  id: number;
  name: string;
  path: string;
}

export interface FileEntry {
  id: number;
  name: string;
  path: string;
}

export interface HistoryEntry {
  id: number;
  name: string;
  path: string;
  openedAt: Date; // ISO string from Rust DateTime<Utc>
}

export interface AppStateData {
  paths: SavedPath[];
  files: FileEntry[];
  history: HistoryEntry[];
}

export type FolderExclusion = {
  id: string;
  path: string;
};

export type FilenameExclusion = {
  id: string;
  pattern: string;
  isRegex: boolean;
};
