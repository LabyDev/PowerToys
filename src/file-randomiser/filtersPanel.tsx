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
import { FunnelIcon, PlusIcon } from "@phosphor-icons/react";
import {
  AppStateData,
  FilterRule,
  FilterMatchType,
  FilterTarget,
} from "../types/filerandomiser";
import RuleBadge from "./ruleBadge";

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

  const renderRuleGroup = (target: FilterTarget) => {
    const rules = data.filterRules.filter((r) => r.target === target);

    if (rules.length === 0) {
      return (
        <Text size="xs" c="dimmed">
          No rules
        </Text>
      );
    }

    return (
      <Group gap="xs">
        {rules.map((r) => (
          <RuleBadge key={r.id} rule={r} onRemove={() => removeRule(r.id)} />
        ))}
      </Group>
    );
  };

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

          <Stack gap="sm">
            <Text size="sm" fw={600}>
              Folder rules
            </Text>
            {renderRuleGroup("folder")}

            <Divider my="xs" />

            <Text size="sm" fw={600}>
              Filename rules
            </Text>
            {renderRuleGroup("filename")}
          </Stack>
        </Stack>
      </Collapse>
    </Paper>
  );
};

export default FiltersPanel;
