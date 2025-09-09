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

// You would replace this with actual data from your application's state management
const mockData = {
  paths: [
    { id: 1, name: "Documents", path: "/home/user/documents" },
    { id: 2, name: "Pictures", path: "/home/user/pictures" },
  ],
  files: [
    { id: 1, name: "image1.png", path: "/home/user/pictures/image1.png" },
    { id: 2, name: "report.pdf", path: "/home/user/documents/report.pdf" },
  ],
  history: [
    { id: 1, name: "old_file.txt", path: "/home/user/documents/old_file.txt" },
  ],
};

const FileRandomiser = () => {
  return (
    <Box p="lg">
      <Paper shadow="sm" p="lg" radius="md" withBorder>
        {/* Top section: Controls */}
        <Group justify="space-between" mb="lg">
          <Group>
            <Button variant="filled" onClick={() => console.log("Add path")}>
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
                {mockData.paths.map((item) => (
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
                {mockData.files.map((item) => (
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
                {mockData.history.map((item) => (
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
