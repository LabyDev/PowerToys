import {
  ActionIcon,
  Box,
  Button,
  Group,
  LoadingOverlay,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { Virtuoso } from "react-virtuoso";
import { dirname } from "@tauri-apps/api/path";
import { useAppSettings } from "../core/hooks/useAppSettings";
import "./fileRandomiser.css";
import * as presetApi from "../core/api/presetsApi";
import * as randomiserApi from "../core/api/fileRandomiserApi";
import { arraysEqual } from "../core/utilities/deepCompare";
import { sep } from "@tauri-apps/api/path";
import { useFileRandomiser } from "../core/hooks/fileRandomiserStateProvider";
import { useTranslation } from "react-i18next";
import { useDebouncedValue } from "@mantine/hooks";
import { Bookmark, DEFAULT_BOOKMARK_COLOR_OPTIONS } from "../types/common";
import {
  AppStateData,
  RandomiserPreset,
  PresetState,
  FileTreeNode,
  FileEntry,
} from "../types/filerandomiser";
import { TrashIcon } from "@phosphor-icons/react";
import Toolbar from "./components/toolbar";
import ClampedTooltipText from "../common/clampedTooltipText";
import FileTree, { FileTreeHandle } from "./components/tree/fileTree";
import FiltersPanel from "./components/filter/filtersPanel";
import ItemActions from "./components/tree/itemActions";
import PresetControls from "./components/presetControls";
import Section from "../common/section";

const FileRandomiser = () => {
  const { settings, setSettings, globalBookmarks, setGlobalBookmarks } =
    useAppSettings();
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

  const fileTreeRef = useRef<FileTreeHandle>(null);
  const shuffleRef = useRef(shuffle);
  const trackingRef = useRef(tracking);
  const isHandlingFileCloseRef = useRef(false);
  const pendingCloseRef = useRef(false);

  const [showLoading, setShowLoading] = useState(false);
  const loadingTimeoutRef = useRef<number | null>(null);
  const [hasStartedTracking, setHasStartedTracking] = useState(false);
  const [historyHiddenBefore, setHistoryHiddenBefore] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const [bookmarksDirty, setBookmarksDirty] = useState(false);
  const [debouncedDirty] = useDebouncedValue(
    presetState.dirty || bookmarksDirty,
    100, // 100ms delay for visual updates
  );
  const [debouncedAppliedPreset] = useDebouncedValue(
    lastAppliedPresetRef.current,
    100,
  );

  const bookmarkColorHexes = (
    settings.bookmarkColors ?? DEFAULT_BOOKMARK_COLOR_OPTIONS
  ).map((b) => b.hex);

  // ------------------------ Effects ------------------------
  useEffect(() => {
    shuffleRef.current = shuffle;
  }, [shuffle]);
  useEffect(() => {
    trackingRef.current = tracking;
  }, [tracking]);

  useEffect(() => {
    updateAndRefreshData();
    presetApi.getPresets().then(setPresets);
  }, []);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    if (settings.fileRandomiser.allowProcessTracking === false && tracking) {
      setTracking(false);
    }
  }, [settings.fileRandomiser.allowProcessTracking]);

  // Re-apply bookmarks whenever globalBookmarks loads or changes (e.g. after File Auditor updates them)
  useEffect(() => {
    setData((prev) => ({
      ...prev,
      files: applyBookmarks(
        prev.files,
        lastAppliedPresetRef.current?.bookmarks,
      ),
    }));
  }, [globalBookmarks]);

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

  const handleBookmarkChangeBulk = useCallback(
    async (files: FileEntry[], color: string | null, isGlobal: boolean) => {
      const hashes = files.map((f) => f.hash).filter(Boolean) as string[];

      await randomiserApi.updateFileBookmarksBulk(hashes, color, isGlobal);

      if (isGlobal) {
        const existing = globalBookmarks ?? [];
        const withoutThese = existing.filter((b) => !hashes.includes(b.hash));
        const nextGlobal =
          color === null
            ? withoutThese
            : [
                ...withoutThese,
                ...files.map((f) => ({ path: f.path, hash: f.hash, color })),
              ];
        await setGlobalBookmarks(nextGlobal);
      } else {
        const preset = lastAppliedPresetRef.current;
        const existing = preset?.bookmarks ?? presetState.bookmarks ?? [];
        const withoutThese = existing.filter((b) => !hashes.includes(b.hash));
        const nextLocal =
          color === null
            ? withoutThese
            : [
                ...withoutThese,
                ...files.map((f) => ({ path: f.path, hash: f.hash, color })),
              ];
        setPresetState((p) => ({ ...p, bookmarks: nextLocal, dirty: true }));
        if (preset) {
          lastAppliedPresetRef.current = { ...preset, bookmarks: nextLocal };
        }
      }

      // Single state update for all files
      setData((prev) => ({
        ...prev,
        files: prev.files.map((f) => {
          if (!hashes.includes(f.hash)) return f;
          return {
            ...f,
            bookmark: color ? { color, isGlobal } : undefined,
          };
        }),
      }));

      setBookmarksDirty(true);
    },
    [globalBookmarks, setGlobalBookmarks, setData, presetState.bookmarks],
  );

  const handleBookmarkChangeGlobal = useCallback(
    async (file: FileEntry, color: string | null, isGlobal = true) => {
      if (isGlobal) {
        // --- GLOBAL BOOKMARK ---
        const existing = globalBookmarks ?? [];
        const nextGlobalBookmarks =
          color === null
            ? existing.filter((b) => b.hash !== file.hash)
            : [
                ...existing.filter((b) => b.hash !== file.hash),
                { path: file.path, hash: file.hash, color },
              ];

        // persist global bookmarks
        await setGlobalBookmarks(nextGlobalBookmarks);

        // update file immediately
        setData((prev) => ({
          ...prev,
          files: prev.files.map((f) =>
            f.hash === file.hash
              ? {
                  ...f,
                  bookmark: color ? { color, isGlobal: true } : undefined,
                }
              : f,
          ),
        }));

        await randomiserApi.updateFileBookmark(file.hash, color, isGlobal);
        setBookmarksDirty(true);
      } else {
        // --- LOCAL PRESET BOOKMARK ---
        const preset = lastAppliedPresetRef.current;
        const existingPreset = preset?.bookmarks ?? presetState.bookmarks ?? [];

        const nextPresetBookmarks =
          color === null
            ? existingPreset.filter((b) => b.hash !== file.hash)
            : [
                ...existingPreset.filter((b) => b.hash !== file.hash),
                { path: file.path, hash: file.hash, color },
              ];

        // update preset state immediately
        setPresetState((p) => ({
          ...p,
          bookmarks: nextPresetBookmarks,
          dirty: true,
        }));

        // update ref if preset exists
        if (preset) {
          lastAppliedPresetRef.current = {
            ...preset,
            bookmarks: nextPresetBookmarks,
          };
        }

        // update file immediately
        setData((prev) => ({
          ...prev,
          files: prev.files.map((f) =>
            f.hash === file.hash
              ? {
                  ...f,
                  bookmark: color ? { color, isGlobal: false } : undefined,
                }
              : f,
          ),
        }));

        await randomiserApi.updateFileBookmark(file.hash, color, isGlobal);
        setBookmarksDirty(true);
      }
    },
    [globalBookmarks, setGlobalBookmarks, setData, presetState.bookmarks],
  );

  const handleBookmarkChange = useCallback(
    (file: FileEntry, color: string | null) => {
      handleBookmarkChangeGlobal(file, color, false);
    },
    [handleBookmarkChangeGlobal],
  );

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

  const filesStructureEqual = (a: FileEntry[], b: FileEntry[]) => {
    if (a.length !== b.length) return false;

    for (let i = 0; i < a.length; i++) {
      if (a[i].path !== b[i].path) return false;
    }

    return true;
  };

  const handleCrawl = async () => {
    setIsCrawling(true);
    try {
      const globalBms = globalBookmarks ?? [];
      const localBms =
        lastAppliedPresetRef.current?.bookmarks ?? presetState.bookmarks ?? [];
      await randomiserApi.crawlPaths(globalBms, localBms);
      const latest = await randomiserApi.getAppState();

      const structureChanged =
        !filesStructureEqual(latest.files, data.files) ||
        !arraysEqual(latest.paths, data.paths);

      const preset = lastAppliedPresetRef.current;

      setData({
        ...latest,
        files: applyBookmarks(latest.files, preset?.bookmarks),
      });

      if (structureChanged) {
        setFreshCrawl(true);
      }
    } finally {
      setIsCrawling(false);
    }
  };

  const handlePickFile = useCallback(async () => {
    if (!data.files.length) return;

    const isTracking = trackingRef.current;
    const isShuffle = shuffleRef.current;

    // Only mark as started if tracking is actually enabled
    if (isTracking && !hasStartedTracking) {
      setHasStartedTracking(true);
    }

    let file: FileEntry | undefined;

    if (isShuffle) {
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
      if (file) await randomiserApi.openFileById(file.id);
    }

    const originalIndex = data.files.findIndex((f) => f.id === file?.id);
    setCurrentIndex(originalIndex);
    currentIndexRef.current = originalIndex;

    updateAndRefreshData();
    if (file?.id) fileTreeRef.current?.scrollToFile(file.id);
  }, [data.files, shuffle, tracking, hasStartedTracking]);

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    listen("file-closed", async () => {
      if (isHandlingFileCloseRef.current) {
        pendingCloseRef.current = true;
        return;
      }
      isHandlingFileCloseRef.current = true;
      try {
        if (trackingRef.current) {
          await handlePickFile();
        } else {
          setHasStartedTracking(false);
        }
      } finally {
        isHandlingFileCloseRef.current = false;
        if (pendingCloseRef.current) {
          pendingCloseRef.current = false;
          if (trackingRef.current) handlePickFile();
        }
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => unlisten?.();
  }, [handlePickFile]);

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
      dirty: false, // freshly applied preset -> not dirty
      bookmarks: preset.bookmarks,
    });

    randomiserApi.setPresetPathWeights(preset.pathWeights ?? {});

    await updateFiltersAndCrawl({
      ...data,
      paths: preset.paths,
      filterRules: preset.filterRules,
    });
  };

  const savePreset = async () => {
    const preset = lastAppliedPresetRef.current;

    // No current preset ID or name changed -> save as new
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
      pathWeights: preset?.pathWeights ?? {},
    } as RandomiserPreset);

    // Update ref
    lastAppliedPresetRef.current = {
      id: presetState.currentId,
      name: presetState.name,
      paths: data.paths,
      filterRules: data.filterRules,
      bookmarks: preset?.bookmarks ?? [],
      shuffle,
      pathWeights: preset?.pathWeights ?? {},
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
      pathWeights: lastAppliedPresetRef.current?.pathWeights ?? {},
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
    const base = data.history.filter((h) => {
      if (new Date(h.openedAt) <= historyHiddenBefore) return false;
      if (!q) return true;
      return (
        h.name.toLowerCase().includes(q) || h.path.toLowerCase().includes(q)
      );
    });
    return [...base].sort(
      (a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime(),
    );
  }, [data.history, q, historyHiddenBefore]);

  // ------------------------ Tree Builder ------------------------
  const buildFileTree = (files: FileEntry[]): FileTreeNode[] => {
    const root: Record<string, any> = {};
    const separator = sep();
    files.forEach((file) => {
      const parts = file.path.split(separator);
      let current = root;

      parts.forEach((part, i) => {
        if (!current[part]) {
          current[part] = {
            name: part,
            path: parts.slice(0, i + 1).join(separator),
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
    <Box p="md" h="92vh">
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
          allowTracking={settings?.fileRandomiser?.allowProcessTracking}
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
                      const removed = await randomiserApi.removePath(item.id);
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
                nodes={fileTreeNodes}
                bookmarkColors={bookmarkColorHexes}
                setFreshCrawl={setFreshCrawl}
                showWeights={
                  settings.fileRandomiser.pathWeightsEnabled ?? false
                }
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
                onBookmarkChangeBulk={handleBookmarkChangeBulk}
                // Pass these to FileTree:
                localPathWeights={
                  lastAppliedPresetRef.current?.pathWeights ?? {}
                }
                globalPathWeights={settings.fileRandomiser.pathWeights ?? {}}
                onLocalPathWeightChange={(path, weight) => {
                  const preset = lastAppliedPresetRef.current;
                  const next = {
                    ...(preset?.pathWeights ?? {}),
                    [path]: weight,
                  };
                  if (preset)
                    lastAppliedPresetRef.current = {
                      ...preset,
                      pathWeights: next,
                    };
                  randomiserApi.setPresetPathWeights(next);
                  setPresetState((p) => ({ ...p, dirty: true }));
                }}
                onGlobalPathWeightChange={(path, weight) => {
                  setSettings({
                    fileRandomiser: {
                      ...settings.fileRandomiser,
                      pathWeights: {
                        ...(settings.fileRandomiser.pathWeights ?? {}),
                        [path]: weight,
                      },
                    },
                  });
                }}
              />
            </Box>
          </Section>

          {/* History */}
          <Section
            title={
              <Group gap="xs" align="center">
                <Text>
                  {t("fileRandomiser.history")} ({filteredHistory.length})
                </Text>
                <Tooltip label={t("fileRandomiser.clearHistory")} withArrow>
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    color="red"
                    onClick={() => setHistoryHiddenBefore(new Date())}
                  >
                    <TrashIcon size={12} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            }
            className="side-panel"
          >
            <Virtuoso
              data={filteredHistory}
              itemContent={(_, item) => {
                const file = data.files.find((f) => f.path === item.path);
                const isGlobal = file?.bookmark?.isGlobal;
                const color = file?.bookmark?.color;

                return (
                  <Group
                    px="sm"
                    py={6}
                    align="center"
                    gap={8}
                    className="item-actions"
                    style={{
                      position: "relative",
                      cursor: file ? "pointer" : "default",
                    }}
                    onClick={(e) => {
                      if (
                        file &&
                        !(e.target as HTMLElement).closest(".item-action")
                      ) {
                        fileTreeRef.current?.scrollToFile(file.id);
                      }
                    }}
                  >
                    {/* Integrated Strip: Bookmark Color + Blue Global Accent */}
                    {color && (
                      <Box
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 4,
                          bottom: 4,
                          width: 5,
                          borderRadius: "0 2px 2px 0",
                          background: isGlobal
                            ? `linear-gradient(to bottom, 
                              var(--mantine-color-blue-6) 0%, 
                              var(--mantine-color-blue-6) 30%, 
                              rgba(0,0,0,0.2) 30%, 
                              rgba(0,0,0,0.2) 35%, 
                              ${color} 35%, 
                              ${color} 100%)`
                            : color,
                        }}
                      />
                    )}

                    <Stack gap={0} style={{ flex: 1, overflow: "hidden" }}>
                      <ClampedTooltipText size="sm" fw={color ? 600 : 400}>
                        {item.name}
                      </ClampedTooltipText>
                      <ClampedTooltipText size="xs" c="dimmed">
                        {item.path}
                      </ClampedTooltipText>
                      <Text size="10px" c="dimmed" fs="italic">
                        {t("fileRandomiser.openedAt")}:{" "}
                        {new Date(item.openedAt).toLocaleString()}
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
                );
              }}
            />
          </Section>
        </Group>
      </Stack>
    </Box>
  );
};

export default FileRandomiser;
