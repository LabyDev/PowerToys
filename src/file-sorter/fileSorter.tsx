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

const FileSorter = () => {
  const [query, setQuery] = useState("");
  const [similarity, setSimilarity] = useState(60);
  const [showLoading, setShowLoading] = useState(false);

  // State for the FiltersPanel
  const [data, setData] = useState<AppStateData>({
    filterRules: [], // These replace your "ignored.txt"
    // ... add other necessary AppStateData fields here
  });

  const updateData = async (updated: AppStateData) => {
    setData(updated);
    // Optional: Sync to backend/Tauri here
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
          hasRestorePoint={true}
        />

        {/* Integrated Filters Panel - Acts as your "Ignored Words" manager */}
        <FiltersPanel data={data} updateData={updateData} />

        <Group align="stretch" style={{ flex: 1, minHeight: 0 }} wrap="nowrap">
          <Section title="Processing Preview" style={{ flex: 1 }}>
            <ScrollArea h="100%" p="xs">
              <Code block>
                {/* The logic here should now check:
                   1. Is word in data.filterRules (action: 'exclude')?
                   2. Similarity ratio >= similarity slider?
                */}
                {`[Rule Applied: Exclude "v1"] "Draft_v1_Final.docx" -> folder "Draft"`}
              </Code>
            </ScrollArea>
          </Section>

          <Section title="Stats" style={{ width: 250 }}>
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
                  label={(val) => `${val}%`}
                />
              </Box>

              <Divider label="Summary" labelPosition="center" />

              <Stack gap="xs">
                <Badge variant="light" fullWidth size="lg">
                  Files to Move: 24
                </Badge>
                <Badge color="cyan" variant="light" fullWidth size="lg">
                  New Folders: 3
                </Badge>
                <Badge color="red" variant="light" fullWidth size="lg">
                  Ignored: {data.filterRules.length}
                </Badge>
              </Stack>
            </Stack>
          </Section>
        </Group>

        <Paper
          withBorder
          radius="md"
          bg="dark.8"
          style={{ height: 160, overflow: "hidden" }}
        >
          <Group px="sm" py={6} bg="dark.9">
            <TerminalIcon size={14} color="white" />
          </Group>
          <ScrollArea h={120} p="xs">
            <Text
              size="xs"
              ff="monospace"
              c="blue.3"
            >{`> Filter rules updated. Scanning with ${similarity}% threshold...`}</Text>
          </ScrollArea>
        </Paper>
      </Stack>
    </Box>
  );
};

export default FileSorter;
