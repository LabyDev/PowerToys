import {
  Checkbox,
  Stack,
  Title,
  Paper,
  Box,
  Divider,
  Text,
} from "@mantine/core";
import { invoke } from "@tauri-apps/api/core";
import { useAppSettings } from "../hooks/useAppSettings";
import { AppSettings } from "../../types/settings";

const FileRandomiserSettings = () => {
  const { settings, setSettings } = useAppSettings();

  const handleContextMenuToggle = async (checked: boolean) => {
    try {
      const updated: AppSettings = await invoke("toggle_context_menu_item", {
        enable: checked,
      });
      setSettings(updated);
    } catch (err) {
      console.error("Failed to toggle context menu:", err);
    }
  };

  const handleProcessTrackingToggle = async (checked: boolean) => {
    try {
      const updated: AppSettings = await invoke("toggle_process_tracking", {
        enable: checked,
      });
      setSettings(updated);
    } catch (err) {
      console.error("Failed to toggle process tracking:", err);
    }
  };

  return (
    <Box p="lg">
      <Paper shadow="sm" p="lg" radius="md" withBorder>
        <Stack gap="xl">
          <Title order={3}>File Randomiser Settings</Title>
          <Divider />

          <Stack gap="sm">
            <Title order={4}>Integrations</Title>
            <Text size="sm" c="dimmed">
              Control how the app integrates with your system&apos;s right-click
              menus.
            </Text>

            <Checkbox
              checked={settings.fileRandomiser.enable_context_menu}
              label="Enable right-click context menu item (Opens a random file)"
              description="This feature allows you to right-click anywhere and quickly open a random file from your tracked paths."
              onChange={(event) =>
                handleContextMenuToggle(event.currentTarget.checked)
              }
              size="md"
            />
          </Stack>

          <Stack gap="sm">
            <Title order={4}>Process Tracking (Feature Flag)</Title>
            <Text size="sm" c="dimmed">
              This toggle enables the process tracking feature in the main app.
              <br />
              Once enabled in the app itself, the File Randomiser will
              automatically open the next file (or a random file if shuffle is
              active) whenever a file is closed, until tracking is disabled in
              the app.
              <br />
              <strong>Important:</strong> If an app closes unexpectedly, too
              soon, or opens in an existing instance (like a browser tab), it
              may cause the system or app to crash.
            </Text>

            <Checkbox
              checked={settings.fileRandomiser.allow_process_tracking}
              label="Enable process tracking feature"
              description="This setting only enables the feature; tracking itself must still be toggled in the main app."
              onChange={(event) =>
                handleProcessTrackingToggle(event.currentTarget.checked)
              }
              size="md"
              color="red"
            />
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
};

export default FileRandomiserSettings;
