import { Box, ActionIcon, Stack, Group } from "@mantine/core";
import { CaretRightIcon, CaretDownIcon } from "@phosphor-icons/react";
import { useState, useEffect, useRef } from "react";
import { FileEntry, FileTreeNode } from "../types/filerandomiser";
import ClampedTooltipText from "./clampedTooltipText";
import ItemActions from "./itemActions";
import * as randomiserApi from "../core/api/fileRandomiserApi";
import { dirname } from "@tauri-apps/api/path";

interface FileTreeNodeComponentProps {
  node: FileTreeNode;
  onExclude: (file: FileEntry) => void;
  currentFileId: number | null;
  isRoot?: boolean;
  freshCrawl?: boolean;
  treeCollapsed?: boolean;
}

const FileTreeNodeComponent = ({
  node,
  onExclude,
  currentFileId,
  isRoot = false,
  freshCrawl = false,
  treeCollapsed,
}: FileTreeNodeComponentProps) => {
  const containsCurrentFile = (node: FileTreeNode): boolean => {
    if (node.file && node.file.id === currentFileId) return true;
    if (!node.children) return false;
    return node.children.some(containsCurrentFile);
  };

  const allChildrenExcluded = (node: FileTreeNode): boolean => {
    if (node.file) return node.file.excluded ?? false;
    if (!node.children) return false;
    return node.children.every(allChildrenExcluded);
  };

  const [expanded, setExpanded] = useState(false);

  const ref = useRef<HTMLDivElement>(null);

  const isExcluded = node.file ? node.file.excluded : allChildrenExcluded(node);

  useEffect(() => {
    if (node.children) {
      const shouldExpand = isRoot || containsCurrentFile(node);
      if (shouldExpand) setExpanded(shouldExpand);
    }
  }, [currentFileId]);

  useEffect(() => {
    if (node.children) {
      if (treeCollapsed === true) {
        setExpanded(false);
      } else if (treeCollapsed === false && freshCrawl && node.depth <= 1) {
        setExpanded(true);
      } else if (treeCollapsed === false && !freshCrawl) {
        setExpanded(true);
      }
    }
  }, [treeCollapsed]);

  return (
    <Box
      id={node.file ? `file-${node.file.id}` : undefined}
      pl={node.children ? 10 : 20}
      ref={ref}
    >
      <Group
        gap={8}
        className="item-actions"
        style={{
          backgroundColor:
            !node.children && node.file && currentFileId === node.file.id
              ? "var(--mantine-color-blue-light)"
              : undefined,
          opacity: isExcluded ? 0.5 : 1,
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
            textDecoration: isExcluded ? "line-through" : "none",
            cursor: node.children ? "pointer" : undefined,
            flex: 1,
          }}
          onClick={() => node.children && setExpanded((e) => !e)}
        >
          {node.name}
        </ClampedTooltipText>

        {node.file && (
          <ItemActions
            onOpen={async () => randomiserApi.openPath(node.file!.path)}
            onOpenFolder={async () => {
              const folder = await dirname(node.file!.path);
              randomiserApi.openPath(folder);
            }}
            onExclude={() => onExclude(node.file!)}
          />
        )}

        {node.children && (
          <ItemActions
            onOpenFolder={async () => randomiserApi.openPath(node.path)}
            onExclude={() =>
              onExclude({
                id: -1,
                path: node.path,
                name: node.name,
                excluded: false,
              })
            }
          />
        )}
      </Group>

      {node.children && expanded && (
        <FileTree
          nodes={node.children.map((child) => ({ ...child, parent: node }))}
          onExclude={onExclude}
          currentFileId={currentFileId}
          isRoot={false}
          freshCrawl={freshCrawl}
          treeCollapsed={treeCollapsed}
        />
      )}
    </Box>
  );
};

interface FileTreeProps {
  nodes: FileTreeNode[];
  onExclude: (file: FileEntry) => void;
  currentFileId: number | null;
  isRoot?: boolean;
  freshCrawl?: boolean;
  treeCollapsed?: boolean;
}

const FileTree = ({
  nodes,
  onExclude,
  currentFileId,
  isRoot = true,
  freshCrawl = false,
  treeCollapsed = false,
}: FileTreeProps) => {
  return (
    <Stack gap={2}>
      {nodes.map((node) => (
        <FileTreeNodeComponent
          key={node.path}
          node={node}
          onExclude={onExclude}
          currentFileId={currentFileId}
          isRoot={isRoot}
          freshCrawl={freshCrawl}
          treeCollapsed={treeCollapsed}
        />
      ))}
    </Stack>
  );
};

export default FileTree;
