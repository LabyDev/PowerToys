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
import { BookmarkInfo } from "../../../types/filerandomiser";

type ItemActionsProps = {
  onOpenFolder?: () => void;
  onExclude?: () => void;
  onRemove?: () => void;
  onOpen?: () => void;
  onBookmarkChange?: (color: string | null) => void;
  onBookmarkChangeGlobal?: (color: string | null) => void;
  currentBookmark?: BookmarkInfo;
  bookmarkColors?: string[];
};

const ItemActions = ({
  onOpenFolder,
  onExclude,
  onRemove,
  onOpen,
  onBookmarkChange,
  onBookmarkChangeGlobal,
  currentBookmark,
  bookmarkColors,
}: ItemActionsProps) => {
  const { t } = useTranslation();

  // ------------------- Bookmark cycling -------------------
  const cycleBookmark = (event: React.MouseEvent) => {
    if (!onBookmarkChange && !onBookmarkChangeGlobal) return;

    const cycle = [null, ...(bookmarkColors ?? [])];
    const currentColor = currentBookmark?.color ?? null;
    const currentIdx = cycle.indexOf(currentColor);
    const nextColor = cycle[(currentIdx + 1) % cycle.length];

    if (event.shiftKey || currentBookmark?.isGlobal || !onBookmarkChange) {
      onBookmarkChangeGlobal?.(nextColor);
    } else {
      onBookmarkChange(nextColor);
    }
  };

  // ------------------- Early return if no actions -------------------
  if (!onOpenFolder && !onExclude && !onRemove && !onOpen && !onBookmarkChange)
    return null;

  // ------------------- Render individual action button -------------------
  const renderAction = (
    icon: JSX.Element,
    label: string,
    onClick?: () => void,
    color?: string,
  ) => (
    <Tooltip label={label} withArrow position="top">
      <ActionIcon
        variant="subtle"
        onClick={onClick}
        color={color}
        className="item-action"
      >
        {icon}
      </ActionIcon>
    </Tooltip>
  );

  return (
    <Group gap={4} wrap="nowrap" mr={2}>
      {onOpenFolder &&
        renderAction(
          <FolderOpenIcon size={16} />,
          t("fileRandomiser.itemActions.openFolder"),
          onOpenFolder,
        )}
      {onOpen &&
        renderAction(
          <FileArrowUpIcon size={16} />,
          t("fileRandomiser.itemActions.openFile"),
          onOpen,
        )}
      {onExclude &&
        renderAction(
          <PlusIcon size={16} />,
          t("fileRandomiser.itemActions.exclude"),
          onExclude,
          "orange",
        )}
      {onRemove &&
        renderAction(
          <TrashIcon size={16} />,
          t("fileRandomiser.itemActions.remove"),
          onRemove,
          "red",
        )}

      {(onBookmarkChange || onBookmarkChangeGlobal) && (
        <Tooltip
          label={t("fileRandomiser.itemActions.bookmark")}
          withArrow
          position="top"
        >
          <div style={{ position: "relative", display: "inline-block" }}>
            <ActionIcon
              variant="subtle"
              onClick={cycleBookmark}
              color={currentBookmark?.color ?? "var(--mantine-color-gray-6)"}
              className={`item-action ${currentBookmark?.color ? "item-action--bookmark" : ""}`}
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
