import {
  Checkbox,
  Stack,
  Title,
  Paper,
  Box,
  Divider,
  Text,
} from "@mantine/core";
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

type AppSettings = {
  enableContextMenu: boolean;
};

const Settings = () => {
  const [settings, setSettings] = useState<AppSettings>({
    enableContextMenu: false,
  });

  useEffect(() => {
    invoke<AppSettings>("get_app_settings")
      .then((response) => setSettings(response))
      .catch((err) => console.error("Failed to fetch settings:", err));
  }, []);

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
        </Stack>
      </Paper>
    </Box>
  );
};

export default Settings;
