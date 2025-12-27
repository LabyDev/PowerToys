import { ActionIcon, Group, Tooltip } from "@mantine/core";
import {
  FolderOpenIcon,
  PlusIcon,
  TrashIcon,
  FileArrowUpIcon,
  StarIcon,
} from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";

type ItemActionsProps = {
  onOpenFolder?: () => void;
  onExclude?: () => void;
  onRemove?: () => void;
  onOpen?: () => void;
  onBookmarkChange?: (color: string | null) => void;
  currentBookmarkColor?: string | null;
};

const bookmarkCycle = [
  null,
  "#FFD700", // gold
  "#FF6B6B", // red
  "#6BCB77", // green
  "#4D96FF", // blue
] as const;

type BookmarkCycleColor = (typeof bookmarkCycle)[number];

const ItemActions = ({
  onOpenFolder,
  onExclude,
  onRemove,
  onOpen,
  onBookmarkChange,
  currentBookmarkColor,
}: ItemActionsProps) => {
  const { t } = useTranslation();

  const isCycleColor = (
    color: string | null | undefined,
  ): color is BookmarkCycleColor =>
    bookmarkCycle.includes((color ?? null) as BookmarkCycleColor);

  const cycleBookmark = () => {
    if (!onBookmarkChange) return;

    const normalized: BookmarkCycleColor = isCycleColor(currentBookmarkColor)
      ? currentBookmarkColor
      : null;

    const currentIndex = bookmarkCycle.indexOf(normalized);
    const nextIndex = (currentIndex + 1) % bookmarkCycle.length;

    onBookmarkChange(bookmarkCycle[nextIndex]);
  };

  if (!onOpenFolder && !onExclude && !onRemove && !onOpen && !onBookmarkChange)
    return null;

  return (
    <Group gap={4} wrap="nowrap">
      {onOpenFolder && (
        <Tooltip
          label={t("fileRandomiser.itemActions.openFolder")}
          className="item-action"
        >
          <ActionIcon
            variant="subtle"
            onClick={onOpenFolder}
            className="item-action"
          >
            <FolderOpenIcon size={16} />
          </ActionIcon>
        </Tooltip>
      )}

      {onOpen && (
        <Tooltip
          label={t("fileRandomiser.itemActions.openFile")}
          className="item-action"
        >
          <ActionIcon variant="subtle" onClick={onOpen} className="item-action">
            <FileArrowUpIcon size={16} />
          </ActionIcon>
        </Tooltip>
      )}

      {onExclude && (
        <Tooltip
          label={t("fileRandomiser.itemActions.exclude")}
          className="item-action"
        >
          <ActionIcon
            color="orange"
            variant="subtle"
            onClick={onExclude}
            className="item-action"
          >
            <PlusIcon size={16} />
          </ActionIcon>
        </Tooltip>
      )}

      {onRemove && (
        <Tooltip
          label={t("fileRandomiser.itemActions.remove")}
          className="item-action"
        >
          <ActionIcon
            color="red"
            variant="subtle"
            onClick={onRemove}
            className="item-action"
          >
            <TrashIcon size={16} />
          </ActionIcon>
        </Tooltip>
      )}

      {onBookmarkChange && (
        <Tooltip
          label={t("fileRandomiser.itemActions.bookmark")}
          className="item-action"
        >
          <ActionIcon
            variant="subtle"
            onClick={cycleBookmark}
            style={{
              backgroundColor: currentBookmarkColor ?? undefined,
            }}
            className="item-action"
          >
            <StarIcon size={16} />
          </ActionIcon>
        </Tooltip>
      )}
    </Group>
  );
};

export default ItemActions;
