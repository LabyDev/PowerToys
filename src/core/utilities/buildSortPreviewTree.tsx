import { sep } from "@tauri-apps/api/path";
import { SortOperation, SortTreeNode } from "../../types/filesorter";

// Grab OS separator once
const OS_SEP = sep();

// Split a path using OS-specific separator
export const splitPath = (path: string) => {
  const normalized = path.replace(/[/\\]+/g, OS_SEP); // unify all slashes
  if (normalized === OS_SEP) return [OS_SEP];
  return normalized.split(OS_SEP).filter(Boolean);
};

// Build nested tree from preview
export function buildSortPreviewTree(
  rootPath: string,
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

  for (const op of ops) {
    const folder = ensureFolder(op.destinationFolder);

    folder.children!.push({
      name: op.fileName,
      path: `${op.destinationFolder.replace(/[/\\]+/g, OS_SEP)}${OS_SEP}${op.fileName}`,
      isDir: false,
    });
  }

  return root;
}
