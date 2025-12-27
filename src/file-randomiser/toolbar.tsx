import {
  Button,
  Checkbox,
  Group,
  TextInput,
  ActionIcon,
  Paper,
} from "@mantine/core";
import {
  FolderPlusIcon,
  ArrowsClockwiseIcon,
  ShuffleIcon,
  MagnifyingGlassIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";

interface ToolbarProps {
  shuffle: boolean;
  tracking: boolean;
  allowTracking: boolean;
  query: string;
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
  onAddPath,
  onCrawl,
  onPickFile,
  onShuffleChange,
  onTrackingChange,
  onQueryChange,
}: ToolbarProps) => {
  const { t } = useTranslation();

  return (
    <>
      <Paper withBorder radius="md" p="md">
        <Group justify="space-between" align="center" wrap="nowrap">
          {/* Left + middle buttons */}
          <Group gap="md" align="center" wrap="nowrap">
            {presetControls}

            <Group gap="sm" ml="xl">
              <Button
                leftSection={<FolderPlusIcon size={16} />}
                onClick={onAddPath}
              >
                {t("fileRandomiser.toolbar.addPath")}
              </Button>
              <Button
                variant="light"
                leftSection={<ArrowsClockwiseIcon size={16} />}
                onClick={onCrawl}
              >
                {t("fileRandomiser.toolbar.crawl")}
              </Button>
              <Button
                variant="filled"
                leftSection={<ShuffleIcon size={16} />}
                onClick={onPickFile}
              >
                {shuffle
                  ? t("fileRandomiser.toolbar.randomFile")
                  : t("fileRandomiser.toolbar.nextFile")}
              </Button>
            </Group>
          </Group>

          {/* Right: checkboxes */}
          <Group gap="sm">
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
        </Group>
      </Paper>

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
    </>
  );
};

export default Toolbar;
