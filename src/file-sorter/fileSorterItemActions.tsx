import { ActionIcon, Group, Tooltip } from "@mantine/core";
import {
  MinusIcon,
  FolderSimplePlusIcon,
  FolderOpenIcon,
} from "@phosphor-icons/react";

interface FileSorterItemActionsProps {
  onExclude?: (e: React.MouseEvent) => void;
  onForceTarget?: (e: React.MouseEvent) => void;
  onReveal?: (e: React.MouseEvent) => void;
}

const FileSorterItemActions = ({
  onExclude,
  onForceTarget,
  onReveal,
}: FileSorterItemActionsProps) => {
  if (!onExclude && !onForceTarget && !onReveal) return null;

  return (
    <Group gap={4} wrap="nowrap">
      {onExclude && (
        <Tooltip label="Exclude file" withArrow position="top">
          <ActionIcon
            size="xs"
            color="red"
            variant="subtle"
            className="item-action"
            onClick={onExclude}
          >
            <MinusIcon size={14} />
          </ActionIcon>
        </Tooltip>
      )}

      {onForceTarget && (
        <Tooltip label="Force target folder" withArrow position="top">
          <ActionIcon
            size="xs"
            color="blue"
            variant="subtle"
            className="item-action"
            onClick={onForceTarget}
          >
            <FolderSimplePlusIcon size={14} />
          </ActionIcon>
        </Tooltip>
      )}

      {onReveal && (
        <Tooltip label="Reveal in file explorer" withArrow position="top">
          <ActionIcon
            size="xs"
            color="gray"
            variant="subtle"
            className="item-action"
            onClick={onReveal}
          >
            <FolderOpenIcon size={14} />
          </ActionIcon>
        </Tooltip>
      )}
    </Group>
  );
};

export default FileSorterItemActions;
