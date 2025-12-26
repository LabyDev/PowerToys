import { Stack, Title, Paper, Box, Divider } from "@mantine/core";

const Settings = () => {
  return (
    <Box p="lg">
      <Paper shadow="sm" p="lg" radius="md" withBorder>
        <Stack gap="xl">
          <Title order={3}>Application Settings</Title>
          <Divider />
        </Stack>
      </Paper>
    </Box>
  );
};

export default Settings;
