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
  FolderPlus,
  ArrowsClockwise,
  MagnifyingGlass,
  Shuffle,
  Trash,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Virtuoso } from "react-virtuoso";
import { AppStateData } from "../types/filerandomiser";

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/*                              FileRandomiser                                */
/* -------------------------------------------------------------------------- */

const FileRandomiser = () => {
  const [data, setData] = useState<AppStateData>({
    paths: [],
    files: [],
    history: [],
  });

  const [query, setQuery] = useState("");
  const [shuffle, setShuffle] = useState(true);
  const [tracking, setTracking] = useState(true);

  /* ------------------------------- Lifecycle ------------------------------- */

  useEffect(() => {
    refreshData();
  }, []);

  /* -------------------------------- Helpers -------------------------------- */

  const refreshData = async () => {
    const updated = await invoke<AppStateData>("get_app_state");
    setData(updated);
  };

  /* -------------------------------- Actions -------------------------------- */

  const handleAddPath = async () => {
    await invoke("add_path_via_dialog");
    await refreshData();
  };

  const handleCrawl = async () => {
    await invoke("crawl_paths");
    await refreshData();
  };

  const handleRandomFile = async () => {
    const updated = await invoke<AppStateData>("pick_random_file", {
      shuffle,
      tracking,
    });

    setData(updated);
  };

  /* --------------------------------- Derived -------------------------------- */

  const filteredFiles = useMemo(() => {
    if (!query) return data.files;
    const q = query.toLowerCase();
    return data.files.filter((f) => f.name.toLowerCase().includes(q));
  }, [data.files, query]);

  /* ---------------------------------- Render -------------------------------- */

  return (
    <Box p="md" h="88vh">
      <Stack h="100%" gap="md">
        {/* Top toolbar */}
        <Paper withBorder radius="md" p="sm">
          <Group justify="space-between" wrap="nowrap">
            <Group>
              <Button
                leftSection={<FolderPlus size={16} />}
                onClick={handleAddPath}
              >
                Add path
              </Button>

              <Button
                variant="light"
                leftSection={<ArrowsClockwise size={16} />}
                onClick={handleCrawl}
              >
                Crawl
              </Button>

              <Button
                variant="filled"
                leftSection={<Shuffle size={16} />}
                onClick={handleRandomFile}
              >
                Random file
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
          leftSection={<MagnifyingGlass size={16} />}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
        />

        {/* Main content */}
        <Group align="stretch" grow style={{ flex: 1, minHeight: 0 }}>
          {/* Paths */}
          <Section title={`Paths (${data.paths.length})`}>
            <Virtuoso
              data={data.paths}
              itemContent={(_, item) => (
                <Group key={item.id} justify="space-between" px="sm" py={6}>
                  <Stack gap={0}>
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
                      await invoke("remove_path", { id: item.id });
                      await refreshData();
                    }}
                  >
                    <Trash size={16} />
                  </ActionIcon>
                </Group>
              )}
            />
          </Section>

          {/* Files */}
          <Section title={`Files (${filteredFiles.length})`}>
            <Virtuoso
              style={{ height: "100%" }}
              data={filteredFiles}
              itemContent={(_, item) => (
                <Box px="sm" py={6}>
                  <Text size="sm" lineClamp={1}>
                    {item.name}
                  </Text>
                  <Text size="xs" c="dimmed" lineClamp={1}>
                    {item.path}
                  </Text>
                </Box>
              )}
            />
          </Section>

          {/* History */}
          <Section title={`History (${data.history.length})`}>
            <Virtuoso
              data={data.history}
              itemContent={(_, item) => (
                <Box px="sm" py={6}>
                  <Text size="sm" lineClamp={1}>
                    {item.name}
                  </Text>
                  <Text size="xs" c="dimmed" lineClamp={1}>
                    {item.path}
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
