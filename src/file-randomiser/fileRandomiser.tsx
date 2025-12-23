import { ActionIcon, Box, Group, Stack, Text } from "@mantine/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";

import { AppStateData } from "../types/filerandomiser";
import { useAppSettings } from "../core/hooks/useAppSettings";
import Section from "./section";
import Toolbar from "./toolbar";
import FiltersPanel from "./filtersPanel";
import "./fileRandomiser.css";
import { PlusIcon, TrashIcon } from "@phosphor-icons/react";

const FileRandomiser = () => {
  const { settings } = useAppSettings();

  const [data, setData] = useState<AppStateData>({
    paths: [],
    files: [],
    history: [],
    excludedFilenames: [],
    excludedFolders: [],
  });

  const [query, setQuery] = useState("");
  const [shuffle, setShuffle] = useState(false);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [tracking, setTracking] = useState(false);

  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const currentIndexRef = useRef<number | null>(null);

  // ------------------------ Effects ------------------------
  useEffect(() => {
    updateAndRefreshData();
  }, []);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    if (!shuffle && currentIndex !== null) {
      virtuosoRef.current?.scrollToIndex({
        index: currentIndex,
        align: "center",
      });
    }
  }, [currentIndex, shuffle]);

  useEffect(() => {
    if (!settings.allow_process_tracking && tracking) {
      setTracking(false);
    }
  }, [settings.allow_process_tracking, tracking]);

  useEffect(() => {
    if (!tracking) return;
    let unlisten: (() => void) | null = null;

    listen("file-closed", () => {
      handlePickFile();
    }).then((fn) => {
      unlisten = fn;
    });

    return () => unlisten?.();
  }, [tracking]);

  // ------------------------ Data Handling ------------------------
  const updateAndRefreshData = async (updatedData?: AppStateData) => {
    if (updatedData) {
      await invoke("update_app_state", { newData: updatedData });
    }
    const latest = await invoke<AppStateData>("get_app_state");
    setData(latest);
  };

  const updateFiltersAndCrawl = async (updatedData: AppStateData) => {
    await updateAndRefreshData(updatedData); // update state
    await handleCrawl(); // crawl paths again
  };

  const handleAddPath = async () => {
    await invoke("add_path_via_dialog");
    await handleCrawl();
  };

  const handleCrawl = async () => {
    await invoke("crawl_paths");
    updateAndRefreshData();
  };

  const handlePickFile = useCallback(async () => {
    if (!data.files.length) return;

    // Filter out excluded files
    const availableFiles = data.files.filter((f) => !f.excluded);
    if (!availableFiles.length) return; // nothing to pick

    let index: number;

    if (shuffle) {
      index = Math.floor(Math.random() * availableFiles.length);
    } else {
      const currentId =
        currentIndexRef.current !== null
          ? data.files[currentIndexRef.current]?.id
          : null;
      const currentAvailableIndex = availableFiles.findIndex(
        (f) => f.id === currentId,
      );
      index =
        currentAvailableIndex === -1
          ? 0
          : (currentAvailableIndex + 1) % availableFiles.length;
    }

    const file = availableFiles[index];
    await invoke("open_file_by_id", { id: file.id });

    // Update currentIndex using original data.files index
    const originalIndex = data.files.findIndex((f) => f.id === file.id);
    setCurrentIndex(originalIndex);
    currentIndexRef.current = originalIndex;

    updateAndRefreshData();
  }, [data.files, shuffle]);

  // ------------------------ Filtering ------------------------
  const q = query.toLowerCase();

  const filteredPaths = useMemo(() => {
    if (!q) return data.paths;
    return data.paths.filter(
      (p) =>
        p.name.toLowerCase().includes(q) || p.path.toLowerCase().includes(q),
    );
  }, [data.paths, q]);

  const filteredFiles = useMemo(() => {
    if (!q) return data.files;
    return data.files.filter(
      (f) =>
        f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q),
    );
  }, [data.files, q]);

  const filteredHistory = useMemo(() => {
    const base = q
      ? data.history.filter(
          (h) =>
            h.name.toLowerCase().includes(q) ||
            h.path.toLowerCase().includes(q),
        )
      : data.history;

    return [...base].sort(
      (a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime(),
    );
  }, [data.history, q]);

  return (
    <Box p="md" h="88vh">
      <Stack h="100%" gap="md">
        {/* Toolbar + Search */}
        <Toolbar
          shuffle={shuffle}
          tracking={tracking}
          allowTracking={settings.allow_process_tracking}
          query={query}
          onAddPath={handleAddPath}
          onCrawl={handleCrawl}
          onPickFile={handlePickFile}
          onShuffleChange={setShuffle}
          onTrackingChange={setTracking}
          onQueryChange={setQuery}
        />

        {/* Filters */}
        <FiltersPanel data={data} updateData={updateFiltersAndCrawl} />

        {/* Main content */}
        <Group align="stretch" grow style={{ flex: 1, minHeight: 0 }}>
          {/* Paths */}
          <Section title={`Paths (${filteredPaths.length})`}>
            <Virtuoso
              data={filteredPaths}
              itemContent={(_, item) => (
                <Group
                  key={item.id}
                  px="sm"
                  py={6}
                  style={{ alignItems: "center", gap: 8 }}
                  className="path-item hoverable"
                >
                  <Stack gap={0} style={{ flex: 1, overflow: "hidden" }}>
                    <Text size="sm" fw={600} lineClamp={1}>
                      {item.name}
                    </Text>
                    <Text size="xs" c="dimmed" lineClamp={1}>
                      {item.path}
                    </Text>
                  </Stack>

                  {/* Exclude button */}
                  <ActionIcon
                    color="orange"
                    variant="subtle"
                    className="exclude-icon"
                    onClick={async () => {
                      await updateAndRefreshData({
                        ...data,
                        excludedFolders: [
                          ...data.excludedFolders,
                          { id: crypto.randomUUID(), path: item.path },
                        ],
                      });
                      handleCrawl();
                    }}
                  >
                    <PlusIcon size={16} />
                  </ActionIcon>

                  <ActionIcon
                    color="red"
                    variant="subtle"
                    className="trash-icon"
                    onClick={async () => {
                      const removed = await invoke<boolean>("remove_path", {
                        id: item.id,
                      });
                      if (removed) {
                        handleCrawl();
                      }
                    }}
                  >
                    <TrashIcon size={16} />
                  </ActionIcon>
                </Group>
              )}
            />
          </Section>

          {/* Files */}
          <Section title={`Files (${filteredFiles.length})`}>
            <Virtuoso
              data={filteredFiles}
              ref={virtuosoRef}
              itemContent={(_, item) => (
                <Box
                  px="sm"
                  py={6}
                  className={`file-item hoverable ${item.excluded ? "excluded" : ""}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    backgroundColor:
                      !shuffle &&
                      currentIndex !== null &&
                      data.files[currentIndex]?.id === item.id
                        ? "var(--mantine-color-blue-light)"
                        : undefined,
                    opacity: item.excluded ? 0.5 : 1, // dim excluded files
                  }}
                >
                  <Stack gap={0} style={{ flex: 1, overflow: "hidden" }}>
                    <Text
                      size="sm"
                      lineClamp={1}
                      style={{
                        textDecoration: item.excluded ? "line-through" : "none",
                      }}
                    >
                      {item.name}
                    </Text>
                    <Text size="xs" c="dimmed" lineClamp={1}>
                      {item.path}
                    </Text>
                  </Stack>

                  {/* Exclude button */}
                  <ActionIcon
                    color="orange"
                    variant="subtle"
                    className="exclude-icon"
                    onClick={async () => {
                      await updateAndRefreshData({
                        ...data,
                        excludedFilenames: [
                          ...data.excludedFilenames,
                          {
                            id: crypto.randomUUID(),
                            pattern: item.name,
                            isRegex: false,
                          },
                        ],
                      });
                      handleCrawl();
                    }}
                  >
                    <PlusIcon size={16} />
                  </ActionIcon>
                </Box>
              )}
            />
          </Section>

          {/* History */}
          <Section title={`History (${filteredHistory.length})`}>
            <Virtuoso
              data={filteredHistory}
              itemContent={(_, item) => (
                <Box px="sm" py={6}>
                  <Text size="sm" lineClamp={1}>
                    {item.name}
                  </Text>
                  <Text size="xs" c="dimmed" lineClamp={1}>
                    {item.path}
                  </Text>
                  <Text size="xs" c="dimmed" tt="italic">
                    Opened at: {new Date(item.openedAt).toLocaleString()}
                  </Text>
                </Box>
              )}
            />
          </Section>
        </Group>
      </Stack>
    </Box>
  );
};

export default FileRandomiser;
