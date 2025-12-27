import { ActionIcon, Group } from "@mantine/core";
import { CaretRightIcon, CaretDownIcon } from "@phosphor-icons/react";
import { useState, useMemo, useEffect } from "react";
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

interface FileTreeProps {
  nodes: FileTreeNode[];
  onExclude: (file: FileEntry) => void;
  currentFileId: number | null;
  freshCrawl?: boolean;
  treeCollapsed?: boolean;
  isRoot?: boolean;
  virtuosoRef?: React.RefObject<VirtuosoHandle>;
}

const FileTree = ({
  nodes,
  onExclude,
  currentFileId,
  freshCrawl = false,
  treeCollapsed = false,
  isRoot = true,
  virtuosoRef,
}: FileTreeProps) => {
  // ------------------- Helpers -------------------
  const containsCurrentFile = (node: FileTreeNode): boolean => {
    if (node.file && node.file.id === currentFileId) return true;
    if (!node.children) return false;
    return node.children.some(containsCurrentFile);
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
    const map: Record<string, boolean> = {};
    const init = (node: FileTreeNode, depth = 0) => {
      const id = getNodeId(node);
      if (node.children) {
        const shouldExpand = isRoot || containsCurrentFile(node);
        map[id] = shouldExpand;
        node.children.forEach((child) => init(child, depth + 1));
      }
    };
    nodes.forEach((n) => init(n));
    setExpandedMap(map);
  }, [nodes, currentFileId]);

  // Handle treeCollapsed / freshCrawl updates
  useEffect(() => {
    const map: Record<string, boolean> = { ...expandedMap };
    const update = (node: FileTreeNode) => {
      const id = getNodeId(node);
      if (node.children) {
        if (treeCollapsed === true) {
          map[id] = false;
        } else if (treeCollapsed === false && freshCrawl && node.depth <= 1) {
          map[id] = true;
        } else if (treeCollapsed === false && !freshCrawl) {
          map[id] = true;
        }
        node.children.forEach(update);
      }
    };
    nodes.forEach(update);
    setExpandedMap(map);
  }, [treeCollapsed, freshCrawl]);

  // ------------------- Flatten tree for Virtuoso -------------------
  const flattenTree = (nodes: FileTreeNode[], depth = 0): FlattenedNode[] => {
    const flat: FlattenedNode[] = [];
    for (const node of nodes) {
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
              />
            )}

            {node.children && (
              <ItemActions
                onOpenFolder={async () => randomiserApi.openPath(node.path)}
                onExclude={() =>
                  onExclude({
                    id: -1,
                    path: node.path,
                    name: node.name,
                    excluded: false,
                  })
                }
              />
            )}
          </Group>
        );
      }}
    />
  );
};

export default FileTree;
