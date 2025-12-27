import {
  Checkbox,
  Stack,
  Title,
  Paper,
  Box,
  Divider,
  Text,
  Slider,
} from "@mantine/core";
import { invoke } from "@tauri-apps/api/core";
import { useAppSettings } from "../hooks/useAppSettings";
import { AppSettings } from "../../types/settings";
import { useEffect, useState } from "react";

const FileRandomiserSettings = () => {
  const { settings, setSettings } = useAppSettings();
  const [localRandomnessValue, setLocalRandomnessValue] = useState(
    settings.fileRandomiser.randomness_level ?? 50,
  );

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

  // Debounce logic
  useEffect(() => {
    const handler = setTimeout(async () => {
      if (localRandomnessValue !== settings.fileRandomiser.randomness_level) {
        try {
          const updated: AppSettings = await invoke("set_randomness_level", {
            level: localRandomnessValue,
          });
          setSettings(updated);
        } catch (err) {
          console.error("Failed to update randomness level:", err);
        }
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(handler);
  }, [localRandomnessValue]);

  // Keep localValue in sync if settings change externally
  useEffect(() => {
    setLocalRandomnessValue(settings.fileRandomiser.randomness_level ?? 50);
  }, [settings.fileRandomiser.randomness_level]);

  return (
    <Box
      p="lg"
      style={{
        height: "calc(100vh - 32px)",
        overflowY: "auto",
      }}
    >
      <Paper shadow="sm" p="lg" radius="md" withBorder>
        <Stack gap="xl">
          <Title order={3}>File Randomiser Settings</Title>
          <Divider />

          {/* Process Tracking */}
          <Stack gap="sm">
            <Title order={4}>Process Tracking (Feature Flag)</Title>
            <Text size="sm" c="dimmed">
              This toggle enables the process tracking feature in the main app.
              <br />
              Once enabled, the File Randomiser will automatically open the next
              file (or a random file if shuffle is active) whenever a file is
              closed, until tracking is disabled.
              <br />
              <strong>Important:</strong> If an app closes unexpectedly, too
              soon, or opens in an existing instance, it may cause crashes.
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

          {/* Randomness Slider */}
          <Stack gap="sm" mb="sm">
            <Title order={4}>Randomness</Title>
            <Text size="sm" c="dimmed">
              Control how random the file picker feels. Lower values favor the
              next files in order.
            </Text>

            <Slider
              value={localRandomnessValue}
              onChange={setLocalRandomnessValue}
              min={0}
              max={100}
              step={1}
              marks={[
                { value: 0, label: "0" },
                { value: 25, label: "25" },
                { value: 50, label: "50 (default)" },
                { value: 75, label: "75" },
                { value: 100, label: "100" },
              ]}
            />
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
};

export default FileRandomiserSettings;
