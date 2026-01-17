import { FileEntryBase } from "./common";

export type SorterFileEntry = FileEntryBase & {
  size: number;
};

export type SortOperation = {
  fileName: string;
  sourcePath: string;
  destinationFolder: string;
  reason: string;
  isNewFolder: boolean;
};

export type SortTreeNode = {
  name: string;
  path: string;
  isDir: boolean;
  children?: SortTreeNode[];

  // optional overlay from preview
  operation?: SortOperation;
  isNew?: boolean;
};

import { FilterRule } from "./common";

export type FileSorterState = {
  currentPath: string | null;

  files: SorterFileEntry[];

  similarityThreshold: number;
  filterRules: FilterRule[];

  preview: SortOperation[];

  stats: {
    filesToMove: number;
    foldersToCreate: number;
    totalFoldersAffected: number;
    totalSizeToMove: number;
  };

  hasRestorePoint: boolean;
  excludedPaths: Set<string>;
  forcedTargets: Map<string, string>;
};
