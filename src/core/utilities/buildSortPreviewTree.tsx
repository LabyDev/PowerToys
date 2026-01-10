import { SortOperation, SortTreeNode } from "../../types/filesorter";

// Helper to normalize paths and split into segments
const splitPath = (path: string) => path.replace(/\\/g, "/").split("/");

export function buildSortPreviewTree(
  rootPath: string,
  ops: SortOperation[],
): SortTreeNode {
  const root: SortTreeNode = {
    name: splitPath(rootPath).pop() || rootPath,
    path: rootPath,
    children: [],
    isDir: true,
  };

  const folderMap = new Map<string, SortTreeNode>();
  folderMap.set(rootPath, root);

  const ensureFolder = (folderPath: string): SortTreeNode => {
    if (folderMap.has(folderPath)) return folderMap.get(folderPath)!;

    const segments = splitPath(folderPath);
    const parentPath = segments.slice(0, -1).join("/") || rootPath;

    const parent = ensureFolder(parentPath);

    const node: SortTreeNode = {
      name: segments[segments.length - 1],
      path: folderPath,
      children: [],
      isDir: true,
      operation: undefined, // folders don't have an operation
    };

    parent.children!.push(node);
    folderMap.set(folderPath, node);
    return node;
  };

  for (const op of ops) {
    const folder = ensureFolder(op.destinationFolder);

    folder.children!.push({
      name: op.fileName,
      path: `${op.destinationFolder}/${op.fileName}`,
      isDir: false,
      operation: op, // only files get a SortOperation
    });
  }

  return root;
}
