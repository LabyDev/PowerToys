import {
  Box,
  Button,
  Group,
  Stack,
  Text,
  LoadingOverlay,
  Paper,
  Slider,
  TextInput,
  ActionIcon,
} from "@mantine/core";
import { useState, useRef } from "react";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import {
  MagnifyingGlassIcon,
  XCircleIcon,
  ArrowsClockwiseIcon,
} from "@phosphor-icons/react";
import Section from "../file-randomiser/section";
import FileTree from "../file-randomiser/fileTree";

export interface FileEntry {
  id: string;
  name: string;
  path: string;
  moved?: boolean;
  excluded?: boolean;
  overrideFolder?: string; // per-file override
}

const FileSorterUI = () => {
  // ----------------- State -----------------
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [query, setQuery] = useState("");
  const [threshold, setThreshold] = useState(60);
  const [ignoredWords, setIgnoredWords] = useState<string[]>([]);
  const [showLoading, setShowLoading] = useState(false);
  const [restorePointExists, setRestorePointExists] = useState(false);

  const fileTreeRef = useRef<FileTreeHandle>(null);
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  // ----------------- Derived -----------------
  const filteredFiles = files.filter((f) =>
    query
      ? f.name.toLowerCase().includes(query.toLowerCase()) ||
        f.path.toLowerCase().includes(query.toLowerCase())
      : true,
  );

  const movedFiles = filteredFiles.filter((f) => f.moved);
  const notMovedFiles = filteredFiles.filter((f) => !f.moved);

  // ----------------- Handlers (logic placeholders) -----------------
  const handleSort = () => {
    // TODO: call backend to sort files
    console.log("Sort triggered");
  };

  const handleRestore = () => {
    // TODO: restore from restore point
    console.log("Restore triggered");
  };

  const handleIgnoredWordsChange = (val: string) => {
    setIgnoredWords(val.split(",").map((w) => w.trim()));
  };

  // ----------------- Render -----------------
  return (
    <Box p="md" h="94vh">
      <LoadingOverlay
        visible={showLoading}
        overlayProps={{ blur: 2 }}
        loaderProps={{ type: "dots" }}
      />

      <Stack h="100%" gap="md">
        {/* Toolbar */}
        <Paper withBorder radius="md" p="md">
          <Group justify="space-between" align="center" wrap="nowrap">
            <Group gap="sm">
              <Button
                leftSection={<ArrowsClockwiseIcon size={16} />}
                onClick={handleSort}
              >
                Sort Files
              </Button>
              <Button
                variant="outline"
                disabled={!restorePointExists}
                onClick={handleRestore}
              >
                Restore
              </Button>
            </Group>

            <TextInput
              placeholder="Search files..."
              leftSection={<MagnifyingGlassIcon size={16} />}
              rightSection={
                query && (
                  <ActionIcon onClick={() => setQuery("")}>
                    <XCircleIcon size={16} />
                  </ActionIcon>
                )
              }
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
            />
          </Group>

          {/* Threshold slider */}
          <Group mt="sm" align="center">
            <Text size="sm">Similarity Threshold: {threshold}%</Text>
            <Slider
              min={0}
              max={100}
              step={1}
              value={threshold}
              onChange={setThreshold}
              style={{ flex: 1 }}
            />
          </Group>

          {/* Ignored words input */}
          <TextInput
            mt="sm"
            placeholder="Ignored words, comma-separated"
            value={ignoredWords.join(", ")}
            onChange={(e) => handleIgnoredWordsChange(e.currentTarget.value)}
          />
        </Paper>

        {/* Main content */}
        <Group
          className="main-content"
          align="stretch"
          style={{ flex: 1, minHeight: 0, gap: 8 }}
        >
          {/* File Tree / Preview */}
          <Section
            title={`Preview (${filteredFiles.length})`}
            className="main-panel"
            style={{ flex: 1 }}
          >
            <Box style={{ height: "100%", minHeight: 0, overflowY: "auto" }}>
              {/* <FileTree
                ref={fileTreeRef}
                nodes={filteredFiles.map((f) => ({
                  name: f.name,
                  path: f.path,
                  file: f,
                  depth: 0,
                }))}
                onOverrideFolderChange={(file: FileEntry, folder: string) => {
                  file.overrideFolder = folder;
                  setFiles([...files]);
                }}
              /> */}
            </Box>
          </Section>

          {/* Already moved */}
          <Section
            title={`Moved Files (${movedFiles.length})`}
            className="side-panel"
            style={{ width: 300 }}
          >
            <Virtuoso
              ref={virtuosoRef}
              data={movedFiles}
              itemContent={(_, file) => (
                <Group
                  key={file.id}
                  px="sm"
                  py={6}
                  style={{ gap: 8, alignItems: "center" }}
                >
                  <Stack gap={0} style={{ flex: 1, overflow: "hidden" }}>
                    <Text size="sm" fw={600}>
                      {file.name}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {file.path}
                    </Text>
                  </Stack>
                  <Text size="xs" c="green">
                    Moved
                  </Text>
                </Group>
              )}
            />
          </Section>
        </Group>
      </Stack>
    </Box>
  );
};

export default FileSorterUI;
