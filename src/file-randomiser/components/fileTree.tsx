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
import { dirname, sep } from "@tauri-apps/api/path";

import {
  FileEntry,
  FileTreeNode,
  FlattenedNode,
} from "../../types/filerandomiser";
import ClampedTooltipText from "./clampedTooltipText";
import ItemActions from "./itemActions";
import * as randomiserApi from "../../core/api/fileRandomiserApi";

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
    const getNodeId = (node: FileTreeNode) =>
      node.file ? `file-${node.file.id}` : node.path;

    const expandParents = (
      targetId: number,
      nodes: FileTreeNode[],
      map: Record<string, boolean>,
    ) => {
      const recurse = (nodes: FileTreeNode[]): boolean => {
        for (const node of nodes) {
          if (node.file?.id === targetId) return true;
          if (node.children && recurse(node.children)) {
            map[getNodeId(node)] = true;
            return true;
          }
        }
        return false;
      };
      recurse(nodes);
    };

    const allChildrenExcluded = (node: FileTreeNode): boolean => {
      if (node.file) return node.file.excluded ?? false;
      if (!node.children) return false;
      return node.children.every(allChildrenExcluded);
    };

    const sortNodes = (a: FileTreeNode, b: FileTreeNode) => {
      if (a.children && !b.children) return -1;
      if (!a.children && b.children) return 1;
      return 0;
    };

    // ------------------- Expanded state -------------------
    const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});

    const toggleNode = (node: FileTreeNode) => {
      const id = getNodeId(node);
      setExpandedMap((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    // ------------------- Effects -------------------
    // Auto-expand nodes containing the current file
    useEffect(() => {
      if (currentFileId == null) return;
      setExpandedMap((prev) => {
        const map = { ...prev };
        expandParents(currentFileId, nodes, map);
        return map;
      });
    }, [currentFileId, nodes]);

    // Collapse or expand entire tree
    useEffect(() => {
      const map: Record<string, boolean> = { ...expandedMap };
      const update = (node: FileTreeNode) => {
        const id = getNodeId(node);
        if (node.children) {
          map[id] = !treeCollapsed;
          node.children.forEach(update);
        }
      };
      nodes.forEach(update);
      setExpandedMap(map);
    }, [treeCollapsed]);

    // Expand shallow nodes on fresh crawl
    useEffect(() => {
      if (!freshCrawl) return;

      const map: Record<string, boolean> = { ...expandedMap };
      const update = (node: FileTreeNode) => {
        const id = getNodeId(node);
        if (node.children) {
          if (node.depth <= 1) map[id] = true;
          node.children.forEach(update);
        }
      };
      nodes.forEach(update);
      setExpandedMap(map);
      setFreshCrawl(false);
    }, [freshCrawl]);

    // ------------------- Flattening -------------------
    const flattenTree = (nodes: FileTreeNode[], depth = 0): FlattenedNode[] => {
      const flat: FlattenedNode[] = [];
      const sortedNodes = [...nodes].sort(sortNodes);

      for (const node of sortedNodes) {
        flat.push({ node, depth });
        const id = getNodeId(node);
        if (node.children && expandedMap[id]) {
          flat.push(...flattenTree(node.children, depth + 1));
        }
      }
      return flat;
    };

    const flattenTreeAll = (
      nodes: FileTreeNode[],
      depth = 0,
    ): FlattenedNode[] => {
      const flat: FlattenedNode[] = [];
      const sortedNodes = [...nodes].sort(sortNodes);

      for (const node of sortedNodes) {
        flat.push({ node, depth });
        if (node.children) {
          flat.push(...flattenTreeAll(node.children, depth + 1));
        }
      }
      return flat;
    };

    const flatNodes = useMemo(() => flattenTree(nodes), [nodes, expandedMap]);

    const pendingScrollId = useRef<number | null>(null);

    // Scroll to pending file
    useEffect(() => {
      const targetId = pendingScrollId.current;
      if (targetId === null) return;

      const index = flatNodes.findIndex((n) => n.node.file?.id === targetId);
      if (index === -1) return;

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
    }, [flatNodes]);

    // ------------------- Expose methods -------------------
    useImperativeHandle(ref, () => ({
      scrollToFile: (fileId: number) => {
        pendingScrollId.current = fileId;
        setExpandedMap((prev) => {
          const map = { ...prev };
          expandParents(fileId, nodes, map);
          return map;
        });
      },
      getFlattenedFiles: () =>
        flattenTreeAll(nodes)
          .map((n) => n.node.file)
          .filter((f): f is FileEntry => !!f),
    }));

    // ------------------- Render -------------------
    const renderNode = ({ node, depth }: FlattenedNode) => {
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
                ? "📂 " + node.name
                : "📁 " + node.name
              : "📄 " + node.name}
          </ClampedTooltipText>

          {node.file && (
            <ItemActions
              onOpen={() => randomiserApi.openPath(node.file!.path)}
              onOpenFolder={async () =>
                randomiserApi.openPath(await dirname(node.file!.path))
              }
              onExclude={() => onExclude(node.file!)}
              onBookmarkChange={(color) => onBookmarkChange(node.file!, color)}
              onBookmarkChangeGlobal={(color) =>
                onBookmarkChangeGlobal(node.file!, color)
              }
              currentBookmark={node.file.bookmark || undefined}
            />
          )}

          {node.children && (
            <ItemActions
              onOpenFolder={() => randomiserApi.openPath(node.path)}
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
                  isDir: true,
                })
              }
            />
          )}
        </Group>
      );
    };

    return (
      <Virtuoso
        ref={virtuosoRef}
        style={{ height: "100%" }}
        data={flatNodes}
        itemContent={(_, node) => renderNode(node)}
      />
    );
  },
);

FileTree.displayName = "FileTree";

export default FileTree;
