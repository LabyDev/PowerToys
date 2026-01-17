import { useState } from "react";
import { Stack, Group, Text, Badge, Tooltip } from "@mantine/core";
import {
  CaretRightIcon,
  CaretDownIcon,
  MinusIcon,
} from "@phosphor-icons/react";
import { SortTreeNode, SortOperation } from "../types/filesorter";
import FileSorterItemActions from "./fileSorterItemActions";

interface SortPreviewTreeProps {
  root: SortTreeNode;
  plannedMovesBySource: Map<string, SortOperation[]>;
  excludedPaths: Set<string>;
  forcedTargets: Map<string, string>;
  refreshPreview: () => Promise<void>;
  searchQuery?: string;
}

const SortPreviewTree = ({
  root,
  plannedMovesBySource,
  excludedPaths,
  forcedTargets,
  refreshPreview,
  searchQuery = "",
}: SortPreviewTreeProps) => {
  return (
    <Stack gap={2}>
      <TreeNode
        node={root}
        depth={0}
        plannedMovesBySource={plannedMovesBySource}
        excludedPaths={excludedPaths}
        forcedTargets={forcedTargets}
        refreshPreview={refreshPreview}
        searchQuery={searchQuery.toLowerCase()}
      />
    </Stack>
  );
};

interface TreeNodeProps {
  node: SortTreeNode;
  depth: number;
  plannedMovesBySource: Map<string, SortOperation[]>;
  excludedPaths: Set<string>;
  forcedTargets: Map<string, string>;
  refreshPreview: () => Promise<void>;
  searchQuery?: string;
}

function countPlannedMoves(node: SortTreeNode): number {
  if (!node.isDir) return node.operation ? 1 : 0;
  if (!node.children) return 0;
  return node.children.reduce((sum, c) => sum + countPlannedMoves(c), 0);
}

const TreeNode = ({
  node,
  depth,
  plannedMovesBySource,
  excludedPaths,
  forcedTargets,
  refreshPreview,
  searchQuery = "",
}: TreeNodeProps) => {
  // Filter children based on search query
  const matchesSearch = (n: SortTreeNode): boolean => {
    const nameMatch = n.name.toLowerCase().includes(searchQuery);
    if (nameMatch) return true;
    if (n.children) return n.children.some(matchesSearch);
    return false;
  };

  if (searchQuery && !matchesSearch(node)) return null as any;

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
  const expandable =
    (hasChildren || plannedMoves > 0) && !displayNode.operation;
  const [expanded, setExpanded] = useState(hasChildren && plannedMoves > 0);

  const isExcluded = excludedPaths.has(displayNode.path);
  const forcedTarget = forcedTargets.get(displayNode.path);

  // Determine background
  let bgColor: string | undefined;
  if (!displayNode.isDir && displayNode.operation) {
    bgColor = "rgba(144, 238, 144, 0.3)";
  } else if (displayNode.isDir && displayNode.isNew) {
    bgColor = "rgba(144, 238, 144, 0.3)";
  } else if (displayNode.isDir && depth > 0 && plannedMoves > 0) {
    bgColor = "rgba(173, 216, 230, 0.3)";
  } else {
    bgColor = undefined;
  }

  const sortedChildren =
    displayNode.children?.slice().sort((a, b) => {
      if (a.isDir && !b.isDir) return -1;
      if (!a.isDir && b.isDir) return 1;
      return a.name.localeCompare(b.name);
    }) || [];

  const renderHighlighted = (name: string) => {
    if (!searchQuery) return name;
    const lcName = name.toLowerCase();
    const index = lcName.indexOf(searchQuery);
    if (index === -1) return name;
    return (
      <>
        {name.slice(0, index)}
        <Text span c="yellow.5">
          {name.slice(index, index + searchQuery.length)}
        </Text>
        {name.slice(index + searchQuery.length)}
      </>
    );
  };

  return (
    <>
      <Group
        gap={6}
        wrap="nowrap"
        className="item-actions"
        style={{
          position: "relative",
          paddingLeft: depth * 12,
          cursor: expandable ? "pointer" : "default",
          userSelect: "none",
          backgroundColor: isSourceFile ? "rgba(255, 255, 0, 0.3)" : bgColor,
          borderRadius: 4,
        }}
        onClick={() => expandable && setExpanded((e) => !e)}
      >
        <Group gap={0} justify="center" style={{ width: 16, flexShrink: 0 }}>
          {displayNode.isDir &&
            (expandable ? (
              expanded ? (
                <CaretDownIcon size={14} />
              ) : (
                <CaretRightIcon size={14} />
              )
            ) : (
              <MinusIcon size={14} />
            ))}
        </Group>

        <Text size="sm" fw={displayNode.isDir ? 600 : 400} truncate>
          {displayNode.isDir ? "📁 " : "📄 "}
          {nameChain.map((n, i) => (
            <span key={i}>
              {renderHighlighted(n)}
              {i < nameChain.length - 1 ? "/" : ""}
            </span>
          ))}
        </Text>

        {plannedMoves > 0 && displayNode.isDir && (
          <Tooltip
            label={`${plannedMoves} file${plannedMoves > 1 ? "s" : ""} will move inside`}
            withArrow
            openDelay={300}
          >
            <Badge size="xs" color="cyan" variant="light">
              {plannedMoves}
            </Badge>
          </Tooltip>
        )}

        {!displayNode.isDir && (
          <>
            {!displayNode.isDir && !displayNode.operation && (
              <>
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

                <FileSorterItemActions
                  path={displayNode.path}
                  isExcluded={isExcluded}
                  forcedTarget={forcedTarget}
                  refreshPreview={refreshPreview}
                />
              </>
            )}
          </>
        )}
      </Group>

      {expandable && expanded && hasChildren && (
        <Stack gap={2}>
          {sortedChildren.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              plannedMovesBySource={plannedMovesBySource}
              excludedPaths={excludedPaths}
              forcedTargets={forcedTargets}
              refreshPreview={refreshPreview}
              searchQuery={searchQuery}
            />
          ))}
        </Stack>
      )}
    </>
  );
};

export default SortPreviewTree;
