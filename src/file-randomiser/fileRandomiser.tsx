import { Box, Button, Group, LoadingOverlay, Stack, Text } from "@mantine/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { dirname } from "@tauri-apps/api/path";
import {
  AppStateData,
  FileEntry,
  FileTreeNode,
  FlattenedNode,
  RandomiserPreset,
} from "../types/filerandomiser";
import { useAppSettings } from "../core/hooks/useAppSettings";
import Section from "./section";
import Toolbar from "./toolbar";
import FiltersPanel from "./filtersPanel";
import "./fileRandomiser.css";
import PresetControls from "./presetControls";
import * as presetApi from "../core/api/presetsApi";
import * as randomiserApi from "../core/api/fileRandomiserApi";
import { arraysEqual } from "../core/utilities/deepCompare";
import FileTree from "./fileTree";
import ClampedTooltipText from "./clampedTooltipText";
import ItemActions from "./itemActions";
import { sep } from "@tauri-apps/api/path";
import { useFileRandomiser } from "../core/hooks/fileRandomiserStateProvider";
import { useTranslation } from "react-i18next";

const FileRandomiser = () => {
  const { settings } = useAppSettings();
  const { t } = useTranslation();

  const {
    data,
    setData,
    presets,
    setPresets,
    presetState,
    setPresetState,
    lastAppliedPresetRef,
    query,
    setQuery,
    shuffle,
    setShuffle,
    currentIndex,
    setCurrentIndex,
    currentIndexRef,
    tracking,
    setTracking,
    isCrawling,
    setIsCrawling,
    freshCrawl,
    setFreshCrawl,
    treeCollapsed,
    setTreeCollapsed,
  } = useFileRandomiser();

  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const fileTreeVirtuosoRef = useRef<VirtuosoHandle>(null);

  const [showLoading, setShowLoading] = useState(false);
  const loadingTimeoutRef = useRef<number | null>(null);

  // ------------------------ Effects ------------------------
  useEffect(() => {
    updateAndRefreshData();
    presetApi.getPresets().then(setPresets);
  }, []);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    if (!shuffle && currentIndex !== null) {
      virtuosoRef.current?.scrollToIndex({
        index: currentIndex,
        align: "center",
      });
    }
  }, [currentIndex, shuffle]);

  useEffect(() => {
    if (!settings.fileRandomiser.allow_process_tracking && tracking) {
      setTracking(false);
    }
  }, [settings.fileRandomiser.allow_process_tracking, tracking]);

  useEffect(() => {
    if (!tracking) return;
    let unlisten: (() => void) | null = null;

    listen("file-closed", () => {
      handlePickFile();
    }).then((fn) => {
      unlisten = fn;
    });

    return () => unlisten?.();
  }, [tracking]);

  useEffect(() => {
    const preset = lastAppliedPresetRef.current;

    if (
      preset &&
      arraysEqual(data.paths, preset.paths) &&
      arraysEqual(data.filterRules, preset.filterRules) &&
      presetState.name === preset.name &&
      shuffle === preset.shuffle
    ) {
      // Matches last applied preset exactly → don't mark dirty
      return;
    }

    setPresetState((p) => ({ ...p, dirty: true }));
  }, [data.paths, data.filterRules, presetState.name, shuffle]);

  useEffect(() => {
    if (isCrawling) {
      // Set a timeout to show loading after 300ms
      loadingTimeoutRef.current = setTimeout(() => setShowLoading(true), 300);
    } else {
      // Clear timeout and hide loading if finished early
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
      setShowLoading(false);
    }

    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    };
  }, [isCrawling]);

  // Then use `showLoading` for the overlay:
  <LoadingOverlay
    visible={showLoading}
    zIndex={1000}
    overlayProps={{ blur: 2 }}
    loaderProps={{ type: "dots" }}
  />;

  // ------------------------ Data Handling ------------------------
  const updateAndRefreshData = async (updatedData?: AppStateData) => {
    if (updatedData) await randomiserApi.updateAppState(updatedData);
    const latest = await randomiserApi.getAppState();

    const activePreset = lastAppliedPresetRef.current;

    const filesWithBookmarks = applyBookmarks(
      latest.files,
      activePreset?.bookmarks,
    );

    setData({
      ...latest,
      files: filesWithBookmarks,
    });
  };

  const handleBookmarkChange = useCallback(
    (file: FileEntry, color: string | null) => {
      let preset = lastAppliedPresetRef.current;

      if (!preset) {
        // No preset applied yet — create a temporary one in memory
        preset = {
          id: Date.now().toString(), // unique temporary ID
          name: "Untitled",
          paths: [],
          filterRules: [],
          bookmarks: [],
        };
      }

      const existing = preset?.bookmarks ?? [];

      const nextBookmarks =
        color === null
          ? existing.filter((b) => b.path !== file.path)
          : [
              ...existing.filter((b) => b.path !== file.path),
              { path: file.path, color },
            ];

      // Update the ref (source of truth)
      lastAppliedPresetRef.current = {
        ...preset,
        bookmarks: nextBookmarks,
      };

      // Update preset state and file data

      setPresetState((p) => ({ ...p, dirty: true, bookmarks: nextBookmarks }));

      setData((prev) => ({
        ...prev,
        files: prev.files.map((f) =>
          f.id === file.id ? { ...f, bookmarkColor: color } : f,
        ),
      }));
    },
    [setPresetState],
  );

  const updateFiltersAndCrawl = async (updatedData: AppStateData) => {
    await updateAndRefreshData(updatedData);
    await handleCrawl();
  };

  const handleAddPath = async () => {
    await randomiserApi.addPathViaDialog();
    await handleCrawl();
  };

  const handleCrawl = async () => {
    setIsCrawling(true);
    try {
      await randomiserApi.crawlPaths();
      const latest = await randomiserApi.getAppState();

      // Check if data changed
      const changed =
        !arraysEqual(latest.files, data.files) ||
        !arraysEqual(latest.paths, data.paths);

      const preset = lastAppliedPresetRef.current;

      setData({
        ...latest,
        files: applyBookmarks(latest.files, preset?.bookmarks),
      });

      if (changed) {
        setFreshCrawl(true); // mark for auto-expansion
      }
    } finally {
      setIsCrawling(false);
    }
  };

  const scrollToCurrentFile = (fileId: number) => {
    const flatNodes = fileTreeNodes.flatMap((node) => {
      const flatten = (n: FileTreeNode, d: number): FlattenedNode[] => {
        const arr: FlattenedNode[] = [{ node: n, depth: d }];
        const isExpanded = fileTreeVirtuosoRef.current ? true : false; // assume all expanded for index calculation
        if (n.children && isExpanded) {
          n.children.forEach((child) => arr.push(...flatten(child, d + 1)));
        }
        return arr;
      };
      return flatten(node, 0);
    });

    const index = flatNodes.findIndex(
      (n) => n.node.file && n.node.file.id === fileId,
    );

    if (index !== -1) {
      fileTreeVirtuosoRef.current?.scrollToIndex({
        index,
        align: "center",
        behavior: "smooth",
      });
    }
  };

  const handlePickFile = useCallback(async () => {
    if (!data.files.length) return;

    let file;

    if (shuffle) {
      const picked = await randomiserApi.pickRandomFile();
      if (!picked) return;
      file = picked as FileEntry;
    } else {
      const availableFiles = data.files.filter((f) => !f.excluded);
      if (!availableFiles.length) return;

      const currentId =
        currentIndexRef.current !== null
          ? data.files[currentIndexRef.current]?.id
          : null;

      const currentAvailableIndex = availableFiles.findIndex(
        (f) => f.id === currentId,
      );

      const index =
        currentAvailableIndex === -1
          ? 0
          : (currentAvailableIndex + 1) % availableFiles.length;

      file = availableFiles[index];
      await randomiserApi.openFileById(file.id);
    }

    const originalIndex = data.files.findIndex((f) => f.id === file.id);
    setCurrentIndex(originalIndex);
    currentIndexRef.current = originalIndex;

    updateAndRefreshData();

    if (file.id) scrollToCurrentFile(file.id);
  }, [data.files, shuffle]);

  const toggleTreeCollapsed = () => {
    setTreeCollapsed(!treeCollapsed);
  };

  // ------------------------ Preset Handling ------------------------
  const applyBookmarks = (
    files: FileEntry[],
    bookmarks: RandomiserPreset["bookmarks"] | undefined,
  ): FileEntry[] => {
    if (!bookmarks?.length) return files;

    const map = new Map(bookmarks.map((b) => [b.path, b]));

    return files.map((file) => {
      const bm = map.get(file.path);
      return bm ? { ...file, bookmarkColor: bm.color ?? null } : file;
    });
  };

  const handleNameChange = (newName: string) => {
    setPresetState((p) => ({
      ...p,
      name: newName,
      dirty:
        !lastAppliedPresetRef.current ||
        newName !== lastAppliedPresetRef.current.name ||
        !arraysEqual(data.paths, lastAppliedPresetRef.current.paths) ||
        !arraysEqual(
          data.filterRules,
          lastAppliedPresetRef.current.filterRules,
        ),
    }));
  };

  const applyPreset = async (preset: RandomiserPreset) => {
    lastAppliedPresetRef.current = preset;
    setPresetState({
      currentId: preset.id,
      name: preset.name,
      dirty: false,
      bookmarks: preset.bookmarks,
    });
    await updateFiltersAndCrawl({
      ...data,
      paths: preset.paths,
      filterRules: preset.filterRules,
    });
  };

  const savePreset = async () => {
    if (!presetState.currentId) return savePresetAs();

    const preset = lastAppliedPresetRef.current;

    await presetApi.savePreset({
      id: presetState.currentId,
      name: presetState.name,
      paths: data.paths,
      filterRules: data.filterRules,
      bookmarks: preset?.bookmarks ?? [],
      shuffle,
    } as RandomiserPreset);

    setPresetState((p) => ({ ...p, dirty: false }));
    presetApi.getPresets().then(setPresets);
  };

  const savePresetAs = async () => {
    const id = crypto.randomUUID();

    await presetApi.savePreset({
      id,
      name: presetState.name || "New preset",
      paths: data.paths,
      filterRules: data.filterRules,
      bookmarks: presetState?.bookmarks ?? [],
      shuffle,
    } as RandomiserPreset);

    setPresetState({
      currentId: id,
      name: presetState.name,
      dirty: false,
      bookmarks: presetState?.bookmarks,
    });
    presetApi.getPresets().then(setPresets);
  };

  const handleClearPreset = async () => {
    lastAppliedPresetRef.current = null;

    setPresetState({
      currentId: null,
      name: "Untitled",
      dirty: false,
      bookmarks: [],
    });

    await updateFiltersAndCrawl({
      ...data,
      paths: [],
      filterRules: [],
    });
  };

  const openPresetsFolder = () => {
    presetApi.openPresetsFolder();
  };

  // ------------------------ Filtering ------------------------
  const q = query.toLowerCase();

  const filteredPaths = useMemo(() => {
    if (!q) return data.paths;
    return data.paths.filter(
      (p) =>
        p.name.toLowerCase().includes(q) || p.path.toLowerCase().includes(q),
    );
  }, [data.paths, q]);

  const filteredFiles = useMemo(() => {
    if (!q) return data.files;
    return data.files.filter(
      (f) =>
        f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q),
    );
  }, [data.files, q]);

  const filteredHistory = useMemo(() => {
    const base = q
      ? data.history.filter(
          (h) =>
            h.name.toLowerCase().includes(q) ||
            h.path.toLowerCase().includes(q),
        )
      : data.history;
    return [...base].sort(
      (a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime(),
    );
  }, [data.history, q]);

  // ------------------------ Tree Builder ------------------------
  const buildFileTree = (files: FileEntry[]): FileTreeNode[] => {
    const root: Record<string, any> = {};
    const seperator = sep();
    files.forEach((file) => {
      const parts = file.path.split(seperator);
      let current = root;

      parts.forEach((part, i) => {
        if (!current[part]) {
          current[part] = {
            name: part,
            path: parts.slice(0, i + 1).join(seperator),
            children: {},
          };
        }
        if (i === parts.length - 1) current[part].file = file;
        current = current[part].children;
      });
    });

    const convert = (
      node: Record<string, any>,
      depth: number,
    ): FileTreeNode[] => {
      return Object.values(node).map((n) => {
        let current = n;
        const nameChain = [current.name];
        const pathChain = [current.path];

        while (
          current.file === undefined &&
          current.children &&
          Object.keys(current.children).length === 1
        ) {
          const key = Object.keys(current.children)[0];
          const child = current.children[key];

          // STOP flattening if the only child has a file
          if (child.file) break;

          current = child;
          nameChain.push(current.name);
          pathChain.push(current.path);
        }

        return {
          name: nameChain.join(seperator),
          path: pathChain[pathChain.length - 1],
          file: current.file,
          depth,
          children:
            current.children && Object.keys(current.children).length > 0
              ? convert(current.children, depth + 1)
              : undefined,
        };
      });
    };

    return convert(root, 0);
  };

  // ------------------------ Counts ------------------------
  const totalFiles = filteredFiles.length;
  const excludedFiles = filteredFiles.filter((f) => f.excluded).length;
  const includedFiles = totalFiles - excludedFiles;

  const fileTreeNodes = useMemo(
    () => buildFileTree(filteredFiles),
    [filteredFiles],
  );

  return (
    <Box p="md" h="94vh">
      <LoadingOverlay
        visible={showLoading}
        zIndex={1000}
        overlayProps={{ blur: 2 }}
        loaderProps={{ type: "dots" }}
      />
      <Stack h="100%" gap="md">
        <Toolbar
          shuffle={shuffle}
          tracking={tracking}
          allowTracking={settings?.fileRandomiser?.allow_process_tracking}
          query={query}
          onAddPath={handleAddPath}
          onCrawl={handleCrawl}
          onPickFile={handlePickFile}
          onShuffleChange={setShuffle}
          onTrackingChange={setTracking}
          onQueryChange={setQuery}
          presetControls={
            <PresetControls
              presets={presets}
              name={presetState.name}
              dirty={presetState.dirty}
              onNameChange={handleNameChange}
              onSelect={applyPreset}
              onSave={savePreset}
              onOpenFolder={openPresetsFolder}
              onPresetClear={handleClearPreset}
            />
          }
        />

        {/* Filters */}
        <FiltersPanel data={data} updateData={updateFiltersAndCrawl} />

        {/* Main content */}
        <Group
          className="main-content"
          align="stretch"
          style={{ flex: 1, minHeight: 0 }}
        >
          {/* Paths */}
          <Section
            title={t("fileRandomiser.paths") + ` (${filteredPaths.length})`}
            className="side-panel"
          >
            <Virtuoso
              data={filteredPaths}
              itemContent={(_, item) => (
                <Group
                  key={item.id}
                  px="sm"
                  py={6}
                  style={{ alignItems: "center", gap: 8 }}
                  className="item-actions"
                >
                  <Stack gap={0} style={{ flex: 1, overflow: "hidden" }}>
                    <ClampedTooltipText size="sm" fw={600}>
                      {item.name}
                    </ClampedTooltipText>
                    <ClampedTooltipText size="xs" c="dimmed">
                      {item.path}
                    </ClampedTooltipText>
                  </Stack>

                  <ItemActions
                    onOpenFolder={() => randomiserApi.openPath(item.path)}
                    onExclude={async () => {
                      const rule = {
                        id: crypto.randomUUID(),
                        target: "folder" as const,
                        action: "exclude" as const,
                        type: "contains" as const,
                        pattern: item.name,
                        caseSensitive: false,
                      };
                      await updateAndRefreshData({
                        ...data,
                        filterRules: [...data.filterRules, rule],
                      });
                      handleCrawl();
                    }}
                    onRemove={async () => {
                      const removed = await invoke<boolean>("remove_path", {
                        id: item.id,
                      });
                      if (removed) handleCrawl();
                    }}
                  />
                </Group>
              )}
            />
          </Section>

          {/* Files */}
          <Section
            title={
              <Group gap="xs">
                <Text>{t("fileRandomiser.files")}</Text>
                <Text size="sm" c="dimmed">
                  ({totalFiles} {t("fileRandomiser.total")},{" "}
                  <Text component="span" c="green">
                    {includedFiles} {t("fileRandomiser.included")}
                  </Text>
                  ,{" "}
                  <Text component="span" c="red">
                    {excludedFiles} {t("fileRandomiser.excluded")}
                  </Text>
                  )
                </Text>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={toggleTreeCollapsed}
                >
                  {treeCollapsed
                    ? t("fileRandomiser.expandAll")
                    : t("fileRandomiser.collapseAll")}
                </Button>
              </Group>
            }
            className="main-panel"
          >
            <Box style={{ height: "100%", minHeight: 0, overflowY: "auto" }}>
              <FileTree
                virtuosoRef={fileTreeVirtuosoRef}
                nodes={fileTreeNodes}
                onExclude={async (file) => {
                  const rule = {
                    id: crypto.randomUUID(),
                    target: "filename" as const,
                    action: "exclude" as const,
                    type: "contains" as const,
                    pattern: file.name,
                    caseSensitive: false,
                  };
                  await updateAndRefreshData({
                    ...data,
                    filterRules: [...data.filterRules, rule],
                  });
                  handleCrawl();
                }}
                onBookmarkChange={handleBookmarkChange}
                currentFileId={
                  currentIndex !== null ? data.files[currentIndex]?.id : null
                }
                freshCrawl={freshCrawl}
                treeCollapsed={treeCollapsed}
              />
            </Box>
          </Section>

          {/* History */}
          <Section
            title={t("fileRandomiser.history") + ` (${filteredHistory.length})`}
            className="side-panel"
          >
            <Virtuoso
              data={filteredHistory}
              itemContent={(_, item) => (
                <Group
                  px="sm"
                  py={6}
                  align="center"
                  gap={8}
                  className="item-actions"
                >
                  <Stack gap={0} style={{ flex: 1, overflow: "hidden" }}>
                    <ClampedTooltipText size="sm">
                      {item.name}
                    </ClampedTooltipText>
                    <ClampedTooltipText size="xs" c="dimmed">
                      {item.path}
                    </ClampedTooltipText>
                    <Text size="xs" c="dimmed" tt="italic">
                      Opened at: {new Date(item.openedAt).toLocaleString()}
                    </Text>
                  </Stack>
                  <ItemActions
                    onOpen={async () => randomiserApi.openPath(item.path)}
                    onOpenFolder={async () => {
                      const folder = await dirname(item.path);
                      randomiserApi.openPath(folder);
                    }}
                  />
                </Group>
              )}
            />
          </Section>
        </Group>
      </Stack>
    </Box>
  );
};

export default FileRandomiser;
