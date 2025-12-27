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
import { useTranslation } from "react-i18next";

const FileRandomiserSettings = () => {
  const { t } = useTranslation();
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
    <Box p="lg" style={{ height: "calc(100vh - 32px)", overflowY: "auto" }}>
      <Paper shadow="sm" p="lg" radius="md" withBorder>
        <Stack gap="xl">
          <Title order={3}>{t("fileRandomiserSettings.title")}</Title>
          <Divider />

          {/* Process Tracking */}
          <Stack gap="sm">
            <Title order={4}>
              {t("fileRandomiserSettings.processTracking.title")}
            </Title>
            <Text size="sm" c="dimmed">
              {t("fileRandomiserSettings.processTracking.description")}
            </Text>

            <Checkbox
              checked={settings.fileRandomiser.allow_process_tracking}
              label={t("fileRandomiserSettings.processTracking.checkboxLabel")}
              description={t(
                "fileRandomiserSettings.processTracking.checkboxDescription",
              )}
              onChange={(event) =>
                handleProcessTrackingToggle(event.currentTarget.checked)
              }
              size="md"
              color="red"
            />
          </Stack>

          {/* Randomness Slider */}
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
