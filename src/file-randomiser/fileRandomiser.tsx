import {
  Button,
  Checkbox,
  TextInput,
  Flex,
  Grid,
  Stack,
  Title,
  Text,
  Box,
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
    <Box p="md">
      {/* Top section: Buttons and Checkboxes */}
      <Flex
        direction="row"
        align="center"
        justify="space-evenly"
        wrap="wrap"
        style={{ height: 100 }}
        mb="lg"
      >
        <Button onClick={() => console.log("Add path")}>
          Click to add path!
        </Button>
        <Button onClick={() => console.log("Crawl files")}>
          Click to crawl files!
        </Button>
        <Button onClick={() => console.log("Get file")}>
          Click to get file!
        </Button>

        <Flex direction="row" align="center" gap="xs">
          <Checkbox label="Shuffle" />
        </Flex>

        <Flex direction="row" align="center" gap="xs">
          <Checkbox label="Tracking" />
        </Flex>

        <TextInput
          placeholder="Search items..."
          onChange={(event) =>
            console.log("Search:", event.currentTarget.value)
          }
        />
      </Flex>

      {/* Bottom section: Lists */}
      <Grid gutter="md">
        {/* Paths List */}
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Stack>
            <Box bg="gray.2" p="sm">
              <Title order={5}>Paths</Title>
            </Box>
            {mockData.paths.map((item) => (
              <Box
                key={item.id}
                p="xs"
                style={{ borderBottom: "1px solid #eee" }}
              >
                <Text fw={700}>{item.name}</Text>
                <Text size="sm" c="dimmed">
                  {item.path}
                </Text>
                {/* Context menu for delete is more complex in Mantine, but this shows the basic structure. */}
                <Button
                  variant="subtle"
                  size="xs"
                  color="red"
                  onClick={() => console.log("Delete path", item.id)}
                >
                  Delete
                </Button>
              </Box>
            ))}
          </Stack>
        </Grid.Col>

        {/* Files List */}
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Stack>
            <Box bg="gray.2" p="sm">
              <Title order={5}>Files</Title>
            </Box>
            {mockData.files.map((item) => (
              <Box
                key={item.id}
                p="xs"
                style={{ borderBottom: "1px solid #eee" }}
              >
                <Text>{item.name}</Text>
                <Text size="sm" c="dimmed">
                  {item.path}
                </Text>
              </Box>
            ))}
          </Stack>
        </Grid.Col>

        {/* History List */}
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Stack>
            <Box bg="gray.2" p="sm">
              <Title order={5}>History</Title>
            </Box>
            {mockData.history.map((item) => (
              <Box
                key={item.id}
                p="xs"
                style={{ borderBottom: "1px solid #eee" }}
              >
                <Text>{item.name}</Text>
                <Text size="sm" c="dimmed">
                  {item.path}
                </Text>
              </Box>
            ))}
          </Stack>
        </Grid.Col>
      </Grid>
    </Box>
  );
};

export default FileRandomiser;
