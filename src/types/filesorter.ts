import { FilterRule } from "./common";

export type SortOperation = {
  fileName: string;
  sourcePath: string;
  destinationFolder: string;
  reason: string; // e.g., "Matched pattern 'Invoice_*'"
};

export type FileSorterState = {
  currentPath: string | null;
  similarityThreshold: number;
  filterRules: FilterRule[];
  preview: SortOperation[];
  stats: {
    filesToMove: number;
    foldersToCreate: number;
  };
  hasRestorePoint: boolean;
};

export type SortHistoryRecord = {
  timestamp: string;
  originalPath: string;
  moves: { from: string; to: string }[];
};
