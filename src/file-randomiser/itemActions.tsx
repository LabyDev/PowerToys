import { ActionIcon, Group, Tooltip } from "@mantine/core";
import { FolderOpenIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { FileArrowUpIcon } from "@phosphor-icons/react"; // New icon for "open file"

type ItemActionsProps = {
  onOpenFolder?: () => void;
  onExclude?: () => void;
  onRemove?: () => void;
  onOpen?: () => void; // new
};

const ItemActions = ({
  onOpenFolder,
  onExclude,
  onRemove,
  onOpen,
}: ItemActionsProps) => {
  if (!onOpenFolder && !onExclude && !onRemove && !onOpen) return null;

  return (
    <Group gap={4} wrap="nowrap">
      {onOpenFolder && (
        <Tooltip label="Open in folder" className="item-action">
          <ActionIcon variant="subtle" onClick={onOpenFolder}>
            <FolderOpenIcon size={16} />
          </ActionIcon>
        </Tooltip>
      )}

      {onOpen && (
        <Tooltip label="Open file" className="item-action">
          <ActionIcon variant="subtle" onClick={onOpen}>
            <FileArrowUpIcon size={16} />
          </ActionIcon>
        </Tooltip>
      )}

      {onExclude && (
        <Tooltip label="Exclude" className="item-action">
          <ActionIcon color="orange" variant="subtle" onClick={onExclude}>
            <PlusIcon size={16} />
          </ActionIcon>
        </Tooltip>
      )}

      {onRemove && (
        <Tooltip label="Remove" className="item-action">
          <ActionIcon color="red" variant="subtle" onClick={onRemove}>
            <TrashIcon size={16} />
          </ActionIcon>
        </Tooltip>
      )}
    </Group>
  );
};

export default ItemActions;
