import {
  Box,
  Button,
  Checkbox,
  Divider,
  Group,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { BookmarkIcon } from "@phosphor-icons/react";
import { platform, Platform } from "@tauri-apps/plugin-os";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppSettings } from "../hooks/useAppSettings";
import {
  setFileAuditorKeybinds,
  toggleAuditorProcessTracking,
} from "../api/appSettingsApi";
import { DEFAULT_BOOKMARK_COLOR_OPTIONS } from "../../types/common";
import type { FileAuditorKeybinds } from "../../types/settings";
import { displayKey } from "../../utils/displayKey";
import { DEFAULT_AUDITOR_KEYBINDS } from "../../file-auditor/auditorKeybinds";
import "./fileAuditorSettings.css";

const KeyInput = ({
  value,
  onSave,
  placeholder,
  hasConflict,
}: {
  value: string;
  onSave: (key: string) => void;
  placeholder: string;
  hasConflict: (key: string) => boolean;
}) => {
  const [capturing, setCapturing] = useState(false);
  const [conflict, setConflict] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const triggerShake = () => {
    const el = wrapRef.current;
    if (!el) return;
    el.classList.remove("key-shake");
    void el.offsetHeight; // force reflow to restart animation
    el.classList.add("key-shake");
    setConflict(true);
  };

  const stopCapturing = () => {
    setCapturing(false);
    setConflict(false);
  };

  if (capturing) {
    return (
      <div ref={wrapRef} style={{ display: "inline-block" }}>
        <TextInput
          autoFocus
          value=""
          placeholder={placeholder}
          readOnly
          error={conflict}
          onBlur={stopCapturing}
          onKeyDown={(e) => {
            if (e.key === "Tab") {
              stopCapturing();
              return;
            }
            e.preventDefault();
            if (hasConflict(e.key)) {
              triggerShake();
              return;
            }
            onSave(e.key);
            stopCapturing();
          }}
          style={{ width: 140 }}
          styles={{ input: { textAlign: "center" } }}
        />
      </div>
    );
  }

  return (
    <Box
      onClick={() => {
        setConflict(false);
        setCapturing(true);
      }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 52,
        height: 36,
        padding: "0 14px",
        border: "1px solid var(--mantine-color-default-border)",
        borderBottom: "3px solid var(--mantine-color-default-border)",
        borderRadius: 6,
        background: "var(--mantine-color-default)",
        cursor: "pointer",
        fontFamily: "monospace",
        fontSize: "0.9rem",
        fontWeight: 700,
        userSelect: "none",
        flexShrink: 0,
      }}
    >
      {displayKey(value)}
    </Box>
  );
};

const KeybindRow = ({
  label,
  value,
  onSave,
  placeholder,
  hasConflict,
  colorSwatch,
}: {
  label: string;
  value: string;
  onSave: (key: string) => void;
  placeholder: string;
  hasConflict: (key: string) => boolean;
  colorSwatch?: string;
}) => (
  <Group align="center" gap="sm" wrap="nowrap">
    <Group gap="xs" align="center" style={{ flex: 1, minWidth: 0 }}>
      {colorSwatch && (
        <BookmarkIcon
          size={14}
          weight="fill"
          style={{ color: colorSwatch, flexShrink: 0 }}
        />
      )}
      <Text size="sm" truncate>
        {label}
      </Text>
    </Group>
    <KeyInput
      value={value}
      onSave={onSave}
      placeholder={placeholder}
      hasConflict={hasConflict}
    />
  </Group>
);

