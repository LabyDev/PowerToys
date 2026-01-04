import {
  Button,
  Group,
  TextInput,
  ActionIcon,
  Paper,
  Menu,
  Tooltip,
  Indicator,
} from "@mantine/core";
import {
  MagnifyingGlassIcon,
  XCircleIcon,
  ArrowsClockwiseIcon,
  GearSixIcon,
  ClockCounterClockwiseIcon,
  ArrowCounterClockwiseIcon,
  ListBulletsIcon,
  SquaresFourIcon,
} from "@phosphor-icons/react";

interface FileSorterToolbarProps {
  query: string;
  onQueryChange: (val: string) => void;
  onSort: () => void;
  onRefresh: () => void;
  onRestore: () => void;
  hasRestorePoint: boolean;
  isCompact: boolean;
  setIsCompact: (val: boolean) => void;
}

const FileSorterToolbar = ({
  query,
  onQueryChange,
  onSort,
  onRefresh,
  onRestore,
  hasRestorePoint,
  isCompact,
  setIsCompact,
}: FileSorterToolbarProps) => {
  return (
    <Paper withBorder radius="md" p="xs">
      <Group justify="space-between" wrap="nowrap">
        {/* Left Side: Primary Actions */}
        <Group gap="xs">
          <Button
            leftSection={<ArrowsClockwiseIcon size={18} weight="bold" />}
            onClick={onSort}
            variant="filled"
            color="blue"
          >
            Sort Files
          </Button>

          <Tooltip label="Undo last move using the restore point">
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

          <ActionIcon
            variant="subtle"
            size="lg"
            onClick={onRefresh}
            title="Refresh Directory"
          >
            <ArrowsClockwiseIcon size={20} />
          </ActionIcon>
        </Group>

        {/* Center: Search (Expanded) */}
        <TextInput
          placeholder="Search by name, path, or extension..."
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
          style={{ flex: 1, maxWidth: 400 }}
        />

        {/* Right Side: Settings & View Options */}
        <Group gap="xs">
          <Tooltip
            label={
              isCompact ? "Switch to Relaxed View" : "Switch to Compact View"
            }
          >
            <ActionIcon
              variant="default"
              size="lg"
              onClick={() => setIsCompact(!isCompact)}
            >
              {isCompact ? (
                <ListBulletsIcon size={20} />
              ) : (
                <SquaresFourIcon size={20} />
              )}
            </ActionIcon>
          </Tooltip>

          <Menu position="bottom-end" shadow="md" width={200}>
            <Menu.Target>
              <ActionIcon variant="default" size="lg">
                <GearSixIcon size={20} />
              </ActionIcon>
            </Menu.Target>

            <Menu.Dropdown>
              <Menu.Label>Sorting Logic</Menu.Label>
              <Menu.Item leftSection={<ClockCounterClockwiseIcon size={14} />}>
                View History
              </Menu.Item>
              <Menu.Divider />
              <Menu.Label>Danger Zone</Menu.Label>
              <Menu.Item color="red" leftSection={<XCircleIcon size={14} />}>
                Clear All Metadata
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>
    </Paper>
  );
};

export default FileSorterToolbar;
