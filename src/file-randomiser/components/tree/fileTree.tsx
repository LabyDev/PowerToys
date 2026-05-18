import { ActionIcon, Box, Group, Popover, Slider, Text } from "@mantine/core";
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
import { useTranslation } from "react-i18next";
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
import { useFileRandomiser } from "../../../core/hooks/fileRandomiserStateProvider";

interface FileTreeProps {
  nodes: FileTreeNode[];
  onExclude: (file: FileEntry) => void;
  onBookmarkChange: (file: FileEntry, color: string | null) => void;
  onBookmarkChangeGlobal: (file: FileEntry, color: string | null) => void;
  setFreshCrawl: (fc: boolean) => void;
  currentFileId: number | null;
  freshCrawl?: boolean;
  treeCollapsed?: boolean;
  onBookmarkChangeBulk?: (
    files: FileEntry[],
    color: string | null,
    isGlobal: boolean,
  ) => void;
  bookmarkColors?: string[];
  showWeights?: boolean;
  // path → multiplier; local (preset-scoped) and global weights
  localPathWeights?: Record<string, number>;
  globalPathWeights?: Record<string, number>;
  onLocalPathWeightChange?: (path: string, weight: number) => void;
  onGlobalPathWeightChange?: (path: string, weight: number) => void;
}

export interface FileTreeHandle {
  scrollToFile: (fileId: number) => void;
  getFlattenedFiles: () => FileEntry[];
}

const BASE_ITEM_HEIGHT = 30;
const LAUNCH_DISTANCE = 600;

// ── Path weight helpers ────────────────────────────────────────────────────

// Returns the most-specific matching weight for a given path.
// Exact match wins, then longest prefix match.
const getEffectiveWeight = (
  nodePath: string,
  weights: Record<string, number>,
): number => {
  if (weights[nodePath] !== undefined) return weights[nodePath];
  let best: number | undefined;
  let bestLen = -1;
  for (const [key, val] of Object.entries(weights)) {
    if (nodePath.startsWith(key) && key.length > bestLen) {
      best = val;
      bestLen = key.length;
    }
  }
  return best ?? 1.0;
};

interface WeightButtonProps {
  nodePath: string;
  localPathWeights: Record<string, number>;
  globalPathWeights: Record<string, number>;
  onLocalPathWeightChange?: (path: string, weight: number) => void;
  onGlobalPathWeightChange?: (path: string, weight: number) => void;
}

