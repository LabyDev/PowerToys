import {
  ActionIcon,
  Box,
  Button,
  Checkbox,
  Collapse,
  Divider,
  Group,
  Paper,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import {
  FolderPlusIcon,
  ArrowsClockwiseIcon,
  MagnifyingGlassIcon,
  ShuffleIcon,
  TrashIcon,
  PlusIcon,
  FunnelIcon,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { AppStateData } from "../types/filerandomiser";
import { listen } from "@tauri-apps/api/event";
import { useAppSettings } from "../core/hooks/useAppSettings";
import Section from "./section";
import "./fileRandomiser.css";

const FileRandomiser = () => {
  const { settings } = useAppSettings();

  const [data, setData] = useState<AppStateData>({
    paths: [],
    files: [],
    history: [],
    excludedFilenames: [],
    excludedFolders: [],
  });

  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const currentIndexRef = useRef<number | null>(null);

  const [query, setQuery] = useState("");
  const [shuffle, setShuffle] = useState(false);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [tracking, setTracking] = useState(false);

  const [filtersOpen, setFiltersOpen] = useState(false);

  const [newFolder, setNewFolder] = useState("");
  const [newFilename, setNewFilename] = useState("");
  const [newIsRegex, setNewIsRegex] = useState(false);

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

    return () => {
      unlisten?.();
    };
  }, [tracking]);

  const updateAndRefreshData = async (updatedData?: AppStateData) => {
    if (updatedData) {
      await invoke("update_app_state", { newData: updatedData });
    }
    const latest = await invoke<AppStateData>("get_app_state");
    setData(latest);
  };

  /* ------------------------- Searching -------------------------- */
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
  /* -------------------------------------------------------------- */

  const handleAddPath = async () => {
    await invoke("add_path_via_dialog");
    await handleCrawl();
  };

  const handleCrawl = async () => {
    await invoke("crawl_paths", {
      excludedFolders: data.excludedFolders,
      excludedFilenames: data.excludedFilenames,
    });
    updateAndRefreshData();
  };

  const handlePickFile = useCallback(async () => {
    if (!data.files.length) return;

    let index: number;

    if (shuffle) {
      index = Math.floor(Math.random() * data.files.length);
    } else {
      index =
        currentIndexRef.current === null
          ? 0
          : (currentIndexRef.current + 1) % data.files.length;
    }

    const file = data.files[index];

    await invoke("open_file_by_id", { id: file.id });
    setCurrentIndex(index);
    currentIndexRef.current = index;
    updateAndRefreshData();
  }, [data.files, shuffle]);

  return (
    <Box p="md" h="88vh">
      <Stack h="100%" gap="md">
        {/* Top toolbar */}
        <Paper withBorder radius="md" p="sm">
          <Group justify="space-between" wrap="nowrap">
            <Group>
              <Button
                leftSection={<FolderPlusIcon size={16} />}
                onClick={handleAddPath}
              >
                Add path
              </Button>

              <Button
                variant="light"
                leftSection={<ArrowsClockwiseIcon size={16} />}
                onClick={handleCrawl}
              >
                Crawl
              </Button>

              <Button
                variant="filled"
                leftSection={<ShuffleIcon size={16} />}
                onClick={handlePickFile}
              >
                {shuffle ? "Random file" : "Next file"}
              </Button>
            </Group>

            <Group>
              <Checkbox
                label="Shuffle"
                checked={shuffle}
                onChange={(e) => setShuffle(e.currentTarget.checked)}
              />
              {settings.allow_process_tracking && (
                <Checkbox
                  label="Tracking"
                  checked={tracking}
                  onChange={(e) => setTracking(e.currentTarget.checked)}
                />
              )}
            </Group>
          </Group>
        </Paper>

        {/* Global search */}
        <TextInput
          placeholder="Search paths, files, and history…"
          leftSection={<MagnifyingGlassIcon size={16} />}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
        />

        {/* Filters & Exclusions */}
        <Paper withBorder radius="md" p="sm">
          <Group
            justify="space-between"
            style={{ cursor: "pointer" }}
            onClick={() => setFiltersOpen((o) => !o)}
          >
            <Group gap="xs">
              <FunnelIcon size={16} />
              <Text fw={600}>Filters & Exclusions</Text>
            </Group>
            <Text size="xs" c="dimmed">
              {filtersOpen ? "Hide" : "Show"}
            </Text>
          </Group>

          <Collapse in={filtersOpen}>
            <Stack gap="md" mt="sm">
              {/* Excluded folders */}
              <Stack gap={6}>
                <Text size="sm" fw={600}>
                  Excluded folders
                </Text>

                <Group gap="xs">
                  <TextInput
                    placeholder="e.g. node_modules or src/generated"
                    value={newFolder}
                    onChange={(e) => setNewFolder(e.currentTarget.value)}
                    style={{ flex: 1 }}
                  />
                  <ActionIcon
                    variant="light"
                    onClick={async () => {
                      if (!newFolder.trim()) return;
                      await updateAndRefreshData({
                        ...data,
                        excludedFolders: [
                          ...data.excludedFolders,
                          { id: crypto.randomUUID(), path: newFolder.trim() },
                        ],
                      });
                      setNewFolder("");
                    }}
                  >
                    <PlusIcon size={16} />
                  </ActionIcon>
                </Group>

                {data.excludedFolders.map((f) => (
                  <Group key={f.id} justify="space-between" px="xs">
                    <Text size="sm" lineClamp={1}>
                      {f.path}
                    </Text>
                    <ActionIcon
                      color="red"
                      variant="subtle"
                      onClick={async () => {
                        const updated = data.excludedFolders.filter(
                          (x) => x.id !== f.id,
                        );
                        await updateAndRefreshData({
                          ...data,
                          excludedFolders: updated,
                        });
                      }}
                    >
                      <TrashIcon size={14} />
                    </ActionIcon>
                  </Group>
                ))}
              </Stack>

              <Divider />

              {/* Excluded filenames */}
              <Stack gap={6}>
                <Text size="sm" fw={600}>
                  Excluded filenames
                </Text>

                <Group gap="xs" align="flex-start">
                  <TextInput
                    placeholder={
                      newIsRegex ? "Regex pattern" : "Filename contains…"
                    }
                    value={newFilename}
                    onChange={(e) => setNewFilename(e.currentTarget.value)}
                    style={{ flex: 1 }}
                  />

                  <Checkbox
                    label="Regex"
                    checked={newIsRegex}
                    onChange={(e) => setNewIsRegex(e.currentTarget.checked)}
                  />

                  <ActionIcon
                    variant="light"
                    onClick={async () => {
                      if (!newFilename.trim()) return;
                      await updateAndRefreshData({
                        ...data,
                        excludedFilenames: [
                          ...data.excludedFilenames,
                          {
                            id: crypto.randomUUID(),
                            pattern: newFilename.trim(),
                            isRegex: newIsRegex,
                          },
                        ],
                      });
                      setNewFilename("");
                      setNewIsRegex(false);
                    }}
                  >
                    <PlusIcon size={16} />
                  </ActionIcon>
                </Group>

                {data.excludedFilenames.map((f) => (
                  <Group key={f.id} justify="space-between" px="xs">
                    <Group gap="xs">
                      <Text size="sm" lineClamp={1}>
                        {f.pattern}
                      </Text>
                      {f.isRegex && (
                        <Text size="xs" c="dimmed">
                          (regex)
                        </Text>
                      )}
                    </Group>

                    <ActionIcon
                      color="red"
                      variant="subtle"
                      onClick={async () => {
                        const updated = data.excludedFilenames.filter(
                          (x) => x.id !== f.id,
                        );
                        await updateAndRefreshData({
                          ...data,
                          excludedFilenames: updated,
                        });
                      }}
                    >
                      <TrashIcon size={14} />
                    </ActionIcon>
                  </Group>
                ))}
              </Stack>
            </Stack>
          </Collapse>
        </Paper>

        {/* Main content */}
        <Group align="stretch" grow style={{ flex: 1, minHeight: 0 }}>
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
                  bg={
                    !shuffle &&
                    currentIndex !== null &&
                    data.files[currentIndex]?.id === item.id
                      ? "var(--mantine-color-blue-light)"
                      : undefined
                  }
                >
                  <Text size="sm">{item.name}</Text>
                  <Text size="xs" c="dimmed">
                    {item.path}
                  </Text>
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
