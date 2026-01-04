import { useState } from "react";
import {
  Box,
  Group,
  Stack,
  LoadingOverlay,
  Badge,
  ScrollArea,
  Code,
  Tabs,
  Switch,
  Tooltip,
  Paper,
} from "@mantine/core";
import {
  TerminalIcon,
  TreeStructureIcon,
  AppWindowIcon,
} from "@phosphor-icons/react";
import Section from "../file-randomiser/section";
import FileSorterToolbar from "./toolbar";
import FiltersPanel from "../file-randomiser/filtersPanel";

const FileSorter = () => {
  const [query, setQuery] = useState("");
  const [showLoading, setShowLoading] = useState(false);
  const [isDryRun, setIsDryRun] = useState(true);

  // Mock console logs
  const [logs, setLogs] = useState<
    { msg: string; type: "info" | "error" | "success" }[]
  >([
    { msg: "System initialized. Ready to scan directory...", type: "info" },
    { msg: "Found 142 files in the current path.", type: "info" },
  ]);

  // ----------------- Handlers -----------------
  const handleSort = () => {
    if (isDryRun) {
      setLogs((prev) => [
        ...prev,
        { msg: "[DRY RUN] Simulating sort operation...", type: "info" },
      ]);
    } else {
      setLogs((prev) => [
        ...prev,
        { msg: "Executing permanent file move...", type: "success" },
      ]);
    }
  };

  return (
    <Box p="md" h="94vh">
      <LoadingOverlay visible={showLoading} />

      <Stack h="100%" gap="md">
        {/* Top Controls: Toolbar + Filters */}
        <Stack gap="xs">
          <FileSorterToolbar
            query={query}
            onQueryChange={setQuery}
            onSort={handleSort}
            onRefresh={() => {}}
          />

          <Group justify="space-between" align="center">
            {/* <FiltersPanel data={} updateData={} /> */}
            <Tooltip label="If enabled, no files will actually be moved.">
              <Switch
                label="Dry Run Mode"
                checked={isDryRun}
                onChange={(e) => setIsDryRun(e.currentTarget.checked)}
                color="orange"
                size="md"
              />
            </Tooltip>
          </Group>
        </Stack>

        {/* Main Content Area */}
        <Group align="stretch" style={{ flex: 1, minHeight: 0 }} wrap="nowrap">
          <Section title="Processing Preview" style={{ flex: 1 }}>
            <Tabs defaultValue="preview" h="100%">
              <Tabs.List>
                <Tabs.Tab
                  value="preview"
                  leftSection={<TreeStructureIcon size={14} />}
                >
                  Tree Preview
                </Tabs.Tab>
                <Tabs.Tab
                  value="history"
                  leftSection={<AppWindowIcon size={14} />}
                >
                  Last Actions
                </Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="preview" p="xs">
                {/* TODO: Implement Tree Preview with Heatmap Badges */}
                {/* Visual Idea: 
                    Folder: "Project_X" 
                       - File_X_v1.zip [98% Match] (Green Badge)
                       - Readme.txt [No Match - New Folder Created] (Blue Badge)
                */}
                <Code block p="md">
                  {/* // TODO: Render FileTree component here // Pass 'isDryRun' to
                  show visual indicators of planned moves */}
                </Code>
              </Tabs.Panel>
            </Tabs>
          </Section>

          {/* Right Panel: Statistics & Info */}
          <Section title="Stats" style={{ width: 250 }}>
            <Stack gap="xs">
              <Badge variant="light" fullWidth>
                Files to Move: 24
              </Badge>
              <Badge color="cyan" variant="light" fullWidth>
                New Folders: 3
              </Badge>
              <Badge color="red" variant="light" fullWidth>
                Conflicts: 1
              </Badge>
            </Stack>
          </Section>
        </Group>

        {/* Bottom Panel: Log Console */}
        <Paper
          withBorder
          radius="md"
          bg="dark.8"
          style={{ height: 180, overflow: "hidden" }}
        >
          <Group px="sm" py={4} bg="dark.9" justify="space-between">
            <Group gap="xs">
              <TerminalIcon size={14} color="white" />
              {/* <Text size="xs" c="gray.4" fw={700}>
                SYSTEM CONSOLE
              </Text> */}
            </Group>
            {/* <ActionIcon size="xs" variant="subtle" onClick={() => setLogs([])}>
              <XCircleIcon size={14} />
            </ActionIcon> */}
          </Group>
          <ScrollArea h={150} p="xs">
            {logs.map((log, i) => (
              <Group key={i} gap="xs" wrap="nowrap">
                {/* <Text size="xs" c="dimmed" style={{ fontFamily: "monospace" }}>
                  [{new Date().toLocaleTimeString()}]
                </Text> */}
                {/* <Text
                  size="xs"
                  fw={500}
                  c={
                    log.type === "error"
                      ? "red.4"
                      : log.type === "success"
                        ? "green.4"
                        : "blue.3"
                  }
                  style={{ fontFamily: "monospace" }}
                > */}
                {/* {log.msg}
                </Text> */}
              </Group>
            ))}
          </ScrollArea>
        </Paper>
      </Stack>
    </Box>
  );
};

export default FileSorter;
