import { ActionIcon, Group, Tooltip } from "@mantine/core";
import {
  MinusIcon,
  PlusIcon,
  FolderSimplePlusIcon,
  FolderOpenIcon,
} from "@phosphor-icons/react";
import { invoke } from "@tauri-apps/api/core";

interface FileSorterItemActionsProps {
  path: string;
  isExcluded?: boolean;
  forcedTarget?: string;
  refreshPreview: () => Promise<void>;
}

const FileSorterItemActions = ({
  path,
  isExcluded,
  forcedTarget,
  refreshPreview,
}: FileSorterItemActionsProps) => {
  const handleExcludeInclude = async () => {
    try {
      if (isExcluded) {
        await invoke("include_path", { path });
      } else {
        await invoke("exclude_path", { path });
      }
      await refreshPreview();
    } catch (err) {
      console.error("Failed to toggle exclude/include:", err);
    }
  };

  const handleForceTarget = async () => {
    try {
      await invoke("force_target", { path });
      await refreshPreview();
    } catch (err) {
      console.error("Failed to set/reset forced target:", err);
    }
  };

  const handleReveal = async () => {
    try {
      await invoke("reveal_in_explorer", { path });
    } catch (err) {
      console.error("Failed to reveal file:", err);
    }
  };

  return (
    <Group gap={4} wrap="nowrap">
      {/* Exclude / Include */}
      <Tooltip
        label={isExcluded ? "Include file again" : "Exclude file"}
        withArrow
      >
        <ActionIcon
          size="xs"
          color={isExcluded ? "green" : "red"}
          variant="subtle"
          className="item-action"
          onClick={(e) => {
            e.stopPropagation();
            handleExcludeInclude();
          }}
        >
          {isExcluded ? <PlusIcon size={14} /> : <MinusIcon size={14} />}
        </ActionIcon>
      </Tooltip>

      {/* Force target folder */}
      <Tooltip
        label={
          forcedTarget ? `Forced to: ${forcedTarget}` : "Force target folder"
        }
        withArrow
      >
        <ActionIcon
          size="xs"
          color={forcedTarget ? "blue" : "gray"}
          variant="subtle"
          className="item-action"
          onClick={(e) => {
            e.stopPropagation();
            handleForceTarget();
          }}
        >
          <FolderSimplePlusIcon size={14} />
        </ActionIcon>
      </Tooltip>

      {/* Reveal in file explorer */}
      <Tooltip label="Reveal in file explorer" withArrow>
        <ActionIcon
          size="xs"
          color="gray"
          variant="subtle"
          className="item-action"
          onClick={(e) => {
            e.stopPropagation();
            handleReveal();
          }}
        >
          <FolderOpenIcon size={14} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
};

export default FileSorterItemActions;
