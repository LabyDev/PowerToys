import { Box, Button, Group, LoadingOverlay, Stack, Text } from "@mantine/core";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { dirname } from "@tauri-apps/api/path";
import {
  AppStateData,
  FileEntry,
  FileTreeNode,
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

const FileRandomiser = () => {
  const { settings } = useAppSettings();

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

  // ------------------------ Data Handling ------------------------
  const updateAndRefreshData = async (updatedData?: AppStateData) => {
    if (updatedData) await randomiserApi.updateAppState(updatedData);
    const latest = await randomiserApi.getAppState();
    setData(latest);
  };

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

      setData(latest);

      if (changed) {
        setFreshCrawl(true); // mark for auto-expansion
      }
    } finally {
      setIsCrawling(false);
    }
  };

  const scrollToCurrentFile = (fileId: number) => {
    const element = document.getElementById(`file-${fileId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
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
    setPresetState({ currentId: preset.id, name: preset.name, dirty: false });
    await updateFiltersAndCrawl({
      ...data,
      paths: preset.paths,
      filterRules: preset.filterRules,
    });
  };

  const savePreset = async () => {
    if (!presetState.currentId) return savePresetAs();
    await presetApi.savePreset({
      id: presetState.currentId,
      name: presetState.name,
      paths: data.paths,
      filterRules: data.filterRules,
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
    } as RandomiserPreset);
    setPresetState({ currentId: id, name: presetState.name, dirty: false });
    presetApi.getPresets().then(setPresets);
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

    const convert = (node: Record<string, any>): FileTreeNode[] => {
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
          current = current.children[key];
          nameChain.push(current.name);
          pathChain.push(current.path);
        }

        return {
          name: nameChain.join(seperator),
          path: pathChain[pathChain.length - 1],
          file: current.file,
          children:
            current.children && Object.keys(current.children).length > 0
              ? convert(current.children)
              : undefined,
        };
      });
    };

    return convert(root);
  };

  // ------------------------ Counts ------------------------
  const totalFiles = filteredFiles.length;
  const excludedFiles = filteredFiles.filter((f) => f.excluded).length;
  const includedFiles = totalFiles - excludedFiles;

  return (
    <Box p="md" h="88vh">
      <LoadingOverlay
        visible={isCrawling}
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
            title={`Paths (${filteredPaths.length})`}
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
                <Text>Files</Text>
                <Text size="sm" c="dimmed">
                  ({totalFiles} total,{" "}
                  <Text component="span" c="green">
                    {includedFiles} included
                  </Text>
                  ,{" "}
                  <Text component="span" c="red">
                    {excludedFiles} excluded
                  </Text>
                  )
                </Text>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={toggleTreeCollapsed}
                >
                  {treeCollapsed ? "Expand All" : "Collapse All"}
                </Button>
              </Group>
            }
            className="main-panel"
          >
            <Box style={{ height: "100%", minHeight: 0, overflowY: "auto" }}>
              <FileTree
                nodes={buildFileTree(filteredFiles)}
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
            title={`History (${filteredHistory.length})`}
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
