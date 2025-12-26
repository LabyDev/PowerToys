import { Box, ActionIcon, Stack, Text } from "@mantine/core";
import { PlusIcon } from "@phosphor-icons/react";
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
  return (
    <Stack gap={2}>
      {nodes.map((node) => (
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
            <Text
              size="sm"
              lineClamp={1}
              style={{
                textDecoration: node.file?.excluded ? "line-through" : "none",
              }}
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

          {node.children && node.children.length > 0 && (
            <FileTree
              nodes={node.children}
              onExclude={onExclude}
              currentFileId={currentFileId}
            />
          )}
        </Box>
      ))}
    </Stack>
  );
};

export default FileTree;
