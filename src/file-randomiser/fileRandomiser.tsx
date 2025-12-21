import {
  ActionIcon,
  Box,
  Button,
  Checkbox,
  Divider,
  Group,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import {
  FolderPlusIcon,
  ArrowsClockwiseIcon,
  MagnifyingGlassIcon,
  ShuffleIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { AppStateData } from "../types/filerandomiser";
import "./fileRandomiser.css";
import { listen } from "@tauri-apps/api/event";

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <Paper withBorder radius="md" p="sm" style={{ height: "100%" }}>
    <Stack gap="xs" h="100%">
      <Title order={5}>{title}</Title>
      <Divider />
      <Box style={{ flex: 1, minHeight: 0 }}>{children}</Box>
    </Stack>
  </Paper>
);

const FileRandomiser = () => {
  const [data, setData] = useState<AppStateData>({
    paths: [],
    files: [],
    history: [],
  });

  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const currentIndexRef = useRef<number | null>(null);

  const [query, setQuery] = useState("");
  const [shuffle, setShuffle] = useState(false);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [tracking, setTracking] = useState(false);

  useEffect(() => {
    refreshData();
  }, []);

  // Keep the ref in sync whenever state changes
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

  const refreshData = async () => {
    const updated = await invoke<AppStateData>("get_app_state");
    setData(updated);
  };

  const reversedHistory = useMemo(() => {
    return [...data.history].sort(
      (a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime(),
    );
  }, [data.history]);

  const handleAddPath = async () => {
    await invoke("add_path_via_dialog");
    await handleCrawl();
  };

  const handleCrawl = async () => {
    await invoke("crawl_paths");
    await refreshData();
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
    await refreshData();
  }, [data.files, shuffle, currentIndex]);

  const filteredFiles = useMemo(() => {
    if (!query) return data.files;
    const q = query.toLowerCase();
    return data.files.filter((f) => f.name.toLowerCase().includes(q));
  }, [data.files, query]);

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
              <Checkbox
                label="Tracking"
                checked={tracking}
                onChange={(e) => setTracking(e.currentTarget.checked)}
              />
            </Group>
          </Group>
        </Paper>

        {/* Search */}
        <TextInput
          placeholder="Search files…"
          leftSection={<MagnifyingGlassIcon size={16} />}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
        />

        {/* Main content */}
        <Group align="stretch" grow style={{ flex: 1, minHeight: 0 }}>
          {/* Paths */}
          <Section title={`Paths (${data.paths?.length})`}>
            <Virtuoso
              data={data.paths}
              itemContent={(_, item) => (
                <Group
                  key={item.id}
                  px="sm"
                  py={6}
                  style={{ alignItems: "center", gap: 8 }}
                  className="path-item"
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
                    onClick={async () => {
                      const removed = await invoke<boolean>("remove_path", {
                        id: item.id,
                      });
                      if (removed) {
                        handleCrawl();
                      }
                    }}
                    className="trash-icon"
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
              itemContent={(_index, item) => (
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
                  <Text
                    size="sm"
                    fw={
                      !shuffle &&
                      currentIndex !== null &&
                      data.files[currentIndex]?.id === item.id
                        ? 600
                        : 400
                    }
                  >
                    {item.name}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {item.path}
                  </Text>
                </Box>
              )}
            />
          </Section>

          {/* History */}
          <Section title={`History (${data.history.length})`}>
            <Virtuoso
              data={reversedHistory}
              itemContent={(_, item) => {
                const opened = new Date(item.openedAt);
                const formattedDate = `${opened.getDate().toString().padStart(2, "0")} ${opened.toLocaleString(
                  "en",
                  { month: "short" },
                )} ${opened.getFullYear()} ${opened.getHours().toString().padStart(2, "0")}:${opened.getMinutes().toString().padStart(2, "0")}:${opened.getSeconds().toString().padStart(2, "0")}`;

                return (
                  <Box px="sm" py={6}>
                    <Text size="sm" lineClamp={1}>
                      {item.name}
                    </Text>
                    <Text size="xs" c="dimmed" lineClamp={1}>
                      {item.path}
                    </Text>
                    <Text size="xs" c="dimmed" lineClamp={1} tt="italic">
                      Opened at: {formattedDate}
                    </Text>
                  </Box>
                );
              }}
            />
          </Section>
        </Group>
      </Stack>
    </Box>
  );
};

export default FileRandomiser;
