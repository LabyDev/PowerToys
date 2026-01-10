import { useState } from "react";
import { Stack, Group, Text } from "@mantine/core";
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

  // Flatten chains of single-child folders (isDir === true)
  let displayNode = node;
  const nameChain = [displayNode.name];

  while (
    displayNode.isDir &&
    displayNode.children &&
    displayNode.children.length === 1 &&
    displayNode.children[0].isDir // stop flattening if the child is a file
  ) {
    displayNode = displayNode.children[0];
    nameChain.push(displayNode.name);
  }

  const hasChildren = !!displayNode.children && displayNode.children.length > 0;

  return (
    <>
      <Group
        gap={6}
        style={{
          paddingLeft: depth * 16,
          cursor: hasChildren ? "pointer" : "default",
        }}
        onClick={() => hasChildren && setExpanded((e) => !e)}
      >
        {hasChildren &&
          (expanded ? (
            <CaretDownIcon size={14} />
          ) : (
            <CaretRightIcon size={14} />
          ))}

        <Text size="sm" fw={hasChildren ? 600 : 400}>
          {hasChildren ? "📁 " : "📄 "}
          {nameChain.join("/")}
        </Text>
      </Group>

      {hasChildren && expanded && (
        <>
          {displayNode.children!.map((child) => (
            <TreeNode key={child.path} node={child} depth={depth + 1} />
          ))}
        </>
      )}
    </>
  );
};

export default SortPreviewTree;
