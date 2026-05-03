import {
  Box,
  Checkbox,
  Divider,
  Group,
  Paper,
  Slider,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { platform, Platform } from "@tauri-apps/plugin-os";
import { invoke } from "@tauri-apps/api/core";

import { useAppSettings } from "../hooks/useAppSettings";
import {
  toggleProcessTracking,
  setRandomnessLevel,
} from "../api/appSettingsApi";
import { AppSettings, ColorWeightEntry } from "../../types/settings";
import { DEFAULT_BOOKMARK_COLOR_OPTIONS } from "../../types/common";

const DEFAULT_ENTRY: ColorWeightEntry = { local: 1.0, global: 1.0 };

const FileRandomiserSettings = () => {
  const { t } = useTranslation();
  const { settings, setSettings } = useAppSettings();
  const colorOptions =
    settings.bookmarkColors ?? DEFAULT_BOOKMARK_COLOR_OPTIONS;
  const pref = settings.fileRandomiser.bookmarkPreference;

  const [isLinux, setIsLinux] = useState(false);

  const [localRandomnessValue, setLocalRandomnessValue] = useState<number>(
    settings.fileRandomiser.randomnessLevel ?? 50,
  );

  // Local slider state for color weights — avoids invoking on every drag tick
  const [localColorWeights, setLocalColorWeights] = useState<
    Record<string, ColorWeightEntry>
  >(() =>
    Object.fromEntries(
      colorOptions.map(({ hex }) => [
        hex,
        pref?.colors?.[hex] ?? DEFAULT_ENTRY,
      ]),
    ),
  );

  // ---- Sync from external settings changes ----

  useEffect(() => {
    setLocalRandomnessValue(settings.fileRandomiser.randomnessLevel ?? 50);
  }, [settings.fileRandomiser.randomnessLevel]);

  useEffect(() => {
    setLocalColorWeights(
      Object.fromEntries(
        colorOptions.map(({ hex }) => [
          hex,
          pref?.colors?.[hex] ?? DEFAULT_ENTRY,
        ]),
      ),
    );
  }, [pref?.colors]);

  // ---- OS detection ----

  useEffect(() => {
    try {
      const currentPlatform: Platform = platform();
      setIsLinux(currentPlatform === "linux");
    } catch (err) {
      console.error("Failed to detect platform:", err);
    }
  }, []);

  // ---- Shared save helper ----

  const saveSettings = async (updated: AppSettings): Promise<void> => {
    try {
      console.log("saving settings:", JSON.stringify(updated.fileRandomiser));
      const result = await invoke<AppSettings>("set_app_settings", {
        settings: updated,
      });
      console.log("returned settings:", JSON.stringify(result.fileRandomiser));
      setSettings(result);
    } catch (err) {
      console.error("Failed to save settings:", err);
    }
  };

  // ---- Process tracking ----

  const handleProcessTrackingToggle = async (
    checked: boolean,
  ): Promise<void> => {
    if (isLinux) return;
    try {
      const updated = await toggleProcessTracking(checked);
      setSettings(updated);
    } catch (err) {
      console.error("Failed to toggle process tracking:", err);
    }
  };

  // ---- Randomness level (debounced) ----

  useEffect(() => {
    const handler = setTimeout(async () => {
      if (localRandomnessValue !== settings.fileRandomiser.randomnessLevel) {
        try {
          const updated = await setRandomnessLevel(localRandomnessValue);
          setSettings(updated);
        } catch (err) {
          console.error("Failed to update randomness level:", err);
        }
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [localRandomnessValue]);

  // ---- Show scores toggle ----

  const handleShowScoresToggle = async (checked: boolean): Promise<void> => {
    console.log("toggle clicked, checked:", checked);
    await saveSettings({
      ...settings,
      fileRandomiser: {
        ...settings.fileRandomiser,
        showScores: checked,
      },
    });
  };

  // ---- Bookmark preference enabled toggle ----

  const handleBookmarkPrefToggle = async (checked: boolean): Promise<void> => {
    await saveSettings({
      ...settings,
      fileRandomiser: {
        ...settings.fileRandomiser,
        bookmarkPreference: {
          ...pref,
          enabled: checked,
        },
      },
    });
  };

  // ---- Color weight sliders (debounced) ----
  const colorWeightsDirtyRef = useRef(false);
  const handleColorWeight = (
    hex: string,
    scope: "local" | "global",
    value: number,
  ): void => {
    colorWeightsDirtyRef.current = true;
    setLocalColorWeights((prev: Record<string, ColorWeightEntry>) => ({
      ...prev,
      [hex]: { ...prev[hex], [scope]: value },
    }));
  };

  useEffect(() => {
    if (!colorWeightsDirtyRef.current) return;
    const handler = setTimeout(async () => {
      colorWeightsDirtyRef.current = false;
      await saveSettings({
        ...settings,
        fileRandomiser: {
          ...settings.fileRandomiser,
          bookmarkPreference: {
            ...pref,
            colors: localColorWeights,
          },
        },
      });
    }, 400);
    return () => clearTimeout(handler);
  }, [localColorWeights]);

  return (
    <Box p="lg" style={{ height: "calc(100vh - 32px)", overflowY: "auto" }}>
      <Paper shadow="sm" p="lg" radius="md" withBorder>
        <Stack gap="xl">
          <Title order={3}>{t("fileRandomiserSettings.title")}</Title>
          <Divider />

          {/* Process tracking */}
          <Stack gap="sm">
            <Title order={4}>
              {t("fileRandomiserSettings.processTracking.title")}
            </Title>
            <Text size="sm" c="dimmed">
              {isLinux
                ? t("fileRandomiserSettings.processTracking.unsupportedOnLinux")
                : t("fileRandomiserSettings.processTracking.description")}
            </Text>
            <Checkbox
              checked={
                isLinux ? false : settings.fileRandomiser.allowProcessTracking
              }
              disabled={isLinux}
              label={t("fileRandomiserSettings.processTracking.checkboxLabel")}
              description={
                isLinux
                  ? t(
                      "fileRandomiserSettings.processTracking.checkboxUnavailable",
                    )
                  : t(
                      "fileRandomiserSettings.processTracking.checkboxDescription",
                    )
              }
              onChange={(e) =>
                handleProcessTrackingToggle(e.currentTarget.checked)
              }
              size="md"
              color="red"
            />
          </Stack>

          <Divider />

          {/* Randomness */}
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

          <Divider />

          {/* Bookmark preference */}
          <Stack gap="sm">
            <Title order={4}>Bookmark preference</Title>
            <Text size="sm" c="dimmed">
              Give bookmarked files a higher chance of being picked. Set a
              weight per colour for local and global bookmarks — 1.0 is neutral,
              higher values increase pick chance.
            </Text>
            <Checkbox
              checked={pref?.enabled ?? false}
              label="Enable bookmark preference"
              onChange={(e) =>
                handleBookmarkPrefToggle(e.currentTarget.checked)
              }
              size="md"
              color="yellow"
            />

            {pref?.enabled && (
              <Stack gap="lg" mt="xs">
                {colorOptions.map(({ hex, label }) => {
                  const entry: ColorWeightEntry =
                    localColorWeights[hex] ?? DEFAULT_ENTRY;
                  return (
                    <Group key={hex} align="flex-start" gap="md" wrap="nowrap">
                      {/* Swatch + label */}
                      <Stack
                        gap={2}
                        align="center"
                        style={{ flexShrink: 0, width: 44 }}
                      >
                        <Box
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 4,
                            background: hex,
                          }}
                        />
                        <Text size="xs">{label}</Text>
                      </Stack>

                      {/* Local + global sliders */}
                      <Stack gap={6} style={{ flex: 1 }}>
                        <Group gap="xs" align="center" wrap="nowrap">
                          <Text
                            size="xs"
                            c="dimmed"
                            style={{ width: 42, flexShrink: 0 }}
                          >
                            Local
                          </Text>
                          <Slider
                            value={entry.local}
                            onChange={(v: number) =>
                              handleColorWeight(hex, "local", v)
                            }
                            min={0}
                            max={5}
                            step={0.1}
                            style={{ flex: 1 }}
                            color="yellow"
                            label={(v: number) => v.toFixed(1)}
                          />
                          <Text
                            size="xs"
                            ff="monospace"
                            style={{
                              width: 28,
                              flexShrink: 0,
                              textAlign: "right",
                            }}
                          >
                            {entry.local.toFixed(1)}
                          </Text>
                        </Group>

                        <Group gap="xs" align="center" wrap="nowrap">
                          <Text
                            size="xs"
                            c="dimmed"
                            style={{ width: 42, flexShrink: 0 }}
                          >
                            Global
                          </Text>
                          <Slider
                            value={entry.global}
                            onChange={(v: number) =>
                              handleColorWeight(hex, "global", v)
                            }
                            min={0}
                            max={5}
                            step={0.1}
                            style={{ flex: 1 }}
                            color="blue"
                            label={(v: number) => v.toFixed(1)}
                          />
                          <Text
                            size="xs"
                            ff="monospace"
                            style={{
                              width: 28,
                              flexShrink: 0,
                              textAlign: "right",
                            }}
                          >
                            {entry.global.toFixed(1)}
                          </Text>
                        </Group>
                      </Stack>
                    </Group>
                  );
                })}
              </Stack>
            )}
          </Stack>

          <Divider />

          {/* Debug scores */}
          <Stack gap="sm">
            <Title order={4}>Debug scores</Title>
            <Text size="sm" c="dimmed">
              Show pick probability scores inline in the file tree. Useful for
              verifying bookmark weights and randomness behaviour.
            </Text>
            <Checkbox
              checked={settings.fileRandomiser.showScores ?? false}
              label="Show scores in file tree"
              onChange={(e) => handleShowScoresToggle(e.currentTarget.checked)}
              size="md"
              color="violet"
            />
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
};

export default FileRandomiserSettings;
