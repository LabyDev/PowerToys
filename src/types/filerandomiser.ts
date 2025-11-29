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
}

export interface AppStateData {
  paths: SavedPath[];
  files: FileEntry[];
  history: HistoryEntry[];
}
