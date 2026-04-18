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
import { useVirtualizer, VirtualItem } from "@tanstack/react-virtual";
import { dirname, sep } from "@tauri-apps/api/path";

import {
  FileEntry,
  FileTreeNode,
  FlattenedNode,
} from "../../../types/filerandomiser";
import ClampedTooltipText from "../../../common/clampedTooltipText";
import ItemActions from "./itemActions";
import * as randomiserApi from "../../../core/api/fileRandomiserApi";

interface FileTreeProps {
  nodes: FileTreeNode[];
  onExclude: (file: FileEntry) => void;
  onBookmarkChange: (file: FileEntry, color: string | null) => void;
  onBookmarkChangeGlobal: (file: FileEntry, color: string | null) => void;
  setFreshCrawl: (fc: boolean) => void;
  currentFileId: number | null;
  freshCrawl?: boolean;
  treeCollapsed?: boolean;
}

export interface FileTreeHandle {
  scrollToFile: (fileId: number) => void;
  getFlattenedFiles: () => FileEntry[];
}

const ITEM_HEIGHT = 30;
const LAUNCH_DISTANCE = 600;

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
    },
    ref,
  ) => {
    const parentRef = useRef<HTMLDivElement>(null);
    const animationFrameRef = useRef<number | null>(null);

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
    useEffect(() => {
      if (currentFileId == null) return;
      setExpandedMap((prev) => {
        const map = { ...prev };
        expandParents(currentFileId, nodes, map);
        return map;
      });
    }, [currentFileId, nodes]);

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

    // Cleanup animation on unmount
    useEffect(() => {
      return () => {
        if (animationFrameRef.current)
          cancelAnimationFrame(animationFrameRef.current);
      };
    }, []);

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

    // ------------------- Virtualizer -------------------
    const virtualizer = useVirtualizer({
      count: flatNodes.length,
      getScrollElement: () => parentRef.current,
      estimateSize: () => ITEM_HEIGHT,
      overscan: 10,
    });

    // ------------------- Smooth Scroll -------------------
    const smoothScrollTo = (target: number, duration = 350) => {
      const scroller = parentRef.current;
      if (!scroller) return;

      if (animationFrameRef.current)
        cancelAnimationFrame(animationFrameRef.current);

      const start = scroller.scrollTop;
      const distance = target - start;
      const startTime = performance.now();

      // Ease in-out cubic
      const ease = (t: number) =>
        t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

      const step = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        scroller.scrollTop = start + distance * ease(progress);
        if (progress < 1) {
          animationFrameRef.current = requestAnimationFrame(step);
        } else {
          animationFrameRef.current = null;
        }
      };

      animationFrameRef.current = requestAnimationFrame(step);
    };

    // ------------------- Expose methods -------------------
    useImperativeHandle(ref, () => ({
      scrollToFile: (fileId: number) => {
        // First expand parents so the node is in flatNodes
        setExpandedMap((prev) => {
          const map = { ...prev };
          expandParents(fileId, nodes, map);
          return map;
        });

        // Use a small timeout to let flatNodes recompute after expand
        setTimeout(() => {
          const scroller = parentRef.current;
          if (!scroller) return;

          const index = flatNodes.findIndex((n) => n.node.file?.id === fileId);
          if (index === -1) return;

          const targetScrollTop = Math.max(
            0,
            index * ITEM_HEIGHT - scroller.clientHeight / 2 + ITEM_HEIGHT / 2,
          );

          const distance = Math.abs(scroller.scrollTop - targetScrollTop);

          if (distance < LAUNCH_DISTANCE) {
            smoothScrollTo(targetScrollTop);
          } else {
            // Jump to just outside the target, then smooth the rest
            const jumpTo =
              targetScrollTop > scroller.scrollTop
                ? targetScrollTop - LAUNCH_DISTANCE
                : targetScrollTop + LAUNCH_DISTANCE;

            scroller.scrollTop = Math.max(0, jumpTo);
            smoothScrollTo(targetScrollTop, 300);
          }
        }, 0);
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
          style={{
            paddingLeft: depth * 16,
            alignItems: "center",
            gap: 8,
            height: ITEM_HEIGHT,
            minHeight: ITEM_HEIGHT,
            maxHeight: ITEM_HEIGHT,
            boxSizing: "border-box",
            overflow: "hidden",
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
      <div ref={parentRef} style={{ height: "100%", overflowY: "auto" }}>
        <div
          style={{
            height: virtualizer.getTotalSize(),
            width: "100%",
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem: VirtualItem) => (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: ITEM_HEIGHT,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              {renderNode(flatNodes[virtualItem.index])}
            </div>
          ))}
        </div>
      </div>
    );
  },
);

FileTree.displayName = "FileTree";

export default FileTree;
