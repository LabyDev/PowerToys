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
): SortTreeNode {
  const normalizedRoot = rootPath
    .replace(/[/\\]+/g, OS_SEP)
    .replace(new RegExp(`${OS_SEP}+$`), "");
  const rootSegments = splitPath(normalizedRoot);

  const root: SortTreeNode = {
    name: rootSegments[rootSegments.length - 1] || normalizedRoot,
    path: normalizedRoot,
    children: [],
    isDir: true,
  };

  const folderMap = new Map<string, SortTreeNode>();
  folderMap.set(normalizedRoot, root);

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
    };

    parent.children!.push(node);
    folderMap.set(normalizedFolderPath, node);
    return node;
  };

  // Build tree from actual files
  for (const f of files) {
    const folder = f.isDir
      ? ensureFolder(f.path)
      : ensureFolder(f.path.split(OS_SEP).slice(0, -1).join(OS_SEP));

    if (!f.isDir) {
      folder.children!.push({
        name: f.name,
        path: f.path,
        isDir: false,
      });
    }
  }

  // Overlay planned moves
  const opMap = new Map<string, SortOperation>();
  for (const op of ops) {
    opMap.set(op.sourcePath, op);
  }

  const attachOperations = (node: SortTreeNode) => {
    if (!node.isDir && opMap.has(node.path)) {
      node.operation = opMap.get(node.path)!;
    }
    node.children?.forEach(attachOperations);
  };

  attachOperations(root);

  return root;
}
