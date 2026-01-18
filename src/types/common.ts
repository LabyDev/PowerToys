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