const WeightButton = ({
  nodePath,
  localPathWeights,
  globalPathWeights,
  onLocalPathWeightChange,
  onGlobalPathWeightChange,
}: WeightButtonProps) => {
  const { t } = useTranslation();
  const local = getEffectiveWeight(nodePath, localPathWeights);
  const global = getEffectiveWeight(nodePath, globalPathWeights);

  const [localVal, setLocalVal] = useState(localPathWeights[nodePath] ?? 1.0);
  const [globalVal, setGlobalVal] = useState(
    globalPathWeights[nodePath] ?? 1.0,
  );
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"local" | "global">("local");

  useEffect(() => {
    setLocalVal(localPathWeights[nodePath] ?? 1.0);
  }, [localPathWeights[nodePath]]);
  useEffect(() => {
    setGlobalVal(globalPathWeights[nodePath] ?? 1.0);
  }, [globalPathWeights[nodePath]]);

  const isLocalModified = (localPathWeights[nodePath] ?? 1.0) !== 1.0;
  const isGlobalModified = (globalPathWeights[nodePath] ?? 1.0) !== 1.0;
  const isModified = isLocalModified || isGlobalModified;
  const displayVal = isModified ? Math.max(local, global).toFixed(1) : "1";

  const sliderVal = mode === "local" ? localVal : globalVal;
  const setSliderVal = mode === "local" ? setLocalVal : setGlobalVal;
  const onChangeEnd = (v: number) => {
    if (mode === "local") onLocalPathWeightChange?.(nodePath, v);
    else onGlobalPathWeightChange?.(nodePath, v);
  };
  const onReset = () => {
    if (mode === "local") {
      setLocalVal(1.0);
      onLocalPathWeightChange?.(nodePath, 1.0);
    } else {
      setGlobalVal(1.0);
      onGlobalPathWeightChange?.(nodePath, 1.0);
    }
  };

  return (
    <Popover
      opened={open}
      onChange={setOpen}
      position="left"
      withArrow
      shadow="md"
      clickOutsideEvents={["mousedown"]}
    >
      <Popover.Target>
        <ActionIcon
          variant={isModified ? "light" : "subtle"}
          color={isModified ? "teal" : "gray"}
          className={`item-action ${Math.max(local, global) > 1.0 ? "item-action--bookmark" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            setMode(e.shiftKey ? "global" : "local");
            setOpen((o) => !o);
          }}
          title={t("fileRandomiserSettings.pathWeights.buttonTitle")}
        >
          <Text size="xs" ff="monospace" fw={600}>
            {displayVal}×
          </Text>
        </ActionIcon>
      </Popover.Target>

      <Popover.Dropdown
        onClick={(e) => e.stopPropagation()}
        style={{ minWidth: 220 }}
      >
        <Group justify="space-between" mb={8}>
          <Text size="xs" fw={600} style={{ wordBreak: "break-all" }}>
            {nodePath.split(/[\\/]/).pop()}
          </Text>
          <Text size="xs" c="dimmed">
            {mode === "local"
              ? t("fileRandomiserSettings.pathWeights.localLabel")
              : t("fileRandomiserSettings.pathWeights.globalLabel")}
          </Text>
        </Group>

        <Group gap="xs" align="center" wrap="nowrap">
          <Slider
            value={sliderVal}
            onChange={setSliderVal}
            onChangeEnd={onChangeEnd}
            min={0.1}
            max={5}
            step={0.1}
            style={{ flex: 1 }}
            color={mode === "local" ? "yellow" : "blue"}
            label={(v) => `${v.toFixed(1)}×`}
          />
          <Text
            size="xs"
            ff="monospace"
            style={{ width: 32, flexShrink: 0, textAlign: "right" }}
          >
            {sliderVal.toFixed(1)}×
          </Text>
          <ActionIcon
            size="sm"
            variant="subtle"
            color="gray"
            onClick={onReset}
            title={t("fileRandomiserSettings.pathWeights.resetTitle")}
            disabled={sliderVal === 1.0}
          >
            ↺
          </ActionIcon>
        </Group>
        <Text size="9px" c="dimmed" mt={6}>
          {t("fileRandomiserSettings.pathWeights.shiftHint")}
        </Text>
      </Popover.Dropdown>
    </Popover>
  );
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
      showWeights = false,
      onBookmarkChangeBulk,
      bookmarkColors,
      localPathWeights = {},
      globalPathWeights = {},
      onLocalPathWeightChange,
      onGlobalPathWeightChange,
    },
    ref,
  ) => {
    const parentRef = useRef<HTMLDivElement>(null);
    const animationFrameRef = useRef<number | null>(null);

    // ── Pending folder-bookmark state ──────────────────────────────────────
    // We keep BOTH a React state (for re-render / visual indicator) and a ref
    // (for the confirmation handler, which would otherwise read a stale closure
    // from the first click and never match on the second click).
    const [pendingFolderBookmark, setPendingFolderBookmark] = useState<{
      nodeId: string;
      color: string | null;
      isGlobal: boolean;
    } | null>(null);
    const pendingFolderBookmarkRef = useRef<{
      nodeId: string;
      color: string | null;
      isGlobal: boolean;
    } | null>(null);
    const pendingTimeoutRef = useRef<number | null>(null);
    // Timestamp of the last time we entered pending state, used to debounce
    // the double-fire from ItemActions (mousedown + click on same interaction).
    const pendingSetAtRef = useRef<number>(0);

    // Keep ref in sync with state
    const setPending = (
      value: { nodeId: string; color: string | null; isGlobal: boolean } | null,
    ) => {
      pendingFolderBookmarkRef.current = value;
      if (value !== null) pendingSetAtRef.current = performance.now();
      setPendingFolderBookmark(value);
    };

    // ------------------- Item height -------------------
    const fileItemHeight = BASE_ITEM_HEIGHT;

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
    const { fileTreeScrollTopRef, fileTreeExpandedMapRef } =
      useFileRandomiser();

    const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>(
      () => fileTreeExpandedMapRef.current,
    );

    // Keep the ref in sync whenever expandedMap changes
    useEffect(() => {
      fileTreeExpandedMapRef.current = expandedMap;
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

    useEffect(() => {
      const scroller = parentRef.current;
      if (scroller && fileTreeScrollTopRef.current > 0) {
        scroller.scrollTop = fileTreeScrollTopRef.current;
      }
      return () => {
        fileTreeScrollTopRef.current = scroller?.scrollTop ?? 0;
      };
    }, []);

    // ------------------- Flattening -------------------
    const flattenTree = (
      nodes: FileTreeNode[],
      depth = 0,
      map: Record<string, boolean> = expandedMap,
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

    useEffect(() => {
      virtualizer.measure();
    }, [fileItemHeight]);

    const measureElement = useCallback(
      (el: Element | null) => {
        if (el) virtualizer.measureElement(el);
      },
      [virtualizer],
    );

    // ------------------- Smooth Scroll -------------------
    const smoothScrollTo = (target: number, duration = 600) => {
      const scroller = parentRef.current;
      if (!scroller) return;

      if (animationFrameRef.current)
        cancelAnimationFrame(animationFrameRef.current);

      const start = scroller.scrollTop;
      const distance = target - start;
      const startTime = performance.now();

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

    // ── Folder bookmark handler ────────────────────────────────────────────
    // Folder bookmarks overwrite all children, so both local and global require
    // a second click to confirm before applying.
    // NOTE: We match on nodeId + isGlobal only (not color) because the second
    // click cycles to the next color — we confirm whatever color is pending.
    const handleFolderBookmark = (
      node: FileTreeNode,
      color: string | null,
      isGlobal: boolean,
    ) => {
      const nodeId = getNodeId(node);
      const current = pendingFolderBookmarkRef.current;

      if (
        current !== null &&
        current.nodeId === nodeId &&
        current.isGlobal === isGlobal
      ) {
        if (performance.now() - pendingSetAtRef.current < 200) return;
        if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
        const confirmedColor = current.color;
        setPending(null);
        const files = collectFilesUnder(node);
        onBookmarkChangeBulk?.(files, confirmedColor, isGlobal);
        return;
      }

      if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
      setPending({ nodeId, color, isGlobal });
      pendingTimeoutRef.current = window.setTimeout(() => {
        setPending(null);
      }, 3000);
    };

    useEffect(() => {
      return () => {
        if (animationFrameRef.current)
          cancelAnimationFrame(animationFrameRef.current);
        if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
      };
    }, []);

    // ------------------- Expose methods -------------------
    useImperativeHandle(ref, () => ({
      scrollToFile: (fileId: number) => {
        const scroller = parentRef.current;
        if (!scroller) return;

        const newMap = { ...fileTreeExpandedMapRef.current };
        expandParents(fileId, nodes, newMap);

        setExpandedMap(newMap);

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
          smoothScrollTo(targetScrollTop, 450);
        }
      },
      getFlattenedFiles: () =>
        flattenTreeAll(nodes)
          .map((n) => n.node.file)
          .filter((f): f is FileEntry => !!f),
    }));

    const collectFilesUnder = (node: FileTreeNode): FileEntry[] => {
      const files: FileEntry[] = [];
      if (node.file) {
        files.push(node.file);
      }
      if (node.children) {
        for (const child of node.children) {
          files.push(...collectFilesUnder(child));
        }
      }
      return files;
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
      const isPending = pendingFolderBookmark?.nodeId === getNodeId(node);

      // Derive a tint colour from the pending bookmark colour (or a neutral
      // fallback) so the indicator doesn't need an outline at all.
      const pendingColor =
        isPending && pendingFolderBookmark?.color
          ? pendingFolderBookmark.color
          : "var(--mantine-color-blue-5)";

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
            // Subtle left accent + faint background tint instead of an outline
            borderLeft: isPending
              ? `3px solid ${pendingColor}`
              : "3px solid transparent",
            backgroundColor: isCurrent
              ? "var(--mantine-color-blue-light)"
              : isPending
                ? "color-mix(in srgb, currentColor 4%, transparent)"
                : undefined,
            opacity: isExcluded ? 0.5 : 1,
            paddingTop: 4,
            paddingBottom: 4,
            transition: "border-left-color 0.15s, background-color 0.15s",
          }}
          className="item-actions"
        >
          {/* Caret for folders */}
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

          {/* Name + scores */}
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
          </Box>

          {/* File weight */}
          {showWeights && node.file && (
            <WeightButton
              nodePath={node.file.path as unknown as string}
              localPathWeights={localPathWeights}
              globalPathWeights={globalPathWeights}
              onLocalPathWeightChange={onLocalPathWeightChange}
              onGlobalPathWeightChange={onGlobalPathWeightChange}
            />
          )}

          {/* File actions */}
          {node.file && (
            <ItemActions
              bookmarkColors={bookmarkColors}
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

          {/* Folder weight */}
          {showWeights && node.children && (
            <WeightButton
              nodePath={node.path}
              localPathWeights={localPathWeights}
              globalPathWeights={globalPathWeights}
              onLocalPathWeightChange={onLocalPathWeightChange}
              onGlobalPathWeightChange={onGlobalPathWeightChange}
            />
          )}

          {/* Folder actions — with recursive bookmark support */}
          {node.children && (
            <ItemActions
              bookmarkColors={bookmarkColors}
              onOpenFolder={() => randomiserApi.openPath(node.path)}
              onBookmarkChange={(color) =>
                handleFolderBookmark(node, color, false)
              }
              onBookmarkChangeGlobal={(color) =>
                handleFolderBookmark(node, color, true)
              }
              currentBookmark={(() => {
                const nodeId = getNodeId(node);
                if (pendingFolderBookmark?.nodeId === nodeId) {
                  return {
                    color: pendingFolderBookmark.color,
                    isGlobal: pendingFolderBookmark.isGlobal,
                  };
                }
                const files = collectFilesUnder(node);
                if (!files.length) return undefined;
                const first = files[0].bookmark;
                const allSame = files.every(
                  (f) =>
                    f.bookmark?.color === first?.color &&
                    f.bookmark?.isGlobal === first?.isGlobal,
                );
                return allSame ? first : undefined;
              })()}
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
