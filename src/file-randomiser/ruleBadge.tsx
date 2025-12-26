import { Badge, Group, Text, ActionIcon } from "@mantine/core";
import { TrashIcon } from "@phosphor-icons/react";
import { FilterRule } from "../types/filerandomiser";

function RuleBadge({
  rule,
  onRemove,
}: {
  rule: FilterRule;
  onRemove: () => void;
}) {
  const isExclude = rule.action === "exclude";

  return (
    <Badge
      color={isExclude ? "red" : "green"}
      variant="light"
      radius="sm"
      px="xs"
    >
      <Group gap={6} wrap="nowrap">
        {/* Include / Exclude symbol */}
        <Text size="xs" fw={700}>
          {isExclude ? "−" : "+"}
        </Text>

        {/* Match type */}
        <Text size="xs" c="dimmed">
          {rule.type}
        </Text>

        {/* Pattern */}
        <Text size="sm" fw={500} lineClamp={1}>
          {rule.pattern}
        </Text>

        {/* Case-sensitive flag */}
        {rule.caseSensitive && (
          <Text size="xs" fw={600}>
            Aa
          </Text>
        )}

        {/* Delete */}
        <ActionIcon
          size="xs"
          variant="subtle"
          color={isExclude ? "red" : "green"}
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => {
            event.stopPropagation();
          }}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <TrashIcon size={10} />
        </ActionIcon>
      </Group>
    </Badge>
  );
}

export default RuleBadge;
