import { Box, ActionIcon, Stack } from "@mantine/core";
import { PlusIcon, CaretRightIcon, CaretDownIcon } from "@phosphor-icons/react";
import { useState, useEffect, useRef } from "react";
import { FileEntry, FileTreeNode } from "../types/filerandomiser";
import ClampedTooltipText from "./clampedTooltipText";

const FileTreeNodeComponent = ({
  node,
  onExclude,
  currentFileId,
  isRoot = false,
  index = 0,
}: {
  node: FileTreeNode;
  onExclude: (file: FileEntry) => void;
  currentFileId: number | null;
  isRoot?: boolean;
  index?: number;
}) => {
  const containsCurrentFile = (node: FileTreeNode): boolean => {
    if (node.file && node.file.id === currentFileId) return true;
    if (!node.children) return false;
    return node.children.some(containsCurrentFile);
  };

  const defaultExpanded =
    node.children && (isRoot && index === 0 ? true : containsCurrentFile(node)); // first root node OR contains currentFile
  const [expanded, setExpanded] = useState(defaultExpanded);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (node.file?.id === currentFileId && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    if (node.children && containsCurrentFile(node)) {
      setExpanded(true);
    }
  }, [currentFileId]);

  return (
    <Box pl={node.children ? 10 : 20} ref={ref}>
      <Box
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          backgroundColor:
            !node.children && node.file && currentFileId === node.file.id
              ? "var(--mantine-color-blue-light)"
              : undefined,
          opacity: node.file?.excluded ? 0.5 : 1,
        }}
      >
        {node.children && (
          <ActionIcon
            variant="subtle"
            onClick={() => setExpanded((e) => !e)}
            size="xs"
          >
            {expanded ? (
              <CaretDownIcon size={16} />
            ) : (
              <CaretRightIcon size={16} />
            )}
          </ActionIcon>
        )}

        <ClampedTooltipText
          size="sm"
          style={{
            textDecoration: node.file?.excluded ? "line-through" : "none",
            cursor: node.children ? "pointer" : undefined,
          }}
          onClick={() => node.children && setExpanded((e) => !e)}
        >
          {node.name}
        </ClampedTooltipText>

        {node.file && (
          <ActionIcon
            color="orange"
            variant="subtle"
            onClick={() => onExclude(node.file!)}
          >
            <PlusIcon size={16} />
          </ActionIcon>
        )}
      </Box>

      {node.children && expanded && (
        <FileTree
          nodes={node.children}
          onExclude={onExclude}
          currentFileId={currentFileId}
        />
      )}
    </Box>
  );
};

const FileTree = ({
  nodes,
  onExclude,
  currentFileId,
  isRoot = true,
}: {
  nodes: FileTreeNode[];
  onExclude: (file: FileEntry) => void;
  currentFileId: number | null;
  isRoot?: boolean;
}) => {
  return (
    <Stack gap={2}>
      {nodes.map((node, idx) => (
        <FileTreeNodeComponent
          key={node.path}
          node={node}
          onExclude={onExclude}
          currentFileId={currentFileId}
          isRoot={isRoot}
          index={idx}
        />
      ))}
    </Stack>
  );
};

export default FileTree;
