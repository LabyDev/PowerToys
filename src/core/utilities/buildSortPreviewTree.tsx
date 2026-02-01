import { sep } from "@tauri-apps/api/path";
import {
  SortOperation,
  SortTreeNode,
  SorterFileEntry,
} from "../../types/filesorter";

const OS_SEP = sep();

export const splitPath = (path: string) => {
  const normalized = path.replace(/[/\\]+/g, OS_SEP);
  if (normalized === OS_SEP) return [OS_SEP];
  return normalized.split(OS_SEP).filter(Boolean);
};

export function buildSortPreviewTree(
  rootPath: string,
  files: SorterFileEntry[],
  ops: SortOperation[],
): { root: SortTreeNode; plannedMovesBySource: Map<string, SortOperation[]> } {
  const normalizedRoot = rootPath
    .replace(/[/\\]+/g, OS_SEP)
    .replace(new RegExp(`${OS_SEP}+$`), "");

  const root: SortTreeNode = {
    name: normalizedRoot,
    path: normalizedRoot,
    children: [],
    isDir: true,
  };

  const folderMap = new Map<string, SortTreeNode>();
  folderMap.set(normalizedRoot, root);

  // Track which folders exist in the original files
  const existingFolders = new Set<string>();
  for (const f of files) {
    if (f.isDir) existingFolders.add(f.path.replace(/[/\\]+/g, OS_SEP));
    else existingFolders.add(f.path.split(OS_SEP).slice(0, -1).join(OS_SEP));
  }

  const ensureFolder = (folderPath: string): SortTreeNode => {
    const normalizedFolderPath = folderPath
      .replace(/[/\\]+/g, OS_SEP)
      .replace(new RegExp(`${OS_SEP}+$`), "");

    if (folderMap.has(normalizedFolderPath))
      return folderMap.get(normalizedFolderPath)!;

    const segments = splitPath(normalizedFolderPath);
    const parentPath =
      segments.length > 1 ? segments.slice(0, -1).join(OS_SEP) : normalizedRoot;
    const parent = ensureFolder(parentPath);

    const node: SortTreeNode = {
      name: segments[segments.length - 1],
      path: normalizedFolderPath,
      children: [],
      isDir: true,
      isNew: !existingFolders.has(normalizedFolderPath),
    };

    parent.children!.push(node);
    folderMap.set(normalizedFolderPath, node);
    return node;
  };

  // Build tree from existing files
  for (const f of files) {
    const folderPath = f.isDir
      ? f.path
      : f.path.split(OS_SEP).slice(0, -1).join(OS_SEP);

    const folder = ensureFolder(folderPath);

    if (!f.isDir) {
      folder.children!.push({
        name: f.name,
        path: f.path,
        isDir: false,
      });
    }
  }

  // Overlay planned moves
  for (const op of ops) {
    const folder = ensureFolder(op.destinationFolder);

    folder.children!.push({
      name: op.fileName,
      path: `${op.destinationFolder}${OS_SEP}${op.fileName}`,
      isDir: false,
      operation: op,
    });
  }

  // Map source paths → operations for highlighting original files
  const plannedMovesBySource = new Map<string, SortOperation[]>();
  for (const op of ops) {
    if (!plannedMovesBySource.has(op.sourcePath)) {
      plannedMovesBySource.set(op.sourcePath, []);
    }
    plannedMovesBySource.get(op.sourcePath)!.push(op);
  }

  return { root, plannedMovesBySource };
}
