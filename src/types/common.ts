export type FilterAction = "include" | "exclude";
export type FilterMatchType = "contains" | "startsWith" | "endsWith" | "regex";

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

export type FileEntry = {
  id: number;
  name: string;
  path: string;
  excluded: boolean;
  hash: string;
  bookmark?: BookmarkInfo;
};

export type BookmarkInfo = {
  color: string | null;
  isGlobal: boolean;
};
