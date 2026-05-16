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
import { FolderOpenIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { useAppSettings } from "../hooks/useAppSettings";
import {
  setDarkMode,
  setLanguage,
  setCustomBackground,
  clearCustomBackground,
  openSettingsFolder,
  restartApp,
} from "../api/appSettingsApi";
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
      const updatedSettings: AppSettings = await setDarkMode(value);
      setSettings(updatedSettings);
      setPendingChange(true);
    } catch (err) {
      console.error("Failed to update dark mode:", err);
    }
  };

  const handleLanguageChange = async (value: LanguageOption) => {
    try {
      const updatedSettings: AppSettings = await setLanguage(value);
      setSettings(updatedSettings);
      i18n.changeLanguage(value);
    } catch (err) {
      console.error("Failed to update language:", err);
    }
  };

  const handleBackgroundSelect = async () => {
    try {
      const updatedSettings: AppSettings = await setCustomBackground();
      setSettings(updatedSettings);
      setPendingChange(true);
    } catch (err) {
      console.error("Failed to select background:", err);
    }
  };

  const handleBackgroundClear = async () => {
    try {
      const updatedSettings: AppSettings = await clearCustomBackground();
      setSettings(updatedSettings);
      setPendingChange(true);
    } catch (err) {
      console.error("Failed to clear background:", err);
    }
  };

  const handleOpenSettingsFolder = async () => {
    try {
      await openSettingsFolder();
    } catch (err) {
      console.error("Failed to open settings folder:", err);
    }
  };

  const handleRestartApp = async () => {
    try {
      await restartApp();
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

          <Stack gap="sm">
            <Title order={4}>{t("settingsPage.appearance.title")}</Title>

            <Text size="sm" c="dimmed">
              {t("settingsPage.appearance.description")}
            </Text>

            <Select
              label={t("settingsPage.appearance.language")}
              description={t("settingsPage.appearance.languageDescription")}
              value={settings.language}
              onChange={(val) => handleLanguageChange(val as LanguageOption)}
              data={["en", "nl", "bs", "de", "pl"].map((lang) => ({
                value: lang,
                label: t(`settingsPage.appearance.languages.${lang}`),
              }))}
              mt="sm"
            />

            <Alert color="yellow" variant="light" mt="xs">
              {t("settingsPage.appearance.alert")}
            </Alert>

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

              <Button
                variant="light"
                leftSection={<FolderOpenIcon size={16} />}
                onClick={handleOpenSettingsFolder}
              >
                Open settings folder
              </Button>
            </Group>

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
