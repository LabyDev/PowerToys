import { useState } from "react";
import {
  Paper,
  Group,
  Stack,
  Text,
  TextInput,
  ActionIcon,
  Checkbox,
  Divider,
  Collapse,
} from "@mantine/core";
import { FunnelIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { AppStateData } from "../types/filerandomiser";

interface FiltersPanelProps {
  data: AppStateData;
  updateData: (updated: AppStateData) => Promise<void>;
}

const FiltersPanel = ({ data, updateData }: FiltersPanelProps) => {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [newFolder, setNewFolder] = useState("");
  const [newFilename, setNewFilename] = useState("");
  const [newIsRegex, setNewIsRegex] = useState(false);

  return (
    <Paper withBorder radius="md" p="sm">
      <Group
        justify="space-between"
        style={{ cursor: "pointer" }}
        onClick={() => setFiltersOpen((o) => !o)}
      >
        <Group gap="xs">
          <FunnelIcon size={16} />
          <Text fw={600}>Filters & Exclusions</Text>
        </Group>
        <Text size="xs" c="dimmed">
          {filtersOpen ? "Hide" : "Show"}
        </Text>
      </Group>

      <Collapse in={filtersOpen}>
        <Stack gap="md" mt="sm">
          {/* Excluded folders */}
          <Stack gap={6}>
            <Text size="sm" fw={600}>
              Excluded folders
            </Text>
            <Group gap="xs">
              <TextInput
                placeholder="e.g. node_modules or src/generated"
                value={newFolder}
                onChange={(e) => setNewFolder(e.currentTarget.value)}
                style={{ flex: 1 }}
              />
              <ActionIcon
                variant="light"
                onClick={async () => {
                  if (!newFolder.trim()) return;
                  await updateData({
                    ...data,
                    excludedFolders: [
                      ...data.excludedFolders,
                      { id: crypto.randomUUID(), path: newFolder.trim() },
                    ],
                  });
                  setNewFolder("");
                }}
              >
                <PlusIcon size={16} />
              </ActionIcon>
            </Group>

            {data.excludedFolders.map((f) => (
              <Group key={f.id} justify="space-between" px="xs">
                <Text size="sm" lineClamp={1}>
                  {f.path}
                </Text>
                <ActionIcon
                  color="red"
                  variant="subtle"
                  onClick={async () => {
                    const updated = data.excludedFolders.filter(
                      (x) => x.id !== f.id,
                    );
                    await updateData({ ...data, excludedFolders: updated });
                  }}
                >
                  <TrashIcon size={14} />
                </ActionIcon>
              </Group>
            ))}
          </Stack>

          <Divider />

          {/* Excluded filenames */}
          <Stack gap={6}>
            <Text size="sm" fw={600}>
              Excluded filenames
            </Text>
            <Group gap="xs" align="flex-start">
              <TextInput
                placeholder={
                  newIsRegex ? "Regex pattern" : "Filename contains…"
                }
                value={newFilename}
                onChange={(e) => setNewFilename(e.currentTarget.value)}
                style={{ flex: 1 }}
              />
              <Checkbox
                label="Regex"
                checked={newIsRegex}
                onChange={(e) => setNewIsRegex(e.currentTarget.checked)}
              />
              <ActionIcon
                variant="light"
                onClick={async () => {
                  if (!newFilename.trim()) return;
                  await updateData({
                    ...data,
                    excludedFilenames: [
                      ...data.excludedFilenames,
                      {
                        id: crypto.randomUUID(),
                        pattern: newFilename.trim(),
                        isRegex: newIsRegex,
                      },
                    ],
                  });
                  setNewFilename("");
                  setNewIsRegex(false);
                }}
              >
                <PlusIcon size={16} />
              </ActionIcon>
            </Group>

            {data.excludedFilenames.map((f) => (
              <Group key={f.id} justify="space-between" px="xs">
                <Group gap="xs">
                  <Text size="sm" lineClamp={1}>
                    {f.pattern}
                  </Text>
                  {f.isRegex && (
                    <Text size="xs" c="dimmed">
                      (regex)
                    </Text>
                  )}
                </Group>
                <ActionIcon
                  color="red"
                  variant="subtle"
                  onClick={async () => {
                    const updated = data.excludedFilenames.filter(
                      (x) => x.id !== f.id,
                    );
                    await updateData({ ...data, excludedFilenames: updated });
                  }}
                >
                  <TrashIcon size={14} />
                </ActionIcon>
              </Group>
            ))}
          </Stack>
        </Stack>
      </Collapse>
    </Paper>
  );
};

export default FiltersPanel;
