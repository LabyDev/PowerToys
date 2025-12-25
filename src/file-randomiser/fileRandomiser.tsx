import { ActionIcon, Box, Group, Stack, Text } from "@mantine/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";

import {
  AppStateData,
  PresetState,
  RandomiserPreset,
} from "../types/filerandomiser";
import { useAppSettings } from "../core/hooks/useAppSettings";
import Section from "./section";
import Toolbar from "./toolbar";
import FiltersPanel from "./filtersPanel";
import "./fileRandomiser.css";
import { PlusIcon, TrashIcon } from "@phosphor-icons/react";
import PresetControls from "./presetControls";

import * as presetApi from "../core/api/presetsApi";
import * as randomiserApi from "../core/api/fileRandomiserApi";
import { arraysEqual } from "../core/utilities/deepCompare";

const FileRandomiser = () => {
  const { settings } = useAppSettings();

  const [data, setData] = useState<AppStateData>({
    paths: [],
    files: [],
    history: [],
    filterRules: [],
  });

  const lastAppliedPresetRef = useRef<RandomiserPreset | null>(null);
  const [presets, setPresets] = useState<RandomiserPreset[]>([]);
  const [presetState, setPresetState] = useState<PresetState>({
    currentId: null,
    name: "Untitled",
    dirty: false,
  });

  const [query, setQuery] = useState("");
  const [shuffle, setShuffle] = useState(false);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [tracking, setTracking] = useState(false);

  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const currentIndexRef = useRef<number | null>(null);

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
    if (!settings.allow_process_tracking && tracking) {
      setTracking(false);
    }
  }, [settings.allow_process_tracking, tracking]);

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
      presetState.name === preset.name
    ) {
      // Matches last applied preset exactly → don't mark dirty
      return;
    }

    setPresetState((p) => ({ ...p, dirty: true }));
  }, [data.paths, data.filterRules]);

  // ------------------------ Data Handling ------------------------

  const updateAndRefreshData = async (updatedData?: AppStateData) => {
    if (updatedData) {
      await randomiserApi.updateAppState(updatedData);
    }
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
    await randomiserApi.crawlPaths();
    updateAndRefreshData();
  };

  const handlePickFile = useCallback(async () => {
    if (!data.files.length) return;

    const availableFiles = data.files.filter((f) => !f.excluded);
    if (!availableFiles.length) return;

    let index: number;
    if (shuffle) {
      index = Math.floor(Math.random() * availableFiles.length);
    } else {
      const currentId =
        currentIndexRef.current !== null
          ? data.files[currentIndexRef.current]?.id
          : null;
      const currentAvailableIndex = availableFiles.findIndex(
        (f) => f.id === currentId,
      );
      index =
        currentAvailableIndex === -1
          ? 0
          : (currentAvailableIndex + 1) % availableFiles.length;
    }

    const file = availableFiles[index];
    await randomiserApi.openFileById(file.id);

    const originalIndex = data.files.findIndex((f) => f.id === file.id);
    setCurrentIndex(originalIndex);
    currentIndexRef.current = originalIndex;

    updateAndRefreshData();
  }, [data.files, shuffle]);

  // ------------------------ Preset Handling ------------------------

  const handleNameChange = (newName: string) => {
    setPresetState((p) => ({
      ...p,
      name: newName,
      dirty:
        !lastAppliedPresetRef.current || // no preset yet
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

  return (
    <Box p="md" h="88vh">
      <Stack h="100%" gap="md">
        <Toolbar
          shuffle={shuffle}
          tracking={tracking}
          allowTracking={settings.allow_process_tracking}
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
        <Group align="stretch" grow style={{ flex: 1, minHeight: 0 }}>
          {/* Paths */}
          <Section title={`Paths (${filteredPaths.length})`}>
            <Virtuoso
              data={filteredPaths}
              itemContent={(_, item) => (
                <Group
                  key={item.id}
                  px="sm"
                  py={6}
                  style={{ alignItems: "center", gap: 8 }}
                  className="path-item hoverable"
                >
                  <Stack gap={0} style={{ flex: 1, overflow: "hidden" }}>
                    <Text size="sm" fw={600} lineClamp={1}>
                      {item.name}
                    </Text>
                    <Text size="xs" c="dimmed" lineClamp={1}>
                      {item.path}
                    </Text>
                  </Stack>

                  <ActionIcon
                    color="orange"
                    variant="subtle"
                    className="exclude-icon"
                    onClick={async () => {
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
                  >
                    <PlusIcon size={16} />
                  </ActionIcon>

                  <ActionIcon
                    color="red"
                    variant="subtle"
                    className="trash-icon"
                    onClick={async () => {
                      const removed = await invoke<boolean>("remove_path", {
                        id: item.id,
                      });
                      if (removed) handleCrawl();
                    }}
                  >
                    <TrashIcon size={16} />
                  </ActionIcon>
                </Group>
              )}
            />
          </Section>

          {/* Files */}
          <Section title={`Files (${filteredFiles.length})`}>
            <Virtuoso
              data={filteredFiles}
              ref={virtuosoRef}
              itemContent={(_, item) => (
                <Box
                  px="sm"
                  py={6}
                  className={`file-item hoverable ${
                    item.excluded ? "excluded" : ""
                  }`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    backgroundColor:
                      !shuffle &&
                      currentIndex !== null &&
                      data.files[currentIndex]?.id === item.id
                        ? "var(--mantine-color-blue-light)"
                        : undefined,
                    opacity: item.excluded ? 0.5 : 1,
                  }}
                >
                  <Stack gap={0} style={{ flex: 1, overflow: "hidden" }}>
                    <Text
                      size="sm"
                      lineClamp={1}
                      style={{
                        textDecoration: item.excluded ? "line-through" : "none",
                      }}
                    >
                      {item.name}
                    </Text>
                    <Text size="xs" c="dimmed" lineClamp={1}>
                      {item.path}
                    </Text>
                  </Stack>

                  <ActionIcon
                    color="orange"
                    variant="subtle"
                    className="exclude-icon"
                    onClick={async () => {
                      const rule = {
                        id: crypto.randomUUID(),
                        target: "filename" as const,
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
                  >
                    <PlusIcon size={16} />
                  </ActionIcon>
                </Box>
              )}
            />
          </Section>

          {/* History */}
          <Section title={`History (${filteredHistory.length})`}>
            <Virtuoso
              data={filteredHistory}
              itemContent={(_, item) => (
                <Box px="sm" py={6}>
                  <Text size="sm" lineClamp={1}>
                    {item.name}
                  </Text>
                  <Text size="xs" c="dimmed" lineClamp={1}>
                    {item.path}
                  </Text>
                  <Text size="xs" c="dimmed" tt="italic">
                    Opened at: {new Date(item.openedAt).toLocaleString()}
                  </Text>
                </Box>
              )}
            />
          </Section>
        </Group>
      </Stack>
    </Box>
  );
};

export default FileRandomiser;
