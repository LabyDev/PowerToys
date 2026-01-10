import {
  Button,
  Group,
  TextInput,
  ActionIcon,
  Paper,
  Tooltip,
  Indicator,
  Divider,
  Text,
} from "@mantine/core";
import {
  MagnifyingGlassIcon,
  XCircleIcon,
  ArrowsClockwiseIcon,
  ArrowCounterClockwiseIcon,
  FolderOpenIcon,
} from "@phosphor-icons/react";

interface FileSorterToolbarProps {
  query: string;
  onQueryChange: (val: string) => void;
  onSort: () => void;
  onRefresh: () => void;
  onRestore: () => void;
  onSelectFolder: () => void;
  currentPath: string | null;
  hasRestorePoint: boolean;
}

const FileSorterToolbar = ({
  query,
  onQueryChange,
  onSort,
  onRefresh,
  onRestore,
  onSelectFolder,
  currentPath,
  hasRestorePoint,
}: FileSorterToolbarProps) => {
  return (
    <Paper withBorder radius="md" p="xs">
      <Group justify="space-between" wrap="nowrap">
        {/* 1. Action Group */}
        <Group gap="xs" wrap="nowrap">
          <Button
            leftSection={<ArrowsClockwiseIcon size={18} weight="bold" />}
            onClick={onSort}
            color="blue"
            disabled={!currentPath}
          >
            Sort Files
          </Button>

          <Tooltip label="Undo last move">
            <Indicator
              disabled={!hasRestorePoint}
              color="red"
              size={8}
              offset={2}
            >
              <ActionIcon
                variant="light"
                color="orange"
                size="lg"
                onClick={onRestore}
                disabled={!hasRestorePoint}
              >
                <ArrowCounterClockwiseIcon size={20} />
              </ActionIcon>
            </Indicator>
          </Tooltip>

          <ActionIcon
            variant="subtle"
            size="lg"
            onClick={onRefresh}
            disabled={!currentPath}
          >
            <ArrowsClockwiseIcon size={20} />
          </ActionIcon>

          <Divider orientation="vertical" />

          {/* 2. Path Display - Integrated nicely */}
          <Group gap={6} wrap="nowrap">
            <Tooltip label="Change Folder">
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={onSelectFolder}
              >
                <FolderOpenIcon size={20} />
              </ActionIcon>
            </Tooltip>

            {currentPath ? (
              <Group gap={4} wrap="nowrap">
                <Text size="xs" c="dimmed" ff="monospace">
                  /
                </Text>
                <Text size="sm" fw={500} truncate maw={200}>
                  {currentPath.split(/[\\/]/).pop()}
                </Text>
              </Group>
            ) : (
              <Text size="sm" c="dimmed">
                No folder selected
              </Text>
            )}
          </Group>
        </Group>

        {/* 3. Search Filter */}
        <TextInput
          placeholder="Filter results..."
          leftSection={<MagnifyingGlassIcon size={16} />}
          rightSection={
            query && (
              <ActionIcon
                variant="transparent"
                onClick={() => onQueryChange("")}
              >
                <XCircleIcon size={16} />
              </ActionIcon>
            )
          }
          value={query}
          onChange={(e) => onQueryChange(e.currentTarget.value)}
          style={{ width: 220 }}
          disabled={!currentPath}
        />
      </Group>
    </Paper>
  );
};

export default FileSorterToolbar;
