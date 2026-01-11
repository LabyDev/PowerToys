import { useState, useEffect } from "react";
import {
  Box,
  Group,
  Stack,
  LoadingOverlay,
  Badge,
  ScrollArea,
  Code,
  Paper,
  Slider,
  Text,
  Divider,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { TerminalIcon } from "@phosphor-icons/react";
import Section from "../file-randomiser/section";
import FileSorterToolbar from "./toolbar";
import FiltersPanel from "../file-randomiser/filtersPanel";
import { FilterRule } from "../types/common";
import { FileSorterState } from "../types/filesorter";
import SortPreviewTree from "./sortPreviewTree";
import { invoke } from "@tauri-apps/api/core";
import { buildSortPreviewTree } from "../core/utilities/buildSortPreviewTree";

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

  // Fetch initial state from backend
  const fetchState = async () => {
    const backendState: FileSorterState = await invoke("get_sorter_state");
    setState(backendState);
    setSimilarity(backendState.similarityThreshold);
  };

  useEffect(() => {
    fetchState();
  }, []);

  // Slider change -> update backend (debounced) and refresh preview
  useEffect(() => {
    const updateBackend = async () => {
      if (!state.currentPath) return;
      setShowLoading(true);
      try {
        await invoke("set_similarity_threshold", {
          threshold: debouncedSimilarity,
        });
        const updatedState: FileSorterState = await invoke("get_sort_preview");
        setState(updatedState);
      } finally {
        setShowLoading(false);
      }
    };

    updateBackend();
  }, [debouncedSimilarity, state.currentPath]);

  const handleSelectFolder = async () => {
    const path = await invoke<string | null>("select_sort_directory");
    if (path) {
      setState((prev) => ({ ...prev, currentPath: path }));
    }
  };

  const handleSort = async () => {
    if (!state.currentPath) return;
    setShowLoading(true);
    try {
      await invoke("sort_files");
      await fetchState();
    } finally {
      setShowLoading(false);
    }
  };

  const handleRestore = async () => {
    setShowLoading(true);
    try {
      await invoke("restore_last_sort");
      await fetchState();
    } finally {
      setShowLoading(false);
    }
  };

  const updateFilters = async (rules: FilterRule[]) => {
    setState((prev) => ({ ...prev, filterRules: rules }));
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
                  Similarity: {similarity}%
                </Text>
                <Slider
                  value={similarity}
                  onChange={setSimilarity} // updates local state instantly
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

        <Paper
          withBorder
          radius="md"
          bg="dark.8"
          style={{ height: 140, overflow: "hidden" }}
        >
          <Group px="sm" py={6} bg="dark.9">
            <TerminalIcon size={14} color="white" />
          </Group>
          <ScrollArea h={100} p="xs">
            <Text size="xs" ff="monospace" c="blue.3">
              {`> ${
                state.currentPath
                  ? `Directory set: ${state.currentPath}`
                  : "Awaiting folder..."
              }`}
            </Text>
          </ScrollArea>
        </Paper>
      </Stack>
    </Box>
  );
};

export default FileSorter;
