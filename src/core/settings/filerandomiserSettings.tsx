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

const FileRandomiserSettings = () => {
  const { settings, setSettings } = useAppSettings();

  const handleContextMenuToggle = async (checked: boolean) => {
    try {
      const updated: boolean = await invoke("toggle_context_menu_item", {
        enable: checked,
      });
      setSettings({
        fileRandomiser: {
          ...settings.fileRandomiser,
          enable_context_menu: updated,
        },
      });
    } catch (err) {
      console.error("Failed to toggle context menu:", err);
    }
  };

  const handleProcessTrackingToggle = async (checked: boolean) => {
    try {
      const updated: boolean = await invoke("toggle_process_tracking", {
        enable: checked,
      });
      setSettings({
        fileRandomiser: {
          ...settings.fileRandomiser,
          allow_process_tracking: updated,
        },
      });
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
            <Title order={4}>Experimental Features</Title>
            <Text size="sm" c="dimmed">
              These features are unstable and may cause high CPU/RAM usage or
              other issues. Enable at your own risk.
            </Text>

            <Checkbox
              checked={settings.fileRandomiser.allow_process_tracking}
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

export default FileRandomiserSettings;
