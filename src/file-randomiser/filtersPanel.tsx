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
  Select,
} from "@mantine/core";
import { FunnelIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import {
  AppStateData,
  FilterRule,
  FilterMatchType,
  FilterTarget,
  FilterAction,
} from "../types/filerandomiser";

interface FiltersPanelProps {
  data: AppStateData;
  updateData: (updated: AppStateData) => Promise<void>;
}

const RULE_TYPES: { value: FilterMatchType; label: string }[] = [
  { value: "contains", label: "Contains" },
  { value: "startsWith", label: "Starts with" },
  { value: "endsWith", label: "Ends with" },
  { value: "regex", label: "Regex" },
];

const FiltersPanel = ({ data, updateData }: FiltersPanelProps) => {
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [newRule, setNewRule] = useState<Omit<FilterRule, "id">>({
    target: "filename",
    action: "exclude",
    type: "contains",
    pattern: "",
    caseSensitive: false,
  });

  // Add a new rule
  const addRule = async () => {
    if (!newRule.pattern.trim()) return;
    const rule: FilterRule = { ...newRule, id: crypto.randomUUID() };
    await updateData({ ...data, filterRules: [...data.filterRules, rule] });
    setNewRule({
      target: "filename",
      action: "exclude",
      type: "contains",
      pattern: "",
      caseSensitive: false,
    });
  };

  // Remove a rule
  const removeRule = async (id: string) => {
    await updateData({
      ...data,
      filterRules: data.filterRules.filter((r) => r.id !== id),
    });
  };

  // Render rules by target/action
  const renderRules = (target: FilterTarget, action: FilterAction) =>
    data.filterRules
      .filter((r) => r.target === target && r.action === action)
      .map((r) => (
        <Group key={r.id} justify="space-between" px="xs">
          <Group gap={6}>
            <Text size="sm" lineClamp={1}>
              {r.pattern}
            </Text>
            <Text size="xs" c="dimmed">
              ({r.type}
              {r.caseSensitive ? ", case-sensitive" : ""})
            </Text>
          </Group>
          <ActionIcon
            color="red"
            variant="subtle"
            onClick={() => removeRule(r.id)}
          >
            <TrashIcon size={14} />
          </ActionIcon>
        </Group>
      ));

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
          {/* Add new rule */}
          <Stack gap={6}>
            <Text size="sm" fw={600}>
              Add Rule
            </Text>
            <Group gap="xs" align="flex-start">
              <Select
                data={RULE_TYPES}
                value={newRule.type}
                onChange={(v) =>
                  setNewRule((r) => ({ ...r, type: v as FilterMatchType }))
                }
                style={{ width: 120 }}
              />
              <TextInput
                placeholder="Pattern"
                value={newRule.pattern}
                onChange={(e) =>
                  setNewRule((r) => ({ ...r, pattern: e.currentTarget.value }))
                }
                onKeyDown={(e) => e.key === "Enter" && addRule()}
                style={{ flex: 1 }}
              />
              <Checkbox
                label="Folder"
                checked={newRule.target === "folder"}
                onChange={(e) =>
                  setNewRule((r) => ({
                    ...r,
                    target: e.currentTarget.checked ? "folder" : "filename",
                  }))
                }
              />
              <Checkbox
                label="Include"
                checked={newRule.action === "include"}
                onChange={(e) =>
                  setNewRule((r) => ({
                    ...r,
                    action: e.currentTarget.checked ? "include" : "exclude",
                  }))
                }
              />
              <Checkbox
                label="Case-sensitive"
                checked={newRule.caseSensitive}
                onChange={(e) =>
                  setNewRule((r) => ({
                    ...r,
                    caseSensitive: e.currentTarget.checked,
                  }))
                }
              />
              <ActionIcon variant="light" onClick={addRule}>
                <PlusIcon size={16} />
              </ActionIcon>
            </Group>
          </Stack>

          <Divider />

          {/* Folder Rules */}
          <Stack gap={6}>
            <Text size="sm" fw={600}>
              Excluded Folders
            </Text>
            {renderRules("folder", "exclude")}

            <Text size="sm" fw={600} mt="sm">
              Included Folders
            </Text>
            {renderRules("folder", "include")}
          </Stack>

          <Divider />

          {/* Filename Rules */}
          <Stack gap={6}>
            <Text size="sm" fw={600}>
              Excluded Filenames
            </Text>
            {renderRules("filename", "exclude")}

            <Text size="sm" fw={600} mt="sm">
              Included Filenames
            </Text>
            {renderRules("filename", "include")}
          </Stack>
        </Stack>
      </Collapse>
    </Paper>
  );
};

export default FiltersPanel;
