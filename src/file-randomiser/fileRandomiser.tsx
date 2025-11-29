import {
  Button,
  Checkbox,
  TextInput,
  Grid,
  Stack,
  Title,
  Text,
  Box,
  Group,
  Divider,
  Paper,
} from "@mantine/core";
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AppStateData } from "../types/filerandomiser";

const FileRandomiser = () => {
  const [data, setData] = useState<AppStateData>({
    paths: [],
    files: [],
    history: [],
  });

  // Fetch data on mount
  useEffect(() => {
    invoke<AppStateData>("get_initial_app_data")
      .then((response) => setData(response))
      .catch((err) => console.error("Failed to fetch data:", err));
  }, []);

  return (
    <Box p="lg">
      <Paper shadow="sm" p="lg" radius="md" withBorder>
        {/* Top section: Controls */}
        <Group justify="space-between" mb="lg">
          <Group>
            <Button
              variant="filled"
              onClick={() => invoke("my_custom_command")}
            >
              Add Path
            </Button>
            <Button variant="filled" onClick={() => console.log("Crawl files")}>
              Crawl Files
            </Button>
            <Button variant="filled" onClick={() => console.log("Get file")}>
              Get Random File
            </Button>
          </Group>
          <Group gap="md">
            <Checkbox label="Shuffle" defaultChecked />
            <Checkbox label="Tracking" defaultChecked />
          </Group>
        </Group>

        <Divider mb="lg" />

        {/* Search input without icon */}
        <TextInput
          placeholder="Search for files or paths..."
          mb="lg"
          onChange={(event) =>
            console.log("Search:", event.currentTarget.value)
          }
        />

        {/* Bottom section: Lists in a Grid */}
        <Grid gutter="xl">
          {/* Paths List */}
          <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
            <Stack>
              <Title order={4}>Paths</Title>
              <Divider />
              <Stack gap="xs">
                {data.paths.map((item) => (
                  <Box
                    key={item.id}
                    py="xs"
                    px="sm"
                    style={{
                      border: "1px solid var(--mantine-color-gray-3)",
                      borderRadius: "8px",
                      backgroundColor: "var(--mantine-color-gray-0)",
                    }}
                  >
                    <Group justify="space-between" align="center">
                      <Stack gap={2}>
                        <Text fw={700}>{item.name}</Text>
                        <Text size="sm" c="dimmed">
                          {item.path}
                        </Text>
                      </Stack>
                      <Button
                        variant="subtle"
                        size="xs"
                        color="red"
                        onClick={() => console.log("Delete path", item.id)}
                      >
                        Delete
                      </Button>
                    </Group>
                  </Box>
                ))}
              </Stack>
            </Stack>
          </Grid.Col>

          {/* Files List */}
          <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
            <Stack>
              <Title order={4}>Files</Title>
              <Divider />
              <Stack gap="xs">
                {data.files.map((item) => (
                  <Box
                    key={item.id}
                    py="xs"
                    px="sm"
                    style={{
                      border: "1px solid var(--mantine-color-gray-3)",
                      borderRadius: "8px",
                      backgroundColor: "var(--mantine-color-gray-0)",
                    }}
                  >
                    <Stack gap={2}>
                      <Text fw={500}>{item.name}</Text>
                      <Text size="sm" c="dimmed">
                        {item.path}
                      </Text>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </Stack>
          </Grid.Col>

          {/* History List */}
          <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
            <Stack>
              <Title order={4}>History</Title>
              <Divider />
              <Stack gap="xs">
                {data.history.map((item) => (
                  <Box
                    key={item.id}
                    py="xs"
                    px="sm"
                    style={{
                      border: "1px solid var(--mantine-color-gray-3)",
                      borderRadius: "8px",
                      backgroundColor: "var(--mantine-color-gray-0)",
                    }}
                  >
                    <Stack gap={2}>
                      <Text fw={500}>{item.name}</Text>
                      <Text size="sm" c="dimmed">
                        {item.path}
                      </Text>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </Stack>
          </Grid.Col>
        </Grid>
      </Paper>
    </Box>
  );
};

export default FileRandomiser;
