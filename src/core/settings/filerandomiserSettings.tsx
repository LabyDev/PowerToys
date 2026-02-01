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
import { useAppSettings } from "../hooks/useAppSettings";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  toggleProcessTracking,
  setRandomnessLevel,
} from "../api/appSettingsApi";
import { platform, Platform } from "@tauri-apps/plugin-os";

const FileRandomiserSettings = () => {
  const { t } = useTranslation();
  const { settings, setSettings } = useAppSettings();

  const [isLinux, setIsLinux] = useState(false);
  const [localRandomnessValue, setLocalRandomnessValue] = useState(
    settings.fileRandomiser.randomness_level ?? 50,
  );

  // Detect OS via Tauri v2 OS plugin
  useEffect(() => {
    try {
      const currentPlatform: Platform = platform();
      setIsLinux(currentPlatform === "linux");
    } catch (err: unknown) {
      console.error("Failed to detect platform:", err);
    }
  }, []);

  const handleProcessTrackingToggle = async (checked: boolean) => {
    if (isLinux) return;

    try {
      const updated = await toggleProcessTracking(checked);
      setSettings(updated);
    } catch (err: unknown) {
      console.error("Failed to toggle process tracking:", err);
    }
  };

  // Debounce randomness level changes
  useEffect(() => {
    const handler = setTimeout(async () => {
      if (localRandomnessValue !== settings.fileRandomiser.randomness_level) {
        try {
          const updated = await setRandomnessLevel(localRandomnessValue);
          setSettings(updated);
        } catch (err: unknown) {
          console.error("Failed to update randomness level:", err);
        }
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [
    localRandomnessValue,
    settings.fileRandomiser.randomness_level,
    setSettings,
  ]);

  // Sync local slider if settings change externally
  useEffect(() => {
    setLocalRandomnessValue(settings.fileRandomiser.randomness_level ?? 50);
  }, [settings.fileRandomiser.randomness_level]);

  return (
    <Box p="lg" style={{ height: "calc(100vh - 32px)", overflowY: "auto" }}>
      <Paper shadow="sm" p="lg" radius="md" withBorder>
        <Stack gap="xl">
          <Title order={3}>{t("fileRandomiserSettings.title")}</Title>
          <Divider />

          <Stack gap="sm">
            <Title order={4}>
              {t("fileRandomiserSettings.processTracking.title")}
            </Title>

            <Text size="sm" c="dimmed">
              {isLinux
                ? "Process tracking is not supported on Linux due to how process isolation and permissions work."
                : t("fileRandomiserSettings.processTracking.description")}
            </Text>

            <Checkbox
              checked={
                isLinux ? false : settings.fileRandomiser.allow_process_tracking
              }
              disabled={isLinux}
              label={t("fileRandomiserSettings.processTracking.checkboxLabel")}
              description={
                isLinux
                  ? "Unavailable on Linux"
                  : t(
                      "fileRandomiserSettings.processTracking.checkboxDescription",
                    )
              }
              onChange={(event) =>
                handleProcessTrackingToggle(event.currentTarget.checked)
              }
              size="md"
              color="red"
            />
          </Stack>

          <Stack gap="sm" mb="sm">
            <Title order={4}>
              {t("fileRandomiserSettings.randomness.title")}
            </Title>
            <Text size="sm" c="dimmed">
              {t("fileRandomiserSettings.randomness.description")}
            </Text>

            <Slider
              value={localRandomnessValue}
              onChange={setLocalRandomnessValue}
              min={0}
              max={100}
              step={1}
              marks={[
                {
                  value: 0,
                  label: t("fileRandomiserSettings.randomness.sliderMarks.0"),
                },
                {
                  value: 25,
                  label: t("fileRandomiserSettings.randomness.sliderMarks.25"),
                },
                {
                  value: 50,
                  label: t("fileRandomiserSettings.randomness.sliderMarks.50"),
                },
                {
                  value: 75,
                  label: t("fileRandomiserSettings.randomness.sliderMarks.75"),
                },
                {
                  value: 100,
                  label: t("fileRandomiserSettings.randomness.sliderMarks.100"),
                },
              ]}
            />
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
};

export default FileRandomiserSettings;
