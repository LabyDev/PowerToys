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
import { AppStateData } from "../types/filerandomiser";
import {
  restoreLastSort,
  selectSortDirectory,
  sortFiles,
} from "../core/api/fileSorterApi";

const FileSorter = () => {
  const [query, setQuery] = useState("");
  const [similarity, setSimilarity] = useState(60);
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [showLoading, setShowLoading] = useState(false);
  const [data, setData] = useState<AppStateData>({ filterRules: [] });

  // Inside FileSorter component
  const handleSelectFolder = async () => {
    const path = await selectSortDirectory();
    if (path) setCurrentPath(path);
  };

  const handleSort = async () => {
    if (!currentPath) return;
    setShowLoading(true);
    try {
      await sortFiles(currentPath, similarity, data);
    } finally {
      setShowLoading(false);
    }
  };

  const handleRestore = async () => {
    setShowLoading(true);
    await restoreLastSort();
    setShowLoading(false);
  };

  return (
    <Box p="md" h="94vh">
      <LoadingOverlay visible={showLoading} />

      <Stack h="100%" gap="md">
        <FileSorterToolbar
          query={query}
          onQueryChange={setQuery}
          onSort={() => {}}
          onRefresh={() => {}}
          onRestore={() => {}}
          onSelectFolder={handleSelectFolder}
          currentPath={currentPath}
          hasRestorePoint={true}
        />

        <FiltersPanel data={data} updateData={async (u) => setData(u)} />

        <Group align="stretch" style={{ flex: 1, minHeight: 0 }} wrap="nowrap">
          <Section title="Processing Preview" style={{ flex: 1 }}>
            <ScrollArea h="100%" p="xs">
              <Code block>
                {currentPath
                  ? `Ready to sort: ${currentPath}`
                  : "Select a directory to begin."}
              </Code>
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
                  onChange={setSimilarity}
                  min={10}
                  max={100}
                  step={5}
                />
              </Box>
              <Divider label="Stats" labelPosition="center" />
              <Stack gap="xs">
                <Badge variant="light" fullWidth size="lg">
                  Files to Move: 24
                </Badge>
                <Badge color="cyan" variant="light" fullWidth size="lg">
                  New Folders: 3
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
            <Text
              size="xs"
              ff="monospace"
              c="blue.3"
            >{`> ${currentPath ? `Directory set: ${currentPath}` : "Awaiting folder..."}`}</Text>
          </ScrollArea>
        </Paper>
      </Stack>
    </Box>
  );
};

export default FileSorter;
