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
import { TerminalIcon } from "@phosphor-icons/react";
import Section from "../file-randomiser/section";
import FileSorterToolbar from "./toolbar";
import FiltersPanel from "../file-randomiser/filtersPanel";
import { FilterRule } from "../types/common";
import { FileSorterState } from "../types/filesorter";
import SortPreviewTree, { SortTreeNode } from "./sortPreviewTree";
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
    },
    hasRestorePoint: false,
    files: [],
  });

  const fetchState = async () => {
    const backendState: FileSorterState = await invoke("get_sorter_state");
    setState(backendState);
  };

  useEffect(() => {
    fetchState();
  }, []);

  const handleSelectFolder = async () => {
    const path = await invoke<string | null>("select_sort_directory");
    if (path) {
      setState((prev) => ({ ...prev, currentPath: path }));
      await handlePreview(); // fetch preview after folder selection
    }
  };

  const handlePreview = async () => {
    if (!state.currentPath) return;
    setShowLoading(true);
    try {
      const updatedState: FileSorterState = await invoke("get_sort_preview");
      setState(updatedState);
    } finally {
      setShowLoading(false);
    }
  };

  const handleSort = async () => {
    setShowLoading(true);
    try {
      await invoke("sort_files");
      await fetchState(); // refresh state after sort
    } finally {
      setShowLoading(false);
    }
  };

  const handleRestore = async () => {
    setShowLoading(true);
    try {
      await invoke("restore_last_sort");
      await fetchState(); // refresh state after restore
    } finally {
      setShowLoading(false);
    }
  };

  const updateFilters = async (rules: FilterRule[]) => {
    setState((prev) => ({ ...prev, filterRules: rules }));
    await handlePreview();
  };

  const buildTree = (state: FileSorterState): SortTreeNode | null => {
    if (!state.currentPath) return null;
    return {
      name: state.currentPath.split("/").pop() ?? state.currentPath,
      path: state.currentPath,
      children: state.preview.map((op) => ({
        name: op.fileName,
        path: op.sourcePath,
      })),
    };
  };

  const previewTree = buildTree(state);

  return (
    <Box p="md" h="94vh">
      <LoadingOverlay visible={showLoading} />

      <Stack h="100%" gap="md">
        <FileSorterToolbar
          currentPath={state.currentPath}
          onSelectFolder={handleSelectFolder}
          onSort={handleSort}
          onRestore={handleRestore}
          onRefresh={handlePreview}
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
                <SortPreviewTree root={previewTree} />
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
                  Similarity: {state.similarityThreshold}%
                </Text>
                <Slider
                  value={state.similarityThreshold}
                  onChange={async (val) => {
                    setState((prev) => ({ ...prev, similarityThreshold: val }));
                    await handlePreview();
                  }}
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
              {`> ${state.currentPath ? `Directory set: ${state.currentPath}` : "Awaiting folder..."}`}
            </Text>
          </ScrollArea>
        </Paper>
      </Stack>
    </Box>
  );
};

export default FileSorter;
