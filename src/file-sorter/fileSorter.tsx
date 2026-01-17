import { useState, useEffect } from "react";
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

  const [similarity, setSimilarity] = useState(state.similarityThreshold);
  const [debouncedSimilarity] = useDebouncedValue(similarity, 300);
  const [query, setQuery] = useState("");

  const logFrontend = (message: string) => {
    emit("file_sorter_log", `[ui] ${message}`);
  };

  const fetchFullState = async () => {
    const backendState: FileSorterState = await invoke("get_sort_preview");
    setState(backendState);
    setSimilarity(backendState.similarityThreshold);
  };

  useEffect(() => {
    fetchFullState();
  }, []);

  useEffect(() => {
    const applyThreshold = async () => {
      if (!state.currentPath) return;
      if (debouncedSimilarity === state.similarityThreshold) return;

      logFrontend(`Applying similarity threshold: ${debouncedSimilarity}%`);

      setShowLoading(true);
      try {
        await invoke("set_similarity_threshold", {
          threshold: debouncedSimilarity,
        });

        await fetchFullState();
      } finally {
        setShowLoading(false);
      }
    };

    applyThreshold();
  }, [debouncedSimilarity, state.currentPath]);

  const handleSelectFolder = async () => {
    const path = await invoke<string | null>("select_sort_directory");
    if (!path) return;

    logFrontend("Directory selected");
    setQuery("");
    setShowLoading(true);

    try {
      await fetchFullState();
    } finally {
      setShowLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!state.currentPath) return;

    logFrontend("Refreshing preview...");
    setQuery("");
    setShowLoading(true);

    try {
      await fetchFullState();
    } finally {
      setShowLoading(false);
    }
  };

  const handleSort = async () => {
    if (!state.currentPath) return;

    logFrontend("Sorting files");
    setShowLoading(true);

    try {
      await invoke("sort_files");
      await fetchFullState();
    } finally {
      setShowLoading(false);
    }
  };

  const handleRestore = async () => {
    logFrontend("Restoring last sort");
    setShowLoading(true);

    try {
      await invoke("restore_last_sort");
      await fetchFullState();
    } finally {
      setShowLoading(false);
    }
  };

  const previewTree = state.currentPath
    ? buildSortPreviewTree(state.currentPath, state.files, state.preview)
    : null;

  const filteredPreviewTree = previewTree
    ? buildSortPreviewTree(
        state.currentPath!,
        state.files.filter((f) =>
          f.name.toLowerCase().includes(query.toLowerCase()),
        ),
        state.preview,
      )
    : null;

  return (
    <Box p="md" h="94vh">
      <LoadingOverlay visible={showLoading} />

      <Stack h="100%" gap="md">
        <FileSorterToolbar
          query={query}
          onQueryChange={setQuery}
          currentPath={state.currentPath}
          onSelectFolder={handleSelectFolder}
          onSort={handleSort}
          onRestore={handleRestore}
          onRefresh={handleRefresh}
          hasRestorePoint={state.hasRestorePoint}
        />

        <Group align="stretch" style={{ flex: 1, minHeight: 0 }} wrap="nowrap">
          <Section title="Processing Preview" style={{ flex: 1 }}>
            <ScrollArea h="100%" p="xs">
              {filteredPreviewTree ? (
                <SortPreviewTree
                  root={filteredPreviewTree.root}
                  plannedMovesBySource={
                    filteredPreviewTree.plannedMovesBySource
                  }
                  searchQuery={query}
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

        <ConsolePanel currentPath={state.currentPath} searchQuery={query} />
      </Stack>
    </Box>
  );
};

export default FileSorter;
