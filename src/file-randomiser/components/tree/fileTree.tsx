import { ActionIcon, Box, Group, Text } from "@mantine/core";
import { CaretRightIcon, CaretDownIcon } from "@phosphor-icons/react";
import {
  useState,
  useMemo,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useRef,
  useCallback,
} from "react";
import { useVirtualizer, VirtualItem } from "@tanstack/react-virtual";
import { dirname, sep } from "@tauri-apps/api/path";
import { invoke } from "@tauri-apps/api/core";

import {
  FileEntry,
  FileTreeNode,
  FlattenedNode,
} from "../../../types/filerandomiser";
import ClampedTooltipText from "../../../common/clampedTooltipText";
import ItemActions from "./itemActions";
import * as randomiserApi from "../../../core/api/fileRandomiserApi";

interface FileScore {
  id: number;
  name: string;
  isExcluded: boolean;
  orderScore: number;
  memoryFactor: number;
  bookmarkFactor: number;
  totalWeight: number;
}

interface FileTreeProps {
  nodes: FileTreeNode[];
  onExclude: (file: FileEntry) => void;
  onBookmarkChange: (file: FileEntry, color: string | null) => void;
  onBookmarkChangeGlobal: (file: FileEntry, color: string | null) => void;
  setFreshCrawl: (fc: boolean) => void;
  currentFileId: number | null;
  freshCrawl?: boolean;
  treeCollapsed?: boolean;
  showScores?: boolean;
}

export interface FileTreeHandle {
  scrollToFile: (fileId: number) => void;
  getFlattenedFiles: () => FileEntry[];
}

const BASE_ITEM_HEIGHT = 30;
const SCORE_EXTRA_HEIGHT = 22;
const LAUNCH_DISTANCE = 600;

type FactorKey = "order" | "memory" | "bookmark" | "total";
const ALL_FACTORS: FactorKey[] = ["order", "memory", "bookmark", "total"];

const FACTOR_LABELS: Record<FactorKey, string> = {
  order: "Order",
  memory: "Memory",
  bookmark: "Bookmark",
  total: "Total",
};

