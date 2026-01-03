import { ActionIcon, Group } from "@mantine/core";
import { CaretRightIcon, CaretDownIcon } from "@phosphor-icons/react";
import {
  useState,
  useMemo,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useRef,
} from "react";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { dirname } from "@tauri-apps/api/path";
import {
  FileEntry,
  FileTreeNode,
  FlattenedNode,
} from "../types/filerandomiser";
import ClampedTooltipText from "./clampedTooltipText";
import ItemActions from "./itemActions";
import * as randomiserApi from "../core/api/fileRandomiserApi";
import { sep } from "@tauri-apps/api/path";

interface FileTreeProps {
  nodes: FileTreeNode[];
  onExclude: (file: FileEntry) => void;
  onBookmarkChange: (file: FileEntry, color: string | null) => void;
  onBookmarkChangeGlobal: (file: FileEntry, color: string | null) => void;
  setFreshCrawl: (fc: boolean) => void;
  currentFileId: number | null;
  freshCrawl?: boolean;
  treeCollapsed?: boolean;
  virtuosoRef?: React.RefObject<VirtuosoHandle>;
}

export interface FileTreeHandle {
  scrollToFile: (fileId: number) => void;
  getFlattenedFiles: () => FileEntry[];
}

const FileTree = forwardRef<FileTreeHandle, FileTreeProps>(
  (
    {
      nodes,
      onExclude,
      onBookmarkChange,
      onBookmarkChangeGlobal,
      setFreshCrawl,
      currentFileId,
      freshCrawl = false,
      treeCollapsed = false,
      virtuosoRef,
    },
    ref,
  ) => {
    // ------------------- Helpers -------------------
    const expandParents = (
      targetId: number,
      nodes: FileTreeNode[],
      map: Record<string, boolean>,
    ) => {
      const expandRecursively = (nodes: FileTreeNode[]): boolean => {
        for (const node of nodes) {
          if (node.file?.id === targetId) return true;
          if (node.children && expandRecursively(node.children)) {
            const id = getNodeId(node);
            map[id] = true; // expand parent
            return true;
          }
        }
        return false;
      };

      expandRecursively(nodes);
    };

    const allChildrenExcluded = (node: FileTreeNode): boolean => {
      if (node.file) return node.file.excluded ?? false;
      if (!node.children) return false;
      return node.children.every(allChildrenExcluded);
    };

    const getNodeId = (node: FileTreeNode) =>
      node.file ? `file-${node.file.id}` : node.path;

    // ------------------- Expanded state -------------------
    const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});

    const toggleNode = (node: FileTreeNode) => {
      const id = getNodeId(node);
      setExpandedMap((m) => ({ ...m, [id]: !m[id] }));
    };

    // ------------------- Effects from original code -------------------
    // Auto-expand nodes containing current file or root
    useEffect(() => {
      setExpandedMap((prev) => {
        const map = { ...prev };
        if (currentFileId != null) {
          expandParents(currentFileId, nodes, map);
        }
        return map;
      });
    }, [currentFileId, nodes]);

    // ------------------- Handle treeCollapsed -------------------
    useEffect(() => {
      const map: Record<string, boolean> = { ...expandedMap };

      const update = (node: FileTreeNode) => {
        const id = getNodeId(node);
        if (node.children) {
          map[id] = !treeCollapsed; // collapse = false, expand = true
          node.children.forEach(update);
        }
      };

      nodes.forEach(update);
      setExpandedMap(map);
    }, [treeCollapsed]);

    // ------------------- Handle freshCrawl -------------------
    useEffect(() => {
      if (!freshCrawl) return;

      const map: Record<string, boolean> = { ...expandedMap };

      const update = (node: FileTreeNode) => {
        const id = getNodeId(node);
        if (node.children) {
          if (node.depth <= 1) map[id] = true; // auto-expand shallow nodes
          node.children.forEach(update);
        }
      };

      nodes.forEach(update);
      setExpandedMap(map);
      setFreshCrawl(false); // reset only after applying
    }, [freshCrawl]);

    // ------------------- Flatten tree for Virtuoso -------------------
    const flattenTree = (nodes: FileTreeNode[], depth = 0): FlattenedNode[] => {
      const flat: FlattenedNode[] = [];

      // Sort nodes: folders first, then files
      const sortedNodes = [...nodes].sort((a, b) => {
        if (a.children && !b.children) return -1; // a folder, b file → a first
        if (!a.children && b.children) return 1; // a file, b folder → b first
        return 0; // otherwise keep order
      });

      for (const node of sortedNodes) {
        flat.push({ node, depth });
        const id = getNodeId(node);
        const isExpanded = expandedMap[id] ?? false;
        if (node.children && isExpanded) {
          flat.push(...flattenTree(node.children, depth + 1));
        }
      }

      return flat;
    };

    const flatNodes = useMemo(() => flattenTree(nodes), [nodes, expandedMap]);

    const pendingScrollId = useRef<number | null>(null);

    useEffect(() => {
      const targetId = pendingScrollId.current;
      if (targetId === null) return;

      const index = flatNodes.findIndex((n) => n.node.file?.id === targetId);

      if (index !== -1) {
        // Double requestAnimationFrame ensures the DOM has
        // painted the new rows so Virtuoso can calculate height.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            virtuosoRef?.current?.scrollToIndex({
              index,
              align: "center",
              behavior: "smooth",
            });
            pendingScrollId.current = null;
          });
        });
      }
    }, [flatNodes]); // Triggers every time the list grows/shrinks

    // --- Expose scrollToFile method ---
    useImperativeHandle(ref, () => ({
      scrollToFile: (fileId: number) => {
        pendingScrollId.current = fileId;
        setExpandedMap((prev) => {
          const map = { ...prev };
          expandParents(fileId, nodes, map);
          return map;
        });
      },
      getFlattenedFiles: () => {
        // Return only files in the same order as flatNodes
        return flatNodes
          .map((n) => n.node.file)
          .filter((f): f is FileEntry => f !== undefined);
      },
    }));

    // ------------------- Render -------------------
    return (
      <Virtuoso
        ref={virtuosoRef}
        style={{ height: "100%" }}
        data={flatNodes}
        itemContent={(_, { node, depth }) => {
          const id = getNodeId(node);
          const isExpanded = expandedMap[id] ?? false;
          const isExcluded = node.file
            ? node.file.excluded
            : allChildrenExcluded(node);
          const isCurrent = node.file && currentFileId === node.file.id;

          return (
            <Group
              key={id}
              style={{
                paddingLeft: depth * 16,
                alignItems: "center",
                gap: 8,
                backgroundColor: isCurrent
                  ? "var(--mantine-color-blue-light)"
                  : undefined,
                opacity: isExcluded ? 0.5 : 1,
              }}
              className="item-actions"
            >
              {node.children && (
                <ActionIcon size="xs" onClick={() => toggleNode(node)}>
                  {isExpanded ? (
                    <CaretDownIcon size={16} />
                  ) : (
                    <CaretRightIcon size={16} />
                  )}
                </ActionIcon>
              )}

              <ClampedTooltipText
                size="sm"
                fw={node.children ? 600 : 400}
                style={{
                  flex: 1,
                  cursor: node.children ? "pointer" : undefined,
                  textDecoration: isExcluded ? "line-through" : undefined,
                }}
                onClick={() => node.children && toggleNode(node)}
              >
                {node.children
                  ? isExpanded
                    ? "📂 " + node.name // open folder
                    : "📁 " + node.name // closed folder
                  : "📄 " + node.name}
              </ClampedTooltipText>

              {node.file && (
                <ItemActions
                  onOpen={async () => randomiserApi.openPath(node.file!.path)}
                  onOpenFolder={async () => {
                    const folder = await dirname(node.file!.path);
                    randomiserApi.openPath(folder);
                  }}
                  onExclude={() => onExclude(node.file!)}
                  onBookmarkChange={(color) =>
                    onBookmarkChange(node.file!, color)
                  }
                  onBookmarkChangeGlobal={(color) =>
                    onBookmarkChangeGlobal(node.file!, color)
                  }
                  currentBookmark={node.file.bookmark || undefined}
                />
              )}

              {node.children && (
                <ItemActions
                  onOpenFolder={async () => randomiserApi.openPath(node.path)}
                  onExclude={() =>
                    onExclude({
                      id: -1,
                      path: node.path.endsWith(sep())
                        ? node.path
                        : node.path + sep(),
                      name: node.name.endsWith(sep())
                        ? node.name
                        : node.name + sep(),
                      excluded: false,
                      hash: "",
                    })
                  }
                />
              )}
            </Group>
          );
        }}
      />
    );
  },
);

FileTree.displayName = "FileTree";

export default FileTree;
