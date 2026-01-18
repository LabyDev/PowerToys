import { FileEntryBase } from "./common";

/** File entry used in sorter */
export type SorterFileEntry = FileEntryBase & {
  size: number;
};

/** Individual file move operation */
export type SortOperation = {
  fileName: string;
  sourcePath: string;
  destinationFolder: string;
  reason: string;
  isNewFolder: boolean;
};

/** Node in the sort preview tree */
export type SortTreeNode = {
  name: string;
  path: string;
  isDir: boolean;
  children?: SortTreeNode[];

  // optional overlay from preview
  operation?: SortOperation;
  isNew?: boolean;
};

/** State for the File Sorter */
export type FileSorterState = {
  currentPath: string | null;
  files: SorterFileEntry[];
  similarityThreshold: number;
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
