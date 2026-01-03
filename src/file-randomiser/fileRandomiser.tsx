import { Box, Button, Group, LoadingOverlay, Stack, Text } from "@mantine/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { dirname } from "@tauri-apps/api/path";
import {
  AppStateData,
  Bookmark,
  FileEntry,
  FileTreeNode,
  PresetState,
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
import FileTree, { FileTreeHandle } from "./fileTree";
import ClampedTooltipText from "./clampedTooltipText";
import ItemActions from "./itemActions";
import { sep } from "@tauri-apps/api/path";
import { useFileRandomiser } from "../core/hooks/fileRandomiserStateProvider";
import { useTranslation } from "react-i18next";
import { useDebouncedValue } from "@mantine/hooks";

const FileRandomiser = () => {
  const { settings, globalBookmarks, setGlobalBookmarks } = useAppSettings();
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

  const fileTreeVirtuosoRef = useRef<VirtuosoHandle>(null);
  const fileTreeRef = useRef<FileTreeHandle>(null);

  const [showLoading, setShowLoading] = useState(false);
  const loadingTimeoutRef = useRef<number | null>(null);
  const [hasStartedTracking, setHasStartedTracking] = useState(false);

  const [bookmarksDirty, setBookmarksDirty] = useState(false);
  const [debouncedDirty] = useDebouncedValue(
    presetState.dirty || bookmarksDirty,
    100, // 100ms delay for visual updates
  );
  const [debouncedAppliedPreset] = useDebouncedValue(
    lastAppliedPresetRef.current,
    100,
  );

  // ------------------------ Effects ------------------------
  useEffect(() => {
    updateAndRefreshData();
    presetApi.getPresets().then(setPresets);
  }, []);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    if (!settings.fileRandomiser.allow_process_tracking && tracking) {
      setTracking(false);
    }
  }, [settings.fileRandomiser.allow_process_tracking, tracking]);

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    listen("file-closed", async () => {
      if (tracking) {
        await handlePickFile();
      } else {
        // Tracking is off → reset hasStartedTracking now that file is closed
        setHasStartedTracking(false);
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => unlisten?.();
  }, [tracking]);

  useEffect(() => {
    const preset = lastAppliedPresetRef.current;
    setPresetState((p) => ({
      ...p,
      // only recalc dirty based on name, paths, rules, shuffle
      dirty: isPresetDirty(
        preset,
        data,
        { ...p, bookmarks: preset?.bookmarks ?? [] },
        shuffle,
      ),
    }));
  }, [data, presetState.name, shuffle]);

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

  const handleBookmarkChangeGlobal = useCallback(
    async (file: FileEntry, color: string | null, isGlobal = true) => {
      const existing = globalBookmarks ?? [];

      // Compute next global bookmarks
      const nextGlobalBookmarks =
        color === null
          ? existing.filter((b) => b.hash !== file.hash)
          : [
              ...existing.filter((b) => b.hash !== file.hash),
              { path: file.path, hash: file.hash, color },
            ];

      // Persist global bookmarks
      await setGlobalBookmarks(nextGlobalBookmarks);

      // Update preset bookmarks if it's a local bookmark
      if (!isGlobal) {
        const preset = lastAppliedPresetRef.current;
        const existingPreset = preset?.bookmarks ?? [];

        const nextPresetBookmarks =
          color === null
            ? existingPreset.filter((b) => b.hash !== file.hash)
            : [
                ...existingPreset.filter((b) => b.hash !== file.hash),
                { path: file.path, hash: file.hash, color },
              ];

        setPresetState((p) => ({ ...p, bookmarks: nextPresetBookmarks }));

        if (preset) {
          lastAppliedPresetRef.current = {
            ...preset,
            bookmarks: nextPresetBookmarks,
          };
        }
      }

      // Update files data so UI reflects bookmark
      setData((prev) => ({
        ...prev,
        files: prev.files.map((f) =>
          f.hash === file.hash ? { ...f, bookmark: { color, isGlobal } } : f,
        ),
      }));
    },
    [globalBookmarks, setGlobalBookmarks, setData],
  );

  const handleBookmarkChange = useCallback(
    (file: FileEntry, color: string | null) => {
      handleBookmarkChangeGlobal(file, color, false);
    },
    [handleBookmarkChangeGlobal],
  );

  // Handle bookmark change globally
  const handleBookmarkChangeGlobalDirect = useCallback(
    (file: FileEntry, color: string | null) => {
      handleBookmarkChangeGlobal(file, color, true);
    },
    [handleBookmarkChangeGlobal],
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

  const handlePickFile = useCallback(async () => {
    if (!data.files.length) return;

    // Only mark as started if tracking is actually enabled
    if (tracking && !hasStartedTracking) {
      setHasStartedTracking(true);
    }

    let file: FileEntry | undefined;

    if (shuffle) {
      const picked = await randomiserApi.pickRandomFile();
      if (!picked) return;
      file = picked as FileEntry;
    } else {
      const treeFiles = fileTreeRef.current
        ?.getFlattenedFiles()
        .filter((f) => !f.excluded);
      if (!treeFiles || !treeFiles.length) return;

      const currentId =
        currentIndexRef.current !== null
          ? data.files[currentIndexRef.current]?.id
          : null;

      const currentIndexInTree = treeFiles.findIndex((f) => f.id === currentId);

      const nextIndex =
        currentIndexInTree === -1
          ? 0
          : (currentIndexInTree + 1) % treeFiles.length;

      file = treeFiles[nextIndex];
      await randomiserApi.openFileById(file.id);
    }

    const originalIndex = data.files.findIndex((f) => f.id === file.id);
    setCurrentIndex(originalIndex);
    currentIndexRef.current = originalIndex;

    updateAndRefreshData();
    if (file.id) fileTreeRef.current?.scrollToFile(file.id);
  }, [data.files, shuffle, tracking, hasStartedTracking]);

  const toggleTreeCollapsed = () => {
    setTreeCollapsed(!treeCollapsed);
  };

  // ------------------------ Preset Handling ------------------------
  // Merge global bookmarks with active preset bookmarks when displaying files
  const applyBookmarks = (
    files: FileEntry[],
    bookmarks?: Bookmark[],
  ): FileEntry[] => {
    const mergedBookmarks = [
      ...(bookmarks?.map((b) => ({ ...b, isGlobal: false })) ?? []),
      ...(globalBookmarks?.map((b) => ({ ...b, isGlobal: true })) ?? []),
    ];

    if (!mergedBookmarks.length)
      return files.map((f) => ({ ...f, bookmark: undefined }));

    const map = new Map(mergedBookmarks.map((b) => [b.hash, b]));

    return files.map((f) => {
      const bm = map.get(f.hash);
      return {
        ...f,
        bookmark: bm
          ? { color: bm.color ?? null, isGlobal: bm.isGlobal } // BookmarkInfo
          : undefined, // use undefined instead of null
      };
    });
  };

  const handleNameChange = (newName: string) => {
    setPresetState((p) => {
      const updated = { ...p, name: newName };
      updated.dirty = isPresetDirty(
        lastAppliedPresetRef.current,
        data,
        updated,
        shuffle,
      );
      return updated;
    });
  };

  const applyPreset = async (preset: RandomiserPreset) => {
    lastAppliedPresetRef.current = preset;

    setPresetState({
      currentId: preset.id,
      name: preset.name,
      dirty: false, // freshly applied preset → not dirty
      bookmarks: preset.bookmarks,
    });

    await updateFiltersAndCrawl({
      ...data,
      paths: preset.paths,
      filterRules: preset.filterRules,
    });
  };

  const savePreset = async () => {
    const preset = lastAppliedPresetRef.current;

    // No current preset ID or name changed → save as new
    if (!presetState.currentId || presetState.name !== preset?.name) {
      return savePresetAs();
    }

    await presetApi.savePreset({
      id: presetState.currentId,
      name: presetState.name,
      paths: data.paths,
      filterRules: data.filterRules,
      bookmarks: preset?.bookmarks ?? [],
      shuffle,
    } as RandomiserPreset);

    // Update ref
    lastAppliedPresetRef.current = {
      id: presetState.currentId,
      name: presetState.name,
      paths: data.paths,
      filterRules: data.filterRules,
      bookmarks: preset?.bookmarks ?? [],
      shuffle,
    };

    setPresetState((p) => ({
      ...p,
      dirty: false,
      bookmarks: preset?.bookmarks ?? [],
    }));
    setBookmarksDirty(false);

    presetApi.getPresets().then(setPresets);
  };

  const savePresetAs = async () => {
    const id = crypto.randomUUID();

    const newPreset: RandomiserPreset = {
      id,
      name: presetState.name || "New preset",
      paths: data.paths,
      filterRules: data.filterRules,
      bookmarks: presetState?.bookmarks ?? [],
      shuffle,
    };

    await presetApi.savePreset(newPreset);

    // Update ref and state
    lastAppliedPresetRef.current = newPreset;

    setPresetState({
      currentId: id,
      name: newPreset.name,
      dirty: false,
      bookmarks: newPreset.bookmarks,
    });
    setBookmarksDirty(false);

    presetApi.getPresets().then(setPresets);
  };

  const handleClearPreset = async () => {
    lastAppliedPresetRef.current = null;

    setPresetState({
      currentId: null,
      name: "Untitled",
      dirty: true, // always dirty when no preset applied
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

  const isPresetDirty = (
    preset: RandomiserPreset | null,
    currentData: AppStateData,
    presetState: PresetState,
    shuffle: boolean,
  ): boolean => {
    if (!preset) return true; // Untitled → always dirty

    return (
      presetState.name !== preset.name ||
      !arraysEqual(currentData.paths, preset.paths) ||
      !arraysEqual(currentData.filterRules, preset.filterRules) ||
      shuffle !== preset.shuffle ||
      !arraysEqual(presetState.bookmarks ?? [], preset.bookmarks ?? [])
    );
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

        // Add leading separator for folders
        const joinedName =
          !current.file && depth > 0
            ? sep() + nameChain.join(sep())
            : nameChain.join(sep());

        return {
          name: joinedName,
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
          hasStartedTracking={hasStartedTracking}
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
              dirty={debouncedDirty}
              onNameChange={handleNameChange}
              onSelect={applyPreset}
              onSave={savePreset}
              onOpenFolder={openPresetsFolder}
              onPresetClear={handleClearPreset}
              appliedPreset={debouncedAppliedPreset}
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
                ref={fileTreeRef}
                virtuosoRef={fileTreeVirtuosoRef}
                nodes={fileTreeNodes}
                setFreshCrawl={setFreshCrawl}
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
                onBookmarkChangeGlobal={handleBookmarkChangeGlobalDirect}
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
