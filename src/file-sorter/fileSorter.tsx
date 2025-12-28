import { Box, Group, Stack, Text, LoadingOverlay } from "@mantine/core";
import { useState, useEffect, useRef } from "react";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { useTranslation } from "react-i18next";
import Section from "../file-randomiser/section";
import FileSorterToolbar from "./toolbar";
import { invoke } from "@tauri-apps/api/core";

export interface FileEntry {
  id: string;
  name: string;
  path: string;
  moved?: boolean;
  excluded?: boolean;
}

const FileSorter = () => {
  const { t } = useTranslation();
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [query, setQuery] = useState("");
  const [filteredFiles, setFilteredFiles] = useState<FileEntry[]>([]);
  const [showLoading, setShowLoading] = useState(false);
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  // Fetch files from Tauri backend
  const fetchFiles = async () => {
    setShowLoading(true);
    try {
      const result: FileEntry[] = await invoke("get_files"); // Tauri command
      setFiles(result);
    } catch (error) {
      console.error("Failed to fetch files:", error);
    } finally {
      setShowLoading(false);
    }
  };

  // Sort files via Tauri backend
  const sortFiles = async () => {
    setShowLoading(true);
    try {
      await invoke("sort_files"); // Tauri command
      await fetchFiles(); // refresh after sort
    } catch (error) {
      console.error("Failed to sort files:", error);
    } finally {
      setShowLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  useEffect(() => {
    setFilteredFiles(
      query
        ? files.filter(
            (f) =>
              f.name.toLowerCase().includes(query.toLowerCase()) ||
              f.path.toLowerCase().includes(query.toLowerCase()),
          )
        : files,
    );
  }, [files, query]);

  return (
    <Box p="md" h="94vh">
      <LoadingOverlay
        visible={showLoading}
        zIndex={1000}
        overlayProps={{ blur: 2 }}
        loaderProps={{ type: "dots" }}
      />
      <Stack h="100%" gap="md">
        <FileSorterToolbar
          onRefresh={fetchFiles}
          query={query}
          onQueryChange={setQuery}
          onSort={sortFiles}
        />

        {/* Main content */}
        <Group
          className="main-content"
          align="stretch"
          style={{ flex: 1, minHeight: 0 }}
        >
          <Section
            title={
              <Group gap="xs">
                <Text>{t("files")}</Text>
                <Text size="sm" c="dimmed">
                  ({filteredFiles.length} files)
                </Text>
              </Group>
            }
            className="main-panel"
          >
            <Box style={{ height: "100%", minHeight: 0, overflowY: "auto" }}>
              <Virtuoso
                ref={virtuosoRef}
                data={filteredFiles}
                itemContent={(_, file) => (
                  <Group
                    key={file.id}
                    px="sm"
                    py={6}
                    style={{ alignItems: "center", gap: 8 }}
                    className="item-actions"
                  >
                    <Stack gap={0} style={{ flex: 1, overflow: "hidden" }}>
                      <Text size="sm" fw={600}>
                        {file.name}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {file.path}
                      </Text>
                    </Stack>
                    {file.moved && (
                      <Text size="xs" c="green">
                        Moved
                      </Text>
                    )}
                  </Group>
                )}
              />
            </Box>
          </Section>
        </Group>
      </Stack>
    </Box>
  );
};

export default FileSorter;
