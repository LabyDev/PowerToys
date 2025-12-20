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