const FileAuditorSettings = () => {
  const { t } = useTranslation();
  const { settings, setSettings } = useAppSettings();
  const bookmarkColors =
    settings.bookmarkColors ?? DEFAULT_BOOKMARK_COLOR_OPTIONS;

  const [isLinux, setIsLinux] = useState(false);

  useEffect(() => {
    try {
      const currentPlatform: Platform = platform();
      setIsLinux(currentPlatform === "linux");
    } catch (err) {
      console.error("Failed to detect platform:", err);
    }
  }, []);

  const handleTrackingToggle = async (checked: boolean) => {
    if (isLinux) return;
    try {
      const updated = await toggleAuditorProcessTracking(checked);
      setSettings(updated);
    } catch (err) {
      console.error("Failed to toggle auditor process tracking:", err);
    }
  };

  const keybinds: FileAuditorKeybinds =
    settings.fileAuditor?.keybinds ?? DEFAULT_AUDITOR_KEYBINDS;

  const pressKeyPlaceholder = t("fileAuditorSettings.pressKey");

  const save = async (updated: FileAuditorKeybinds) => {
    try {
      const result = await setFileAuditorKeybinds(updated);
      setSettings(result);
    } catch (err) {
      console.error("Failed to save keybinds:", err);
    }
  };

  // Returns all assigned keybind entries as { id, key } pairs
  const allEntries = () => [
    { id: "prev", key: keybinds.prev },
    { id: "next", key: keybinds.next },
    { id: "delete", key: keybinds.delete },
    { id: "clearBookmark", key: keybinds.clearBookmark },
    { id: "stop", key: keybinds.stop },
    ...keybinds.bookmarks.map((k, i) => ({ id: `bookmark_${i}`, key: k })),
  ];

  const makeConflictChecker = (currentId: string) => (newKey: string) => {
    const lower = newKey.toLowerCase();
    return allEntries().some(
      ({ id, key }) => id !== currentId && key.toLowerCase() === lower,
    );
  };

  const setKey = (
    field: keyof Omit<FileAuditorKeybinds, "bookmarks">,
    key: string,
  ) => save({ ...keybinds, [field]: key });

  const setBookmarkKey = (index: number, key: string) => {
    const bookmarks = [...keybinds.bookmarks];
    bookmarks[index] = key;
    save({ ...keybinds, bookmarks });
  };

  const applyPreset = (preset: "left" | "right") => {
    const bookmarkSlots = bookmarkColors.map((_, i) => String(i + 1));
    if (preset === "left") {
      save({ ...DEFAULT_AUDITOR_KEYBINDS, bookmarks: bookmarkSlots });
    } else {
      save({
        prev: "ArrowLeft",
        next: "ArrowRight",
        delete: "Delete",
        bookmarks: bookmarkSlots,
        clearBookmark: "0",
        stop: "Escape",
      });
    }
  };

  return (
    <Box p="lg" style={{ height: "calc(100vh - 32px)", overflowY: "auto" }}>
      <Paper
        shadow="sm"
        p="lg"
        radius="md"
        withBorder
        style={{ maxWidth: 760, margin: "0 auto" }}
      >
        <Stack gap="xl">
          <Title order={3}>{t("fileAuditorSettings.title")}</Title>
          <Divider />

          {/* Presets */}
          <Stack gap="sm">
            <Title order={4}>{t("fileAuditorSettings.presetsTitle")}</Title>
            <Group gap="xs">
              <Button variant="default" onClick={() => applyPreset("left")}>
                {t("fileAuditorSettings.presetLeft")}
              </Button>
              <Button variant="default" onClick={() => applyPreset("right")}>
                {t("fileAuditorSettings.presetRight")}
              </Button>
            </Group>
          </Stack>

          <Divider />

          {/* Process tracking */}
          <Stack gap="sm">
            <Title order={4}>
              {t("fileAuditorSettings.processTracking.title")}
            </Title>
            <Text size="sm" c="dimmed" style={{ whiteSpace: "pre-line" }}>
              {isLinux
                ? t("fileAuditorSettings.processTracking.unsupportedOnLinux")
                : t("fileAuditorSettings.processTracking.description")}
            </Text>
            <Checkbox
              checked={
                isLinux
                  ? false
                  : (settings.fileAuditor?.allowProcessTracking ?? false)
              }
              disabled={isLinux}
              label={t("fileAuditorSettings.processTracking.checkboxLabel")}
              description={
                isLinux
                  ? t("fileAuditorSettings.processTracking.checkboxUnavailable")
                  : t("fileAuditorSettings.processTracking.checkboxDescription")
              }
              onChange={(e) => handleTrackingToggle(e.currentTarget.checked)}
            />
          </Stack>

          <Divider />

          {/* Individual keybinds */}
          <Stack gap="xs">
            <Title order={4} mb="xs">
              {t("fileAuditorSettings.keybindsTitle")}
            </Title>

            {(
              [
                ["keyPrev", "prev"],
                ["keyNext", "next"],
                ["keyDelete", "delete"],
                ["keyStop", "stop"],
                ["keyClearBookmark", "clearBookmark"],
              ] as [string, keyof Omit<FileAuditorKeybinds, "bookmarks">][]
            ).map(([labelKey, field]) => (
              <KeybindRow
                key={field}
                label={t(`fileAuditorSettings.${labelKey}`)}
                value={keybinds[field]}
                onSave={(key) => setKey(field, key)}
                placeholder={pressKeyPlaceholder}
                hasConflict={makeConflictChecker(field)}
              />
            ))}

            {bookmarkColors.length > 0 && <Divider my="xs" />}

            {bookmarkColors.map(({ hex, label }, i) => (
              <KeybindRow
                key={hex}
                label={t("fileAuditorSettings.keyBookmarkSlot", { n: label })}
                value={keybinds.bookmarks[i] ?? String(i + 1)}
                onSave={(key) => setBookmarkKey(i, key)}
                placeholder={pressKeyPlaceholder}
                hasConflict={makeConflictChecker(`bookmark_${i}`)}
                colorSwatch={hex}
              />
            ))}
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
};

export default FileAuditorSettings;
