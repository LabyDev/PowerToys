import { useState, useEffect, useRef } from "react";
import {
  Box,
  Group,
  Stack,
  LoadingOverlay,
  Badge,
  ScrollArea,
  Code,
  Slider,
  Text,
  Divider,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import Section from "../file-randomiser/section";
import FileSorterToolbar from "./toolbar";
import FiltersPanel from "../file-randomiser/filtersPanel";
import { FilterRule } from "../types/common";
import { FileSorterState } from "../types/filesorter";
import SortPreviewTree from "./sortPreviewTree";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { buildSortPreviewTree } from "../core/utilities/buildSortPreviewTree";
import ConsolePanel from "./consolePanel";

const FileSorter = () => {
  const [showLoading, setShowLoading] = useState(false);
  const [state, setState] = useState<FileSorterState>({
    currentPath: null,
    similarityThreshold: 60,
    filterRules: [],
    preview: [],
    stats: { filesToMove: 0, foldersToCreate: 0 },
    hasRestorePoint: false,
    files: [],
  });

  // Local slider value for instant UI response
  const [similarity, setSimilarity] = useState(state.similarityThreshold);
  const [debouncedSimilarity] = useDebouncedValue(similarity, 300);

  // Guards to avoid noisy logs
  const lastSliderLogRef = useRef<number | null>(null);

  const logFrontend = (message: string) => {
    emit("file_sorter_log", `[ui] ${message}`);
  };

  // Fetch initial state from backend
  const fetchState = async () => {
    logFrontend("Fetching sorter state");
    const backendState: FileSorterState = await invoke("get_sorter_state");
    setState(backendState);
    setSimilarity(backendState.similarityThreshold);
    logFrontend("Sorter state loaded");
  };

  useEffect(() => {
    fetchState();
  }, []);

  // Slider UI logging (immediate, deduped)
  useEffect(() => {
    if (lastSliderLogRef.current === similarity) return;
    lastSliderLogRef.current = similarity;
    logFrontend(`Similarity threshold set to ${similarity}%`);
  }, [similarity]);

  // Slider change -> update backend (debounced) and refresh preview
  useEffect(() => {
    const updateBackend = async () => {
      if (!state.currentPath) return;

      logFrontend(
        `Applying similarity threshold (${debouncedSimilarity}%) to backend`,
      );

      setShowLoading(true);
      try {
        await invoke("set_similarity_threshold", {
          threshold: debouncedSimilarity,
        });

        logFrontend("Refreshing sort preview");
        const updatedState: FileSorterState = await invoke("get_sort_preview");
        setState(updatedState);
        logFrontend("Sort preview updated");
      } finally {
        setShowLoading(false);
      }
    };

    updateBackend();
  }, [debouncedSimilarity, state.currentPath]);

  const handleSelectFolder = async () => {
    logFrontend("Opening directory picker");
    const path = await invoke<string | null>("select_sort_directory");
    if (path) {
      setState((prev) => ({ ...prev, currentPath: path }));
      logFrontend("Directory selected");
    } else {
      logFrontend("Directory selection cancelled");
    }
  };

  const handleSort = async () => {
    if (!state.currentPath) return;
    logFrontend("Starting file sort");
    setShowLoading(true);
    try {
      await invoke("sort_files");
      logFrontend("File sort completed");
      await fetchState();
    } finally {
      setShowLoading(false);
    }
  };

  const handleRestore = async () => {
    logFrontend("Restoring last sort");
    setShowLoading(true);
    try {
      await invoke("restore_last_sort");
      logFrontend("Restore completed");
      await fetchState();
    } finally {
      setShowLoading(false);
    }
  };

  const updateFilters = async (rules: FilterRule[]) => {
    setState((prev) => ({ ...prev, filterRules: rules }));
    logFrontend(`Updated ${rules.length} filter rule(s)`);
  };

  const previewTree = state.currentPath
    ? buildSortPreviewTree(state.currentPath, state.files, state.preview)
    : null;

  return (
    <Box p="md" h="94vh">
      <LoadingOverlay visible={showLoading} />

      <Stack h="100%" gap="md">
        <FileSorterToolbar
          currentPath={state.currentPath}
          onSelectFolder={handleSelectFolder}
          onSort={handleSort}
          onRestore={handleRestore}
          onRefresh={() => {}}
          hasRestorePoint={state.hasRestorePoint}
          onQueryChange={() => {}}
        />

        <FiltersPanel
          data={{ filterRules: state.filterRules }}
          updateData={async (u) => updateFilters(u.filterRules)}
        />

        <Group align="stretch" style={{ flex: 1, minHeight: 0 }} wrap="nowrap">
          <Section title="Processing Preview" style={{ flex: 1 }}>
            <ScrollArea h="100%" p="xs">
              {previewTree ? (
                <SortPreviewTree
                  root={previewTree.root}
                  plannedMovesBySource={previewTree.plannedMovesBySource}
                />
              ) : (
                <Code block>
                  {state.currentPath
                    ? "Ready to generate preview"
                    : "Select a directory."}
                </Code>
              )}
            </ScrollArea>
          </Section>

          <Section title="Configuration" style={{ width: 250 }}>
            <Stack gap="md">
              <Box>
                <Text size="sm" fw={500} mb="xs">
                  Match Threshold: {similarity}%
                </Text>
                <Slider
                  value={similarity}
                  onChange={setSimilarity}
                  min={10}
                  max={100}
                  step={5}
                />
              </Box>
              <Divider label="Stats" labelPosition="center" />
              <Stack gap="xs">
                <Badge variant="light" fullWidth size="lg">
                  Files to Move: {state.stats.filesToMove}
                </Badge>
                <Badge color="cyan" variant="light" fullWidth size="lg">
                  New Folders: {state.stats.foldersToCreate}
                </Badge>
              </Stack>
            </Stack>
          </Section>
        </Group>

        <ConsolePanel currentPath={state.currentPath} />
      </Stack>
    </Box>
  );
};

export default FileSorter;
