import {
  ActionIcon,
  Button,
  Group,
  Menu,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { FloppyDiskIcon, FolderOpenIcon } from "@phosphor-icons/react";
import { RandomiserPreset } from "../types/filerandomiser";
import { useTranslation } from "react-i18next";

interface PresetControlsProps {
  presets: RandomiserPreset[];
  name: string;
  dirty: boolean;
  onNameChange: (name: string) => void;
  onSelect: (preset: RandomiserPreset) => void;
  onSave: () => void;
  onOpenFolder: () => void;
  onPresetClear: () => void;
}

const PresetControls = ({
  presets,
  name,
  dirty,
  onNameChange,
  onSelect,
  onSave,
  onOpenFolder,
  onPresetClear,
}: PresetControlsProps) => {
  const { t } = useTranslation();

  // Check if the current name matches any preset
  const isPresetApplied = presets.some((p) => p.name === name);

  return (
    <Group gap="xs" align="center">
      {/* Preset Name Input */}
      <TextInput
        size="sm"
        value={name}
        onChange={(e) => onNameChange(e.currentTarget.value)}
        placeholder={t("fileRandomiser.presetControls.presetNamePlaceholder")}
        styles={{
          input: {
            width: 220,
            fontWeight: 500,
            paddingRight: 36, // space for save button only
          },
        }}
        rightSection={
          dirty ? (
            <Tooltip label={t("fileRandomiser.presetControls.savePreset")}>
              <ActionIcon
                size="sm"
                color="blue"
                variant="filled"
                onClick={onSave}
              >
                <FloppyDiskIcon size={14} />
              </ActionIcon>
            </Tooltip>
          ) : null
        }
      />

      {/* Clear Preset Button (only if the current name matches a preset) */}
      <Tooltip
        label={
          isPresetApplied ? t("fileRandomiser.presetControls.clearPreset") : ""
        }
      >
        <ActionIcon
          size="sm"
          color="red"
          variant="filled"
          onClick={onPresetClear}
          disabled={!isPresetApplied}
          style={{
            visibility: isPresetApplied ? "visible" : "hidden",
          }}
        >
          ✕
        </ActionIcon>
      </Tooltip>

      {/* Preset Dropdown */}
      <Menu withinPortal>
        <Menu.Target>
          <Button size="sm" variant="light">
            {t("fileRandomiser.presetControls.presetsButton")}
          </Button>
        </Menu.Target>

        <Menu.Dropdown>
          {presets.length > 0 ? (
            presets.map((p) => (
              <Menu.Item key={p.id} onClick={() => onSelect(p)}>
                {p.name}
              </Menu.Item>
            ))
          ) : (
            <Menu.Item disabled>
              {t("fileRandomiser.presetControls.noPresetsFound")}
            </Menu.Item>
          )}

          <Menu.Divider />

          <Menu.Item
            leftSection={<FolderOpenIcon size={14} />}
            onClick={onOpenFolder}
          >
            {t("fileRandomiser.presetControls.openPresetsFolder")}
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </Group>
  );
};

export default PresetControls;
