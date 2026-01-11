import { useState } from "react";
import { Stack, Group, Text, Badge } from "@mantine/core";
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

  const hasChildren = !!displayNode.children && displayNode.children.length > 0;

  // Count files under this node (for badges)
  const fileCount = countFiles(displayNode);

  return (
    <>
      <Group
        gap={6}
        style={{
          paddingLeft: depth * 16,
          cursor: hasChildren ? "pointer" : "default",
          userSelect: "none",
        }}
        onClick={() => hasChildren && setExpanded((e) => !e)}
      >
        {hasChildren &&
          (expanded ? (
            <CaretDownIcon size={14} />
          ) : (
            <CaretRightIcon size={14} />
          ))}

        <Text size="sm" fw={hasChildren ? 600 : 400} truncate>
          {hasChildren ? "📁 " : "📄 "}
          {nameChain.join("/")}
        </Text>

        {hasChildren && !expanded && fileCount > 0 && (
          <Badge size="xs" color="gray" variant="light">
            {fileCount} file{fileCount > 1 ? "s" : ""}
          </Badge>
        )}
      </Group>

      {hasChildren && expanded && (
        <Stack gap={2}>
          {displayNode.children!.map((child) => (
            <TreeNode key={child.path} node={child} depth={depth + 1} />
          ))}
        </Stack>
      )}
    </>
  );
};

// Recursively count all files under this node
function countFiles(node: SortTreeNode): number {
  if (!node.isDir) return 1;
  if (!node.children || node.children.length === 0) return 0;
  return node.children.reduce((sum, child) => sum + countFiles(child), 0);
}

export default SortPreviewTree;
