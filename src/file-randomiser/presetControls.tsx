import {
  ActionIcon,
  Button,
  Group,
  Menu,
  TextInput,
  Tooltip,
} from "@mantine/core";
import {
  FloppyDiskIcon,
  FolderOpenIcon,
  UploadSimpleIcon,
  DownloadSimpleIcon,
} from "@phosphor-icons/react";
import { RandomiserPreset } from "../types/filerandomiser";

interface PresetControlsProps {
  presets: RandomiserPreset[];
  name: string;
  dirty: boolean;
  onNameChange: (name: string) => void;
  onSelect: (preset: RandomiserPreset) => void;
  onSave: () => void;
  onSaveAs: () => void;
  onImport: () => void;
  onExport: () => void;
  onOpenFolder: () => void;
}

const PresetControls = ({
  presets,
  name,
  dirty,
  onNameChange,
  onSelect,
  onSave,
  onSaveAs,
  onImport,
  onExport,
  onOpenFolder,
}: PresetControlsProps) => (
  <Group gap="xs">
    <TextInput
      size="sm"
      value={name}
      onChange={(e) => onNameChange(e.currentTarget.value)}
      styles={{ input: { width: 180 } }}
      rightSection={dirty ? "●" : null}
    />

    <Menu withinPortal>
      <Menu.Target>
        <Button size="sm" variant="light">
          Presets
        </Button>
      </Menu.Target>

      <Menu.Dropdown>
        {presets.map((p) => (
          <Menu.Item key={p.id} onClick={() => onSelect(p)}>
            {p.name}
          </Menu.Item>
        ))}

        <Menu.Divider />

        <Menu.Item
          leftSection={<UploadSimpleIcon size={14} />}
          onClick={onImport}
        >
          Import
        </Menu.Item>

        <Menu.Item
          leftSection={<DownloadSimpleIcon size={14} />}
          onClick={onExport}
          disabled={!presets.length}
        >
          Export current
        </Menu.Item>

        <Menu.Item
          leftSection={<FolderOpenIcon size={14} />}
          onClick={onOpenFolder}
        >
          Open presets folder
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>

    <Tooltip label="Save preset">
      <ActionIcon
        color={dirty ? "blue" : "gray"}
        variant={dirty ? "filled" : "subtle"}
        onClick={onSave}
      >
        <FloppyDiskIcon size={16} />
      </ActionIcon>
    </Tooltip>

    <Tooltip label="Save as new preset">
      <Button size="sm" variant="subtle" onClick={onSaveAs}>
        Save as
      </Button>
    </Tooltip>
  </Group>
);

export default PresetControls;
