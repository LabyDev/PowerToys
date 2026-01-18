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
import { AppStateData } from "../../types/filerandomiser";
import RuleBadge from "./ruleBadge";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { useTranslation } from "react-i18next";
import { FilterMatchType, FilterRule } from "../../types/common";

const FiltersPanel = ({
  data,
  updateData,
}: {
  data: AppStateData;
  updateData: (updated: AppStateData) => Promise<void>;
}) => {
  const { t } = useTranslation();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [newRule, setNewRule] = useState<Omit<FilterRule, "id">>({
    action: "exclude",
    type: "contains",
    pattern: "",
    caseSensitive: false,
  });

  const sensors = useSensors(useSensor(PointerSensor));

  const RULE_TYPES: { value: FilterMatchType; label: string }[] = [
    {
      value: "contains",
      label: t("fileRandomiser.filtersPanel.ruleTypes.contains"),
    },
    {
      value: "startsWith",
      label: t("fileRandomiser.filtersPanel.ruleTypes.startsWith"),
    },
    {
      value: "endsWith",
      label: t("fileRandomiser.filtersPanel.ruleTypes.endsWith"),
    },
    { value: "regex", label: t("fileRandomiser.filtersPanel.ruleTypes.regex") },
  ];

  const addRule = async () => {
    if (!newRule.pattern.trim()) return;

    // Detect trigger and force type at the moment of addition
    const finalType = newRule.pattern.startsWith("@bookmarks")
      ? ("bookmarks" as FilterMatchType)
      : newRule.type;

    const rule: FilterRule = {
      ...newRule,
      type: finalType,
      id: crypto.randomUUID(),
    };

    await updateData({ ...data, filterRules: [...data.filterRules, rule] });

    // Reset back to previous manual selection
    setNewRule({
      action: "exclude",
      type: newRule.type,
      pattern: "",
      caseSensitive: false,
    });
  };

  const removeRule = async (id: string) => {
    await updateData({
      ...data,
      filterRules: data.filterRules.filter((r) => r.id !== id),
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = data.filterRules.findIndex((r) => r.id === active.id);
    const newIndex = data.filterRules.findIndex((r) => r.id === over.id);

    await updateData({
      ...data,
      filterRules: arrayMove(data.filterRules, oldIndex, newIndex),
    });
  };

  // Sortable wrapper for RuleBadge
  function SortableRuleBadge({
    rule,
    onRemove,
  }: {
    rule: FilterRule;
    onRemove: () => void;
  }) {
    const { attributes, listeners, setNodeRef, transform, transition } =
      useSortable({ id: rule.id });
    const style: React.CSSProperties = {
      transform: CSS.Transform.toString(transform),
      transition,
    };
    return (
      <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
        <RuleBadge rule={rule} onRemove={onRemove} />
      </div>
    );
  }

  return (
    <Paper withBorder radius="md" p="sm">
      <Group
        justify="space-between"
        style={{ cursor: "pointer" }}
        onClick={() => setFiltersOpen((o) => !o)}
      >
        <Group gap="xs">
          <FunnelIcon size={16} />
          <Text fw={600}>{t("fileRandomiser.filtersPanel.title")}</Text>
        </Group>
        <Text size="xs" c="dimmed">
          {filtersOpen
            ? t("fileRandomiser.filtersPanel.hide")
            : t("fileRandomiser.filtersPanel.show")}
        </Text>
      </Group>

      <Collapse in={filtersOpen}>
        <Stack gap="md" mt="sm">
          {/* Add new rule */}
          <Stack gap={6}>
            <Text size="sm" fw={600}>
              {t("fileRandomiser.filtersPanel.addRule")}
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
                placeholder={t(
                  "fileRandomiser.filtersPanel.patternPlaceholder",
                )}
                value={newRule.pattern}
                onChange={(e) =>
                  setNewRule((r) => ({ ...r, pattern: e.currentTarget.value }))
                }
                onKeyDown={(e) => e.key === "Enter" && addRule()}
                style={{ flex: 1 }}
              />
              <Checkbox
                label={t("fileRandomiser.filtersPanel.includeLabel")}
                checked={newRule.action === "include"}
                onChange={(e) =>
                  setNewRule((r) => ({
                    ...r,
                    action: e.currentTarget.checked ? "include" : "exclude",
                  }))
                }
              />
              <Checkbox
                label={t("fileRandomiser.filtersPanel.caseSensitiveLabel")}
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

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={data.filterRules.map((r) => r.id)}
              strategy={rectSortingStrategy}
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {data.filterRules.length === 0 ? (
                  <Text size="xs" c="dimmed">
                    {t("fileRandomiser.filtersPanel.noRules")}
                  </Text>
                ) : (
                  data.filterRules.map((r) => (
                    <SortableRuleBadge
                      key={r.id}
                      rule={r}
                      onRemove={() => removeRule(r.id)}
                    />
                  ))
                )}
              </div>
            </SortableContext>
          </DndContext>
        </Stack>
      </Collapse>
    </Paper>
  );
};

export default FiltersPanel;
