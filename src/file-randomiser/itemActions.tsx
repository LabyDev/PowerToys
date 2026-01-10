import { ActionIcon, Group, Tooltip } from "@mantine/core";
import {
  FolderOpenIcon,
  PlusIcon,
  TrashIcon,
  FileArrowUpIcon,
  BookmarkIcon,
  GlobeHemisphereWestIcon,
} from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";
import { BookmarkInfo } from "../types/common";

type ItemActionsProps = {
  onOpenFolder?: () => void;
  onExclude?: () => void;
  onRemove?: () => void;
  onOpen?: () => void;
  onBookmarkChange?: (color: string | null) => void;
  onBookmarkChangeGlobal?: (color: string | null) => void;
  currentBookmark?: BookmarkInfo | undefined;
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
  onBookmarkChangeGlobal,
  currentBookmark,
}: ItemActionsProps) => {
  const { t } = useTranslation();

  const cycleBookmark = (event: React.MouseEvent) => {
    if (!onBookmarkChange) return;

    // Determine if we are in "global lock" mode
    const isGlobalLocked = currentBookmark?.isGlobal ?? false;

    const currentColor: BookmarkCycleColor = bookmarkCycle.includes(
      currentBookmark?.color as BookmarkCycleColor,
    )
      ? (currentBookmark!.color as BookmarkCycleColor)
      : null;

    const currentIndex = bookmarkCycle.indexOf(currentColor);
    const nextIndex = (currentIndex + 1) % bookmarkCycle.length;
    const nextColor = bookmarkCycle[nextIndex];

    // If shift is pressed → always global
    if (event.shiftKey || isGlobalLocked) {
      if (!onBookmarkChangeGlobal) return;
      onBookmarkChangeGlobal(nextColor);
    } else {
      onBookmarkChange(nextColor);
    }
  };

  if (!onOpenFolder && !onExclude && !onRemove && !onOpen && !onBookmarkChange)
    return null;

  return (
    <Group gap={4} wrap="nowrap">
      {onOpenFolder && (
        <Tooltip
          label={t("fileRandomiser.itemActions.openFolder")}
          withArrow
          position="top"
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
          withArrow
          position="top"
        >
          <ActionIcon variant="subtle" onClick={onOpen} className="item-action">
            <FileArrowUpIcon size={16} />
          </ActionIcon>
        </Tooltip>
      )}

      {onExclude && (
        <Tooltip
          label={t("fileRandomiser.itemActions.exclude")}
          withArrow
          position="top"
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
          withArrow
          position="top"
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
          withArrow
          position="top"
        >
          <div style={{ position: "relative", display: "inline-block" }}>
            <ActionIcon
              variant="subtle"
              onClick={cycleBookmark}
              className={`item-action ${currentBookmark?.color ? "item-action--bookmark" : ""}`}
              color={currentBookmark?.color ?? "var(--mantine-color-gray-6)"}
            >
              <BookmarkIcon
                weight={currentBookmark?.color ? "fill" : "regular"}
                size={18}
              />
            </ActionIcon>

            {currentBookmark?.isGlobal && (
              <div
                style={{
                  position: "absolute",
                  top: -4,
                  width: 16,
                  height: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <GlobeHemisphereWestIcon
                  size={10}
                  weight="fill"
                  color="var(--mantine-color-blue-6)"
                />
              </div>
            )}
          </div>
        </Tooltip>
      )}
    </Group>
  );
};

export default ItemActions;
