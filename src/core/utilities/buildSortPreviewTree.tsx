import { sep } from "@tauri-apps/api/path";
import { SortOperation, SortTreeNode } from "../../types/filesorter";

export function buildSortPreviewTree(
  rootPath: string,
  ops: SortOperation[],
): SortTreeNode {
  const root: SortTreeNode = {
    name: rootPath.split(sep()).pop() ?? rootPath,
    path: rootPath,
    children: [],
  };

  const folderMap = new Map<string, SortTreeNode>();
  folderMap.set(rootPath, root);

  const ensureFolder = (folderPath: string) => {
    if (folderMap.has(folderPath)) return folderMap.get(folderPath)!;

    const parentPath =
      folderPath.slice(0, folderPath.lastIndexOf(sep())) || rootPath;

    const parent = ensureFolder(parentPath);

    const node: SortTreeNode = {
      name: folderPath.split(sep()).pop()!,
      path: folderPath,
      children: [],
      operation: "create",
    };

    parent.children!.push(node);
    folderMap.set(folderPath, node);
    return node;
  };

  for (const op of ops) {
    const folder = ensureFolder(op.destinationFolder);

    folder.children!.push({
      name: op.fileName,
      path: `${op.destinationFolder}${sep()}${op.fileName}`,
      operation: "move",
      sourcePath: op.sourcePath,
    });
  }

  return root;
}
