import { useState } from "react";
import { Stack, Group, Text, Badge, Tooltip } from "@mantine/core";
import {
  CaretRightIcon,
  CaretDownIcon,
  MinusIcon,
} from "@phosphor-icons/react";
import { SortTreeNode, SortOperation } from "../types/filesorter";

interface SortPreviewTreeProps {
  root: SortTreeNode;
  plannedMovesBySource: Map<string, SortOperation[]>;
}

const SortPreviewTree = ({
  root,
  plannedMovesBySource,
}: SortPreviewTreeProps) => {
  return (
    <Stack gap={2}>
      <TreeNode
        node={root}
        depth={0}
        plannedMovesBySource={plannedMovesBySource}
      />
    </Stack>
  );
};

interface TreeNodeProps {
  node: SortTreeNode;
  depth: number;
  plannedMovesBySource: Map<string, SortOperation[]>;
}

// Count files planned to move under this node
function countPlannedMoves(node: SortTreeNode): number {
  if (!node.isDir) return node.operation ? 1 : 0;
  if (!node.children) return 0;
  return node.children.reduce((sum, c) => sum + countPlannedMoves(c), 0);
}

const TreeNode = ({
  node,
  depth,
  parentBg,
  plannedMovesBySource,
}: TreeNodeProps & { parentBg?: string }) => {
  // Flatten single-child folder chains
  let displayNode = node;
  const nameChain = [displayNode.name];

  while (
    displayNode.isDir &&
    displayNode.children &&
    displayNode.children.length === 1 &&
    displayNode.children[0].isDir
  ) {
    displayNode = displayNode.children[0];
    nameChain.push(displayNode.name);
  }

  const plannedMoves = countPlannedMoves(displayNode);
  const hasChildren = displayNode.isDir && !!displayNode.children?.length;
  const isSourceFile =
    !displayNode.isDir && plannedMovesBySource.has(displayNode.path);

  // Collapse folders where nothing is planned by default
  const [expanded, setExpanded] = useState(hasChildren && plannedMoves > 0);

  const expandable = hasChildren || plannedMoves > 0;

  const bgColor =
    parentBg || (displayNode.isNew ? "rgba(144, 238, 144, 0.3)" : undefined);

  const sortedChildren =
    displayNode.children?.slice().sort((a, b) => {
      if (a.isDir && !b.isDir) return -1;
      if (!a.isDir && b.isDir) return 1;
      return a.name.localeCompare(b.name);
    }) || [];

  return (
    <>
      <Group
        gap={6}
        style={{
          position: "relative",
          paddingLeft: depth * 20, // base indent per level
          cursor: expandable ? "pointer" : "default",
          userSelect: "none",
          backgroundColor: isSourceFile ? "rgba(255, 255, 0, 0.3)" : bgColor,
          borderRadius: 4,
        }}
        onClick={() => expandable && setExpanded((e) => !e)}
      >
        {/* Vertical lines for ancestors */}
        {Array.from({ length: depth }).map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: i * 20 + 8, // line offset inside each level
              top: 0,
              bottom: 0,
              width: 1,
              backgroundColor: "rgba(0,0,0,0.15)",
            }}
          />
        ))}
        {/* Horizontal connector line to this node */}
        {depth > 0 && (
          <div
            style={{
              position: "absolute",
              left: depth * 20 - 12,
              top: "50%",
              width: 12,
              height: 1,
              backgroundColor: "rgba(0,0,0,0.15)",
            }}
          />
        )}
        {/* Folder/File icon */}
        {displayNode.isDir &&
          expandable &&
          (expanded ? (
            <CaretDownIcon size={14} />
          ) : (
            <CaretRightIcon size={14} />
          ))}
        {displayNode.isDir && !expandable && <MinusIcon size={14} />}{" "}
        {/* Name */}
        <Text size="sm" fw={displayNode.isDir ? 600 : 400} truncate>
          {displayNode.isDir ? "📁 " : "📄 "}
          {nameChain.join("/")}
        </Text>
        {/* Planned moves badge */}
        {plannedMoves > 0 && (
          <Tooltip
            label={
              displayNode.children && displayNode.isDir
                ? `${plannedMoves} file${plannedMoves > 1 ? "s" : ""} will move inside`
                : displayNode.operation
                  ? `Move to: ${displayNode.operation.destinationFolder} — Reason: ${displayNode.operation.reason}`
                  : ""
            }
            withArrow
            openDelay={300}
          >
            <Badge size="xs" color="cyan" variant="light">
              {plannedMoves}
            </Badge>
          </Tooltip>
        )}
        {/* Source file badge */}
        {isSourceFile && (
          <Tooltip
            label={`Source file — planned move(s): ${plannedMovesBySource
              .get(displayNode.path)!
              .map((op) => op.destinationFolder)
              .join(", ")}`}
            withArrow
            openDelay={300}
          >
            <Badge size="xs" color="yellow" variant="light">
              Source
            </Badge>
          </Tooltip>
        )}
      </Group>

      {expandable && expanded && hasChildren && (
        <Stack gap={2}>
          {sortedChildren.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              parentBg={bgColor}
              plannedMovesBySource={plannedMovesBySource}
            />
          ))}
        </Stack>
      )}
    </>
  );
};

export default SortPreviewTree;
