import { ActionIcon, Group, Tooltip } from "@mantine/core";
import {
  FolderOpenIcon,
  PlusIcon,
  TrashIcon,
  FileArrowUpIcon,
} from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";

type ItemActionsProps = {
  onOpenFolder?: () => void;
  onExclude?: () => void;
  onRemove?: () => void;
  onOpen?: () => void;
};

const ItemActions = ({
  onOpenFolder,
  onExclude,
  onRemove,
  onOpen,
}: ItemActionsProps) => {
  const { t } = useTranslation();

  if (!onOpenFolder && !onExclude && !onRemove && !onOpen) return null;

  return (
    <Group gap={4} wrap="nowrap">
      {onOpenFolder && (
        <Tooltip
          label={t("fileRandomiser.itemActions.openFolder")}
          className="item-action"
        >
          <ActionIcon variant="subtle" onClick={onOpenFolder}>
            <FolderOpenIcon size={16} />
          </ActionIcon>
        </Tooltip>
      )}

      {onOpen && (
        <Tooltip
          label={t("fileRandomiser.itemActions.openFile")}
          className="item-action"
        >
          <ActionIcon variant="subtle" onClick={onOpen}>
            <FileArrowUpIcon size={16} />
          </ActionIcon>
        </Tooltip>
      )}

      {onExclude && (
        <Tooltip
          label={t("fileRandomiser.itemActions.exclude")}
          className="item-action"
        >
          <ActionIcon color="orange" variant="subtle" onClick={onExclude}>
            <PlusIcon size={16} />
          </ActionIcon>
        </Tooltip>
      )}

      {onRemove && (
        <Tooltip
          label={t("fileRandomiser.itemActions.remove")}
          className="item-action"
        >
          <ActionIcon color="red" variant="subtle" onClick={onRemove}>
            <TrashIcon size={16} />
          </ActionIcon>
        </Tooltip>
      )}
    </Group>
  );
};

export default ItemActions;
