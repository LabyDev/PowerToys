import {
  Stack,
  Title,
  Paper,
  Box,
  Divider,
  Text,
  Select,
  Button,
  Group,
} from "@mantine/core";
import { invoke } from "@tauri-apps/api/core";
import { useAppSettings } from "../hooks/useAppSettings";
import { DarkModeOption, AppSettings } from "../../types/settings";

const AppSettingsPage = () => {
  const { settings, setSettings } = useAppSettings();
  // Handle dark mode selection
  const handleDarkModeChange = async (value: DarkModeOption) => {
    try {
      const updatedSettings: AppSettings = await invoke("set_dark_mode", {
        mode: value,
      });
      setSettings(updatedSettings);
    } catch (err) {
      console.error("Failed to update dark mode:", err);
    }
  };

  // Trigger Tauri to select a background file
  const handleBackgroundSelect = async () => {
    try {
      const updatedSettings: AppSettings = await invoke(
        "set_custom_background",
      );
      setSettings(updatedSettings);
    } catch (err) {
      console.error("Failed to select background:", err);
    }
  };

  // Clear current background
  const handleBackgroundClear = async () => {
    try {
      const updatedSettings: AppSettings = await invoke(
        "clear_custom_background",
      );
      setSettings(updatedSettings);
    } catch (err) {
      console.error("Failed to clear background:", err);
    }
  };

  return (
    <Box p="lg">
      <Paper shadow="sm" p="lg" radius="md" withBorder>
        <Stack gap="xl">
          <Title order={3}>Application Settings</Title>
          <Divider />

          {/* Appearance */}
          <Stack gap="sm">
            <Title order={4}>Appearance</Title>
            <Text size="sm" c="dimmed">
              Control the look and feel of the application.
            </Text>

            {/* Dark Mode */}
            <Select
              label="Dark Mode"
              description="Choose your theme preference."
              value={settings.darkMode} // ensure key matches
              onChange={(val) => handleDarkModeChange(val as DarkModeOption)}
              data={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
                { value: "system", label: "Follow System" },
              ]}
            />
            <Text size="xs" c="dimmed">
              Changing the theme will take effect after restarting the
              application.
            </Text>

            {/* Custom Background */}
            <Group gap="sm">
              <Button onClick={handleBackgroundSelect}>
                Select Custom Background
              </Button>
              <Button
                color="red"
                variant="outline"
                onClick={handleBackgroundClear}
              >
                Clear Background
              </Button>
            </Group>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
};

export default AppSettingsPage;
