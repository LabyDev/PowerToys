import { useState } from "react";
import { Stack, Group, Text } from "@mantine/core";
import { CaretRightIcon, CaretDownIcon } from "@phosphor-icons/react";

export interface SortTreeNode {
  name: string;
  path: string;
  children?: SortTreeNode[];
}

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
  const hasChildren = !!node.children && node.children.length > 0;
  const [expanded, setExpanded] = useState(true);

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
        {hasChildren && (
          <>
            {expanded ? (
              <CaretDownIcon size={14} />
            ) : (
              <CaretRightIcon size={14} />
            )}
          </>
        )}

        <Text size="sm" fw={hasChildren ? 600 : 400}>
          {hasChildren ? "📁 " : "📄 "}
          {node.name}
        </Text>
      </Group>

      {hasChildren && expanded && (
        <>
          {node.children!.map((child) => (
            <TreeNode key={child.path} node={child} depth={depth + 1} />
          ))}
        </>
      )}
    </>
  );
};

export default SortPreviewTree;
