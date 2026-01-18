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
import Section from "../common/section";
import FileSorterToolbar from "./toolbar";
import { FileSorterState } from "../types/filesorter";
import SortPreviewTree from "./sortPreviewTree";
import { emit } from "@tauri-apps/api/event";
import { buildSortPreviewTree } from "../core/utilities/buildSortPreviewTree";
import ConsolePanel from "./consolePanel";
import { invoke } from "@tauri-apps/api/core";

const FileSorter = () => {
  const [showLoading, setShowLoading] = useState(false);
  const [state, setState] = useState<FileSorterState>({
    currentPath: null,
    similarityThreshold: 60,
    filterRules: [],
    preview: [],
    stats: {
      filesToMove: 0,
      foldersToCreate: 0,
      totalFoldersAffected: 0,
      totalSizeToMove: 0,
    },
    hasRestorePoint: false,
    files: [],
    excludedPaths: new Set(),
    forcedTargets: new Map(),
  });
  const [similarity, setSimilarity] = useState(state.similarityThreshold);
  const [debouncedSimilarity] = useDebouncedValue(similarity, 300);
  const [query, setQuery] = useState("");

  const logFrontend = (message: string) => {
    emit("file_sorter_log", `[ui] ${message}`);
  };

  const fetchFullState = async () => {
    const backendState: FileSorterState & {
      excludedPaths?: string[];
      forcedTargets?: Record<string, string>;
    } = await invoke("get_sort_preview");

    setState({
      ...backendState,
      excludedPaths: new Set(backendState.excludedPaths || []),
      forcedTargets: new Map(Object.entries(backendState.forcedTargets || {})),
    });
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

  const refreshPreview = async () => {
    setShowLoading(true);
    try {
      await fetchFullState();
    } finally {
      setShowLoading(false);
    }
  };

  const handleSelectFolder = async () => {
    const path = await invoke<string | null>("select_sort_directory");
    if (!path) return;

    logFrontend("Directory selected");
    setQuery("");
    await refreshPreview();
  };

  const handleRefresh = async () => {
    if (!state.currentPath) return;
    logFrontend("Refreshing preview...");
    setQuery("");
    await refreshPreview();
  };

  const handleSort = async () => {
    if (!state.currentPath) return;
    logFrontend("Sorting files");
    setShowLoading(true);
    try {
      await invoke("sort_files");
      await refreshPreview();
    } finally {
      setShowLoading(false);
    }
  };

  const handleRestore = async () => {
    logFrontend("Restoring last sort");
    setShowLoading(true);
    try {
      await invoke("restore_last_sort");
      await refreshPreview();
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

  function formatBytes(bytes: number, locale = navigator.language) {
    if (bytes === 0) return "0 B";

    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return (
      new Intl.NumberFormat(locale, {
        maximumFractionDigits: 2,
      }).format(bytes / Math.pow(k, i)) + ` ${sizes[i]}`
    );
  }

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
                  excludedPaths={state.excludedPaths}
                  forcedTargets={state.forcedTargets}
                  refreshPreview={refreshPreview}
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

          <Section title="Configuration" style={{ width: 250, minWidth: 250 }}>
            <Stack gap="md" style={{ height: "100%" }}>
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

              {/* Scrollable stats with max height */}
              <ScrollArea style={{ maxHeight: "calc(100% - 100px)" }}>
                <Stack gap="xs">
                  <Badge variant="light" fullWidth size="lg">
                    Files to Move: {state.stats.filesToMove}
                  </Badge>
                  <Badge color="cyan" variant="light" fullWidth size="lg">
                    New Folders: {state.stats.foldersToCreate}
                  </Badge>
                  <Badge color="green" variant="light" fullWidth size="lg">
                    Total Folders Affected: {state.stats.totalFoldersAffected}
                  </Badge>
                  <Badge color="orange" variant="light" fullWidth size="lg">
                    Total Size to Move:{" "}
                    {formatBytes(state.stats.totalSizeToMove)}
                  </Badge>
                </Stack>
              </ScrollArea>
            </Stack>
          </Section>
        </Group>

        <ConsolePanel currentPath={state.currentPath} searchQuery={query} />
      </Stack>
    </Box>
  );
};

export default FileSorter;
