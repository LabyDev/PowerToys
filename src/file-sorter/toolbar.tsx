import { Button, Group, TextInput, ActionIcon, Paper } from "@mantine/core";
import {
  MagnifyingGlassIcon,
  XCircleIcon,
  ArrowsClockwiseIcon,
} from "@phosphor-icons/react";

interface FileSorterToolbarProps {
  query: string;
  onQueryChange: (val: string) => void;
  onSort: () => void;
  onRefresh: () => void;
}

const FileSorterToolbar = ({
  query,
  onQueryChange,
  onSort,
  onRefresh,
}: FileSorterToolbarProps) => {
  return (
    <>
      <Paper withBorder radius="md" p="md">
        <Group justify="space-between" align="center">
          <Group gap="sm">
            <Button
              leftSection={<ArrowsClockwiseIcon size={16} />}
              onClick={onSort}
            >
              Sort Files
            </Button>
            <Button variant="light" onClick={onRefresh}>
              Refresh List
            </Button>
          </Group>
        </Group>
      </Paper>

      <TextInput
        placeholder="Search files..."
        leftSection={<MagnifyingGlassIcon size={16} />}
        rightSection={
          query && (
            <ActionIcon onClick={() => onQueryChange("")}>
              <XCircleIcon size={16} />
            </ActionIcon>
          )
        }
        value={query}
        onChange={(e) => onQueryChange(e.currentTarget.value)}
        mt="sm"
      />
    </>
  );
};

export default FileSorterToolbar;
