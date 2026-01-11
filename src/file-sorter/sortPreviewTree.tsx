import { useState } from "react";
import { Stack, Group, Text, Badge, Tooltip } from "@mantine/core";
import { CaretRightIcon, CaretDownIcon } from "@phosphor-icons/react";
import { SortTreeNode } from "../types/filesorter";

interface SortPreviewTreeProps {
  root: SortTreeNode;
}

const SortPreviewTree = ({ root }: SortPreviewTreeProps) => {
  return (
    <Stack gap={2}>
      <TreeNode node={root} depth={0} />
    </Stack>
  );
};

interface TreeNodeProps {
  node: SortTreeNode;
  depth: number;
}

// Count files planned to move under this node
function countPlannedMoves(node: SortTreeNode): number {
  if (!node.isDir) return node.operation ? 1 : 0;
  if (!node.children) return 0;
  return node.children.reduce((sum, c) => sum + countPlannedMoves(c), 0);
}

const TreeNode = ({ node, depth }: TreeNodeProps) => {
  const [expanded, setExpanded] = useState(true);

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

  // Expandable only if there are children or planned moves
  const expandable = hasChildren || plannedMoves > 0;

  return (
    <>
      <Group
        gap={6}
        style={{
          paddingLeft: depth * 16,
          cursor: expandable ? "pointer" : "default",
          userSelect: "none",
        }}
        onClick={() => expandable && setExpanded((e) => !e)}
      >
        {/* Only show caret if expandable */}
        {displayNode.isDir &&
          expandable &&
          (expanded ? (
            <CaretDownIcon size={14} />
          ) : (
            <CaretRightIcon size={14} />
          ))}

        <Text size="sm" fw={displayNode.isDir ? 600 : 400} truncate>
          {displayNode.isDir ? "📁 " : "📄 "}
          {nameChain.join("/")}
        </Text>

        {plannedMoves > 0 && (
          <Tooltip
            label={
              displayNode.children
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
      </Group>

      {expandable && expanded && hasChildren && (
        <Stack gap={2}>
          {displayNode.children!.map((child) => (
            <TreeNode key={child.path} node={child} depth={depth + 1} />
          ))}
        </Stack>
      )}
    </>
  );
};

export default SortPreviewTree;
