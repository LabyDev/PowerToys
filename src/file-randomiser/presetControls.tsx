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
    {/* Preset Name Input + Save button */}
    <TextInput
      size="sm"
      value={name}
      onChange={(e) => onNameChange(e.currentTarget.value)}
      placeholder="Preset name"
      styles={{
        input: {
          width: 220, // ← tad longer
          fontWeight: 500,
          paddingRight: dirty ? 36 : undefined, // space for icon
        },
      }}
      rightSection={
        dirty ? (
          <Tooltip label="Save preset">
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
  </Group>
);

export default PresetControls;
