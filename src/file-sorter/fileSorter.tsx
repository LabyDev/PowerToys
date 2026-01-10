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
} from "@mantine/core";
import { TerminalIcon } from "@phosphor-icons/react";
import Section from "../file-randomiser/section";
import FileSorterToolbar from "./toolbar";

const FileSorter = () => {
  const [query, setQuery] = useState("");
  const [showLoading, setShowLoading] = useState(false);
  const [logs, setLogs] = useState<
    { msg: string; type: "info" | "error" | "success" }[]
  >([
    { msg: "System initialized.", type: "info" },
    { msg: "Found 142 files in the current path.", type: "info" },
  ]);

  const handleSort = () => {
    setLogs((prev) => [
      ...prev,
      { msg: "Executing file move...", type: "success" },
    ]);
  };

  return (
    <Box p="md" h="94vh">
      <LoadingOverlay visible={showLoading} />

      <Stack h="100%" gap="md">
        <FileSorterToolbar
          query={query}
          onQueryChange={setQuery}
          onSort={handleSort}
          onRefresh={() => {}}
          onRestore={() => {}}
          hasRestorePoint={true}
        />

        <Group align="stretch" style={{ flex: 1, minHeight: 0 }} wrap="nowrap">
          <Section title="Processing Preview" style={{ flex: 1 }}>
            <ScrollArea h="100%" p="xs">
              <Code block>
                {/* File Tree Component will render here */}
                Rendering preview for query: {query || "All Files"}
              </Code>
            </ScrollArea>
          </Section>

          <Section title="Stats" style={{ width: 220 }}>
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

        <Paper
          withBorder
          radius="md"
          bg="dark.8"
          style={{ height: 180, overflow: "hidden" }}
        >
          <Group px="sm" py={6} bg="dark.9">
            <TerminalIcon size={14} color="white" />
          </Group>
          <ScrollArea h={140} p="xs">
            {logs.map((log, i) => (
              <Group key={i} gap="xs" wrap="nowrap">
                <Code
                  bg="transparent"
                  color={log.type === "success" ? "green.4" : "blue.3"}
                >
                  {`> ${log.msg}`}
                </Code>
              </Group>
            ))}
          </ScrollArea>
        </Paper>
      </Stack>
    </Box>
  );
};

export default FileSorter;
