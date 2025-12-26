import { Box, ActionIcon, Stack, Text } from "@mantine/core";
import { PlusIcon, CaretRightIcon, CaretDownIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { FileEntry, FileTreeNode } from "../types/filerandomiser";

const FileTree = ({
  nodes,
  onExclude,
  currentFileId,
}: {
  nodes: FileTreeNode[];
  onExclude: (file: FileEntry) => void;
  currentFileId: number | null;
}) => {
  const containsCurrentFile = (node: FileTreeNode): boolean => {
    if (node.file && node.file.id === currentFileId) return true;
    if (!node.children) return false;
    return node.children.some(containsCurrentFile);
  };

  return (
    <Stack gap={2}>
      {nodes.map((node) => {
        const defaultExpanded = node.children
          ? containsCurrentFile(node)
          : false;
        const [expanded, setExpanded] = useState(defaultExpanded);

        return (
          <Box key={node.path} pl={node.children ? 10 : 20}>
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

              <Text
                size="sm"
                lineClamp={1}
                style={{
                  textDecoration: node.file?.excluded ? "line-through" : "none",
                  cursor: node.children ? "pointer" : undefined,
                }}
                onClick={() => node.children && setExpanded((e) => !e)}
              >
                {node.name}
              </Text>

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
      })}
    </Stack>
  );
};

export default FileTree;
