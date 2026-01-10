import {
  Button,
  Group,
  TextInput,
  ActionIcon,
  Paper,
  Tooltip,
  Indicator,
} from "@mantine/core";
import {
  MagnifyingGlassIcon,
  XCircleIcon,
  ArrowsClockwiseIcon,
  ArrowCounterClockwiseIcon,
} from "@phosphor-icons/react";

interface FileSorterToolbarProps {
  query: string;
  onQueryChange: (val: string) => void;
  onSort: () => void;
  onRefresh: () => void;
  onRestore: () => void;
  hasRestorePoint: boolean;
}

const FileSorterToolbar = ({
  query,
  onQueryChange,
  onSort,
  onRefresh,
  onRestore,
  hasRestorePoint,
}: FileSorterToolbarProps) => {
  return (
    <Paper withBorder radius="md" p="xs">
      <Group justify="space-between" wrap="nowrap">
        <Group gap="xs">
          <Button
            leftSection={<ArrowsClockwiseIcon size={18} weight="bold" />}
            onClick={onSort}
            color="blue"
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
              <Button
                variant="light"
                color="orange"
                leftSection={<ArrowCounterClockwiseIcon size={18} />}
                onClick={onRestore}
                disabled={!hasRestorePoint}
              >
                Restore
              </Button>
            </Indicator>
          </Tooltip>

          <ActionIcon variant="subtle" size="lg" onClick={onRefresh}>
            <ArrowsClockwiseIcon size={20} />
          </ActionIcon>
        </Group>

        <TextInput
          placeholder="Search files..."
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
          style={{ flex: 1, maxWidth: 500 }}
        />
      </Group>
    </Paper>
  );
};

export default FileSorterToolbar;
