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

  const [query, setQuery] = useState("");

  useEffect(() => {
    invoke<AppStateData>("get_initial_app_data")
      .then(setData)
      .catch(console.error);
  }, []);

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
              <Button leftSection={<FolderPlus size={16} />}>Add path</Button>
              <Button
                variant="light"
                leftSection={<ArrowsClockwise size={16} />}
              >
                Crawl
              </Button>
              <Button variant="filled" leftSection={<Shuffle size={16} />}>
                Random file
              </Button>
            </Group>

            <Group>
              <Checkbox label="Shuffle" defaultChecked />
              <Checkbox label="Tracking" defaultChecked />
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
                  <ActionIcon color="red" variant="subtle">
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
