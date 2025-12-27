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
  Alert,
} from "@mantine/core";
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppSettings } from "../hooks/useAppSettings";
import {
  DarkModeOption,
  AppSettings,
  LanguageOption,
} from "../../types/settings";
import { useTranslation } from "react-i18next";
import i18n from "../translations/i18";

const AppSettingsPage = () => {
  const { t } = useTranslation();
  const { settings, setSettings } = useAppSettings();
  const [pendingChange, setPendingChange] = useState(false);

  const handleDarkModeChange = async (value: DarkModeOption) => {
    try {
      const updatedSettings: AppSettings = await invoke("set_dark_mode", {
        mode: value,
      });
      setSettings(updatedSettings);
      setPendingChange(true);
    } catch (err) {
      console.error("Failed to update dark mode:", err);
    }
  };

  const handleLanguageChange = async (value: LanguageOption) => {
    try {
      const updatedSettings: AppSettings = await invoke("set_language", {
        language: value,
      });
      setSettings(updatedSettings);
      i18n.changeLanguage(value); // update i18next language
    } catch (err) {
      console.error("Failed to update language:", err);
    }
  };

  const handleBackgroundSelect = async () => {
    try {
      const updatedSettings: AppSettings = await invoke(
        "set_custom_background",
      );
      setSettings(updatedSettings);
      setPendingChange(true);
    } catch (err) {
      console.error("Failed to select background:", err);
    }
  };

  const handleBackgroundClear = async () => {
    try {
      const updatedSettings: AppSettings = await invoke(
        "clear_custom_background",
      );
      setSettings(updatedSettings);
      setPendingChange(true);
    } catch (err) {
      console.error("Failed to clear background:", err);
    }
  };

  const handleRestartApp = async () => {
    try {
      await invoke("restart_app");
    } catch (err) {
      console.error("Failed to restart app:", err);
    }
  };

  return (
    <Box p="lg" style={{ height: "calc(100vh - 32px)", overflowY: "auto" }}>
      <Paper shadow="sm" p="lg" radius="md" withBorder>
        <Stack gap="xl">
          <Title order={3}>{t("settingsPage.title")}</Title>
          <Divider />

          {/* Appearance */}
          <Stack gap="sm">
            <Title order={4}>{t("settingsPage.appearance.title")}</Title>
            <Text size="sm" c="dimmed">
              {t("settingsPage.appearance.description")}
            </Text>

            {/* Language Selection */}
            <Select
              label={t("settingsPage.appearance.language")}
              description={t("settingsPage.appearance.languageDescription")}
              value={settings.language}
              onChange={(val) => handleLanguageChange(val as LanguageOption)}
              data={["en", "nl", "de", "pl"].map((lang) => ({
                value: lang,
                label: t(`settingsPage.appearance.languages.${lang}`),
              }))}
              mt="sm"
            />

            <Alert color="yellow" variant="light" mt="xs">
              {t("settingsPage.appearance.alert")}
            </Alert>

            {/* Dark Mode */}
            <Select
              label={t("settingsPage.appearance.darkMode")}
              description={t("settingsPage.appearance.darkModeDescription")}
              value={settings.darkMode}
              onChange={(val) => handleDarkModeChange(val as DarkModeOption)}
              data={[
                {
                  value: "light",
                  label: t("settingsPage.appearance.options.light"),
                },
                {
                  value: "dark",
                  label: t("settingsPage.appearance.options.dark"),
                },
                {
                  value: "system",
                  label: t("settingsPage.appearance.options.system"),
                },
              ]}
            />

            {/* Custom Background */}
            <Group gap="sm" mt="sm">
              <Button onClick={handleBackgroundSelect}>
                {t("settingsPage.appearance.customBackgroundSelect")}
              </Button>
              {settings.customBackground && (
                <Button
                  color="red"
                  variant="outline"
                  onClick={handleBackgroundClear}
                >
                  {t("settingsPage.appearance.customBackgroundClear")}
                </Button>
              )}
            </Group>

            {/* Restart App - only show if there’s a pending change */}
            {pendingChange && (
              <Alert
                color="gray.0"
                variant="outline"
                title={t("settingsPage.appearance.restartRequired")}
                styles={{
                  root: {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  },
                  title: { color: "white" },
                  message: { color: "white" },
                }}
              >
                <Text size="sm" c="white">
                  {t("settingsPage.appearance.restartDescription")}
                </Text>
                <Button
                  size="xs"
                  color="white"
                  variant="outline"
                  mt="sm"
                  onClick={handleRestartApp}
                >
                  {t("settingsPage.appearance.restartButton")}
                </Button>
              </Alert>
            )}
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
};

export default AppSettingsPage;
