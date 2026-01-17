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

export type SavedPath = {
  id: number;
  name: string;
  path: string;
};

export type FileEntryBase = {
  id: number;
  name: string;
  path: string;
  isDir: boolean;
};
