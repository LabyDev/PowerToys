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

const Settings = () => {
  const { settings, setSettings } = useAppSettings();

  const handleContextMenuToggle = async (checked: boolean) => {
    setSettings((prev) => ({ ...prev, enableContextMenu: checked }));
    try {
      await invoke("toggle_context_menu_item", { enable: checked });
      console.log(`Context menu toggled: ${checked}`);
    } catch (err) {
      console.error("Failed to toggle context menu:", err);
      setSettings((prev) => ({ ...prev, enableContextMenu: !checked }));
    }
  };

  const handleProcessTrackingToggle = async (checked: boolean) => {
    setSettings((prev) => ({ ...prev, allowProcessTracking: checked }));
    try {
      await invoke("toggle_process_tracking", { enable: checked });
      console.log(`Process tracking permission toggled: ${checked}`);
    } catch (err) {
      console.error("Failed to toggle process tracking permission:", err);
      setSettings((prev) => ({ ...prev, allowProcessTracking: !checked }));
    }
  };

  return (
    <Box p="lg">
      <Paper shadow="sm" p="lg" radius="md" withBorder>
        <Stack gap="xl">
          <Title order={3}>Application Settings</Title>
          <Divider />

          <Stack gap="sm">
            <Title order={4}>Integrations</Title>
            <Text size="sm" c="dimmed">
              Control how the app integrates with your system&apos;s right-click
              menus.
            </Text>

            <Checkbox
              checked={settings.enableContextMenu}
              label="Enable right-click context menu item (Opens a random file)"
              description="This feature allows you to right-click anywhere and quickly open a random file from your tracked paths."
              onChange={(event) =>
                handleContextMenuToggle(event.currentTarget.checked)
              }
              size="md"
            />
          </Stack>

          <Stack gap="sm">
            <Title order={4}>Experimental Features</Title>
            <Text size="sm" c="dimmed">
              These features are unstable and may cause high CPU/RAM usage or
              other issues. Enable at your own risk.
            </Text>

            <Checkbox
              checked={settings.allowProcessTracking}
              label="Allow process tracking"
              description="Enables the File Randomiser to track opened processes. May spam processes or consume significant memory depending on the program."
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

export default Settings;
