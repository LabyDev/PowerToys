import {
  ActionIcon,
  Button,
  Checkbox,
  Group,
  Paper,
  Stack,
  TextInput,
  Tooltip,
} from "@mantine/core";
import {
  FolderPlusIcon,
  ArrowsClockwiseIcon,
  ShuffleIcon,
  MagnifyingGlassIcon,
  XCircleIcon,
  ChartBarIcon,
} from "@phosphor-icons/react";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useTranslation } from "react-i18next";

interface ToolbarProps {
  shuffle: boolean;
  tracking: boolean;
  allowTracking: boolean;
  query: string;
  hasStartedTracking: boolean;
  presetControls: React.ReactNode;
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
  presetControls,
  hasStartedTracking,
  onAddPath,
  onCrawl,
  onPickFile,
  onShuffleChange,
  onTrackingChange,
  onQueryChange,
}: ToolbarProps) => {
  const { t } = useTranslation();

  const openStatsWindow = async () => {
    const existing = await WebviewWindow.getByLabel("stats");
    if (existing) {
      await existing.setFocus();
      return;
    }
    new WebviewWindow("stats", {
      url: "/Stats",
      title: t("fileRandomiser.stats.title"),
      width: 960,
      height: 680,
      center: true,
    });
  };

  const renderButtons = () => (
    <Group gap="xs">
      <Button
        size="sm"
        leftSection={<FolderPlusIcon size={14} />}
        onClick={onAddPath}
      >
        {t("fileRandomiser.toolbar.addPath")}
      </Button>
      <Button
        size="sm"
        variant="light"
        leftSection={<ArrowsClockwiseIcon size={14} />}
        onClick={onCrawl}
      >
        {t("fileRandomiser.toolbar.crawl")}
      </Button>
      <Tooltip
        label={
          hasStartedTracking
            ? t("fileRandomiser.toolbar.pickFileDisabledTracking")
            : ""
        }
        disabled={!hasStartedTracking}
        withArrow
        position="bottom"
      >
        <Button
          size="sm"
          variant="filled"
          leftSection={<ShuffleIcon size={14} />}
          onClick={onPickFile}
          disabled={hasStartedTracking}
          miw={120}
        >
          {shuffle
            ? t("fileRandomiser.toolbar.randomFile")
            : t("fileRandomiser.toolbar.nextFile")}
        </Button>
      </Tooltip>
      <Tooltip
        label={t("fileRandomiser.stats.title")}
        withArrow
        position="bottom"
      >
        <ActionIcon variant="subtle" size="md" onClick={openStatsWindow}>
          <ChartBarIcon size={16} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );

  const renderCheckboxes = () => (
    <Group gap="sm" wrap="nowrap">
      <Checkbox
        label={t("fileRandomiser.toolbar.shuffle")}
        checked={shuffle}
        onChange={(e) => onShuffleChange(e.currentTarget.checked)}
      />
      {allowTracking && (
        <Checkbox
          label={t("fileRandomiser.toolbar.tracking")}
          checked={tracking}
          onChange={(e) => onTrackingChange(e.currentTarget.checked)}
        />
      )}
    </Group>
  );

  const renderSearchInput = () => (
    <TextInput
      placeholder={t("fileRandomiser.toolbar.searchPlaceholder")}
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
    />
  );

  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="sm">
        {/* Top row: preset controls + buttons + checkboxes */}
        <Group justify="space-between" align="center" wrap="nowrap">
          <Group gap="xs" align="center" wrap="wrap">
            {presetControls}
            {renderButtons()}
          </Group>
          {renderCheckboxes()}
        </Group>

        {/* Bottom row: search input */}
        {renderSearchInput()}
      </Stack>
    </Paper>
  );
};

export default Toolbar;