const FACTOR_COLORS: Record<FactorKey, string> = {
  order: "var(--mantine-color-violet-5)",
  memory: "var(--mantine-color-cyan-5)",
  bookmark: "var(--mantine-color-yellow-5)",
  total: "var(--mantine-color-green-5)",
};

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
      showScores = false,
    },
    ref,
  ) => {
    const parentRef = useRef<HTMLDivElement>(null);
    const animationFrameRef = useRef<number | null>(null);

    // ------------------- Score state -------------------
    const [scoreMap, setScoreMap] = useState<Map<number, FileScore>>(new Map());
    const [visibleFactors, setVisibleFactors] = useState<Set<FactorKey>>(
      new Set(["total"]),
    );

    const toggleFactor = (factor: FactorKey) => {
      setVisibleFactors((prev) => {
        const next = new Set(prev);
        if (next.has(factor)) {
          next.delete(factor);
        } else {
          next.add(factor);
        }
        return next;
      });
    };

    const fetchScores = useCallback(async () => {
      if (!showScores) return;
      try {
        const scores = await invoke<FileScore[]>("get_file_scores");
        setScoreMap(new Map(scores.map((s) => [s.id, s])));
      } catch (e) {
        console.error("Failed to fetch file scores", e);
      }
    }, [showScores]);

    useEffect(() => {
      if (showScores) {
        fetchScores();
      } else {
        setScoreMap(new Map());
      }
    }, [showScores]);

    useEffect(() => {
      if (showScores) fetchScores();
    }, [currentFileId, showScores]);

    // ------------------- Item height -------------------
    const factorCount = visibleFactors.size;

    const fileItemHeight = useMemo(() => {
      if (!showScores) return BASE_ITEM_HEIGHT;
      return BASE_ITEM_HEIGHT + factorCount * SCORE_EXTRA_HEIGHT;
    }, [showScores, factorCount]);

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
    const expandedMapRef = useRef<Record<string, boolean>>({});
    const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});

    // Keep ref in sync
    useEffect(() => {
      expandedMapRef.current = expandedMap;
    }, [expandedMap]);

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
    const flattenTree = (
      nodes: FileTreeNode[],
      depth = 0,
      map: Record<string, boolean> = expandedMapRef.current,
    ): FlattenedNode[] => {
      const flat: FlattenedNode[] = [];
      const sortedNodes = [...nodes].sort(sortNodes);
      for (const node of sortedNodes) {
        flat.push({ node, depth });
        const id = getNodeId(node);
        if (node.children && map[id]) {
          flat.push(...flattenTree(node.children, depth + 1, map));
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

    const flatNodesRef = useRef<FlattenedNode[]>([]);
    const flatNodes = useMemo(() => {
      const result = flattenTree(nodes);
      flatNodesRef.current = result;
      return result;
    }, [nodes, expandedMap]);

    // getNodeHeight defined AFTER flatNodes so it has a valid closure over it.
    // Also added flatNodes to its dependency array.
    const getNodeHeight = useCallback(
      (index: number) => {
        const node = flatNodes[index]?.node;
        return node?.file ? fileItemHeight : BASE_ITEM_HEIGHT;
      },
      [flatNodes, fileItemHeight],
    );

    // ------------------- Virtualizer -------------------
    const virtualizer = useVirtualizer({
      count: flatNodes.length,
      getScrollElement: () => parentRef.current,
      estimateSize: getNodeHeight,
      overscan: 10,
    });

    // Force virtualizer to re-measure all items whenever the item height
    // changes (showScores toggled, or a factor turned on/off).
    useEffect(() => {
      virtualizer.measure();
    }, [fileItemHeight]);

    // Callback ref passed to each row div so the virtualizer reads actual DOM height
    const measureElement = useCallback(
      (el: Element | null) => {
        if (el) virtualizer.measureElement(el);
      },
      [virtualizer],
    );

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
        const scroller = parentRef.current;
        if (!scroller) return;

        // Build the new map synchronously from the ref
        const newMap = { ...expandedMapRef.current };
        expandParents(fileId, nodes, newMap);

        // Update state so the tree re-renders
        setExpandedMap(newMap);

        // Compute scroll position using the new map directly
        const recomputed = flattenTree(nodes, 0, newMap);
        const index = recomputed.findIndex((n) => n.node.file?.id === fileId);
        if (index === -1) return;

        const targetScrollTop = Math.max(
          0,
          index * fileItemHeight -
            scroller.clientHeight / 2 +
            fileItemHeight / 2,
        );

        const distance = Math.abs(scroller.scrollTop - targetScrollTop);
        if (distance < LAUNCH_DISTANCE) {
          smoothScrollTo(targetScrollTop);
        } else {
          const jumpTo =
            targetScrollTop > scroller.scrollTop
              ? targetScrollTop - LAUNCH_DISTANCE
              : targetScrollTop + LAUNCH_DISTANCE;
          scroller.scrollTop = Math.max(0, jumpTo);
          smoothScrollTo(targetScrollTop, 300);
        }
      },
      getFlattenedFiles: () =>
        flattenTreeAll(nodes)
          .map((n) => n.node.file)
          .filter((f): f is FileEntry => !!f),
    }));

    // ------------------- Score bar -------------------
    const getFactorValue = (score: FileScore, factor: FactorKey): number => {
      switch (factor) {
        case "order":
          return score.orderScore;
        case "memory":
          return score.memoryFactor;
        case "bookmark":
          return score.bookmarkFactor;
        case "total":
          return score.totalWeight;
      }
    };

    const maxTotal = useMemo(() => {
      let max = 1;
      scoreMap.forEach((s) => {
        if (s.totalWeight > max) max = s.totalWeight;
      });
      return max;
    }, [scoreMap]);

    const renderScoreRows = (file: FileEntry) => {
      const score = scoreMap.get(file.id);

      return (
        <Box style={{ paddingLeft: 4, opacity: file.excluded ? 0.4 : 1 }}>
          <Group gap={6} mb={2}>
            {ALL_FACTORS.map((factor) => (
              <Text
                key={factor}
                size="10px"
                style={{
                  cursor: "pointer",
                  color: visibleFactors.has(factor)
                    ? FACTOR_COLORS[factor]
                    : "var(--mantine-color-dimmed)",
                  userSelect: "none",
                  fontWeight: visibleFactors.has(factor) ? 600 : 400,
                  transition: "color 0.15s",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFactor(factor);
                }}
              >
                {FACTOR_LABELS[factor]}
              </Text>
            ))}
          </Group>

          {score
            ? Array.from(visibleFactors).map((factor) => {
                const value = getFactorValue(score, factor);
                const barPct =
                  factor === "total"
                    ? (value / maxTotal) * 100
                    : Math.min(value * 50, 100);
                return (
                  <Group key={factor} gap={6} mb={1} align="center">
                    <Box
                      style={{
                        width: 80,
                        height: 6,
                        borderRadius: 3,
                        background: "var(--mantine-color-dark-4)",
                        overflow: "hidden",
                        flexShrink: 0,
                      }}
                    >
                      <Box
                        style={{
                          width: `${barPct}%`,
                          height: "100%",
                          background: FACTOR_COLORS[factor],
                          borderRadius: 3,
                          transition: "width 0.2s ease",
                        }}
                      />
                    </Box>
                    <Text size="10px" c="dimmed" ff="monospace">
                      {value.toFixed(3)}
                    </Text>
                  </Group>
                );
              })
            : Array.from(visibleFactors).map((factor) => (
                <Group key={factor} gap={6} mb={1} align="center">
                  <Box
                    style={{
                      width: 80,
                      height: 6,
                      borderRadius: 3,
                      background: "var(--mantine-color-dark-4)",
                      flexShrink: 0,
                    }}
                  />
                  <Text size="10px" c="dimmed" ff="monospace">
                    —
                  </Text>
                </Group>
              ))}
        </Box>
      );
    };

    // ------------------- Render -------------------
    const renderNode = ({ node, depth }: FlattenedNode) => {
      const id = getNodeId(node);
      const isExpanded = expandedMap[id] ?? false;
      const isExcluded = node.file
        ? node.file.excluded
        : allChildrenExcluded(node);
      const isCurrent = node.file && currentFileId === node.file.id;
      const nodeHeight = node.file ? fileItemHeight : BASE_ITEM_HEIGHT;

      return (
        <Group
          style={{
            paddingLeft: depth * 16,
            alignItems: "flex-start",
            gap: 8,
            height: nodeHeight,
            minHeight: nodeHeight,
            maxHeight: nodeHeight,
            boxSizing: "border-box",
            backgroundColor: isCurrent
              ? "var(--mantine-color-blue-light)"
              : undefined,
            opacity: isExcluded ? 0.5 : 1,
            paddingTop: 4,
            paddingBottom: 4,
          }}
          className="item-actions"
        >
          {node.children && (
            <ActionIcon
              size="xs"
              onClick={() => toggleNode(node)}
              style={{ marginTop: 4 }}
            >
              {isExpanded ? (
                <CaretDownIcon size={16} />
              ) : (
                <CaretRightIcon size={16} />
              )}
            </ActionIcon>
          )}

          <Box style={{ flex: 1, overflow: "hidden" }}>
            <ClampedTooltipText
              size="sm"
              fw={node.children ? 600 : 400}
              style={{
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

            {showScores && node.file && renderScoreRows(node.file)}
          </Box>

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
          {virtualizer.getVirtualItems().map((virtualItem: VirtualItem) => {
            return (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                {renderNode(flatNodes[virtualItem.index])}
              </div>
            );
          })}
        </div>
      </div>
    );
  },
);

FileTree.displayName = "FileTree";

export default FileTree;
