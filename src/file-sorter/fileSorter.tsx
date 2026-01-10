import { useState } from "react";
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
import {
  restoreLastSort,
  selectSortDirectory,
  sortFiles,
} from "../core/api/fileSorterApi";
import { FileSorterState } from "../types/filesorter";

const FileSorter = () => {
  const [showLoading, setShowLoading] = useState(false);

  // Single source of truth using FileSorterState
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
  });

  const handleSelectFolder = async () => {
    const path = await selectSortDirectory();
    if (path) {
      setState((prev) => ({ ...prev, currentPath: path }));
    }
  };

  const handleSort = async () => {
    if (!state.currentPath) return;
    setShowLoading(true);
    try {
      await sortFiles(
        state.currentPath,
        state.similarityThreshold,
        state.filterRules,
      );
    } finally {
      setShowLoading(false);
    }
  };

  const handleRestore = async () => {
    setShowLoading(true);
    try {
      await restoreLastSort();
      setState((prev) => ({ ...prev, hasRestorePoint: false }));
    } finally {
      setShowLoading(false);
    }
  };

  const updateFilters = (rules: FilterRule[]) => {
    setState((prev) => ({ ...prev, filterRules: rules }));
  };

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
        />

        {/* FiltersPanel expects an object with filterRules; updateData returns that object */}
        <FiltersPanel
          data={{ filterRules: state.filterRules }}
          updateData={async (u) => updateFilters(u.filterRules)}
        />

        <Group align="stretch" style={{ flex: 1, minHeight: 0 }} wrap="nowrap">
          <Section title="Processing Preview" style={{ flex: 1 }}>
            <ScrollArea h="100%" p="xs">
              {state.preview.length > 0 ? (
                state.preview.map((op, i) => (
                  <Code block key={i} mb={4}>
                    {`MOVING: ${op.fileName} -> ${op.destinationFolder} (${op.reason})`}
                  </Code>
                ))
              ) : (
                <Code block>
                  {state.currentPath
                    ? `Ready to sort: ${state.currentPath}`
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
                  onChange={(val) =>
                    setState((prev) => ({ ...prev, similarityThreshold: val }))
                  }
                  min={10}
                  max={100}
                  step={5}
                />
              </Box>
              <Divider label="Stats" labelPosition="center" />
              <Stack gap="xs">
                <Badge variant="light" fullWidth size="lg">
                  Files to Move:{" "}
                  {state.preview.length || state.stats.filesToMove}
                </Badge>
                <Badge color="cyan" variant="light" fullWidth size="lg">
                  New Folders:{" "}
                  {new Set(state.preview.map((p) => p.destinationFolder))
                    .size || state.stats.foldersToCreate}
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
