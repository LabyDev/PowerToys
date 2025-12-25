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

interface PresetControlsProps {
  presets: RandomiserPreset[];
  name: string;
  dirty: boolean;
  onNameChange: (name: string) => void;
  onSelect: (preset: RandomiserPreset) => void;
  onSave: () => void;
  onOpenFolder: () => void;
}

const PresetControls = ({
  presets,
  name,
  dirty,
  onNameChange,
  onSelect,
  onSave,
  onOpenFolder,
}: PresetControlsProps) => (
  <Group gap="xs" align="center">
    {/* Preset Name Input */}
    <TextInput
      size="sm"
      value={name}
      onChange={(e) => onNameChange(e.currentTarget.value)}
      placeholder="Preset name"
      styles={{ input: { width: 180, fontWeight: 500 } }}
      rightSection={dirty ? "●" : null}
    />

    {/* Preset Dropdown */}
    <Menu withinPortal>
      <Menu.Target>
        <Button size="sm" variant="light">
          Presets
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
          <Menu.Item disabled>No presets found</Menu.Item>
        )}

        <Menu.Divider />

        <Menu.Item
          leftSection={<FolderOpenIcon size={14} />}
          onClick={onOpenFolder}
        >
          Open presets folder
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>

    {/* Save Button */}
    <Tooltip label="Save preset">
      <ActionIcon
        color={dirty ? "blue" : "gray"}
        variant={dirty ? "filled" : "subtle"}
        onClick={onSave}
        size="sm"
      >
        <FloppyDiskIcon size={16} />
      </ActionIcon>
    </Tooltip>
  </Group>
);

export default PresetControls;
