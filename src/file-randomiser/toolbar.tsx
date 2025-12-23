import { Button, Checkbox, Group, TextInput } from "@mantine/core";
import {
  FolderPlusIcon,
  ArrowsClockwiseIcon,
  ShuffleIcon,
  MagnifyingGlassIcon,
} from "@phosphor-icons/react";

interface ToolbarProps {
  shuffle: boolean;
  tracking: boolean;
  allowTracking: boolean;
  query: string;
  onAddPath: () => void;
  onCrawl: () => void;
  onPickFile: () => void;
  onShuffleChange: (val: boolean) => void;
  onTrackingChange: (val: boolean) => void;
  onQueryChange: (val: string) => void;
}

const Toolbar = ({
  shuffle,
  tracking,
  allowTracking,
  query,
  onAddPath,
  onCrawl,
  onPickFile,
  onShuffleChange,
  onTrackingChange,
  onQueryChange,
}: ToolbarProps) => (
  <>
    <Group justify="space-between" wrap="nowrap">
      <Group>
        <Button leftSection={<FolderPlusIcon size={16} />} onClick={onAddPath}>
          Add path
        </Button>
        <Button
          variant="light"
          leftSection={<ArrowsClockwiseIcon size={16} />}
          onClick={onCrawl}
        >
          Crawl
        </Button>
        <Button
          variant="filled"
          leftSection={<ShuffleIcon size={16} />}
          onClick={onPickFile}
        >
          {shuffle ? "Random file" : "Next file"}
        </Button>
      </Group>

      <Group>
        <Checkbox
          label="Shuffle"
          checked={shuffle}
          onChange={(e) => onShuffleChange(e.currentTarget.checked)}
        />
        {allowTracking && (
          <Checkbox
            label="Tracking"
            checked={tracking}
            onChange={(e) => onTrackingChange(e.currentTarget.checked)}
          />
        )}
      </Group>
    </Group>

    <TextInput
      mt="sm"
      placeholder="Search paths, files, and history…"
      leftSection={<MagnifyingGlassIcon size={16} />}
      value={query}
      onChange={(e) => onQueryChange(e.currentTarget.value)}
    />
  </>
);

export default Toolbar;
