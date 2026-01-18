import { Badge, Group, Text, ActionIcon } from "@mantine/core";
import { TrashIcon } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";
import { FilterRule } from "../../../types/filerandomiser";

interface RuleBadgeProps {
  rule: FilterRule;
  onRemove: () => void;
}

const RuleBadge = ({ rule, onRemove }: RuleBadgeProps) => {
  const { t } = useTranslation();
  const isExclude = rule.action === "exclude";
  const badgeColor = isExclude ? "red" : "green";

  const stopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <Badge color={badgeColor} variant="light" radius="sm" px="xs">
      <Group gap={6} wrap="nowrap">
        {/* Include / Exclude symbol */}
        <Text size="xs" fw={700}>
          {isExclude
            ? t("fileRandomiser.filtersPanel.ruleBadge.excludeSymbol")
            : t("fileRandomiser.filtersPanel.ruleBadge.includeSymbol")}
        </Text>

        {/* Match type */}
        <Text size="xs" c="dimmed">
          {t(`fileRandomiser.filtersPanel.ruleTypes.${rule.type}`)}
        </Text>

        {/* Pattern */}
        <Text size="sm" fw={500} lineClamp={1}>
          {rule.pattern}
        </Text>

        {/* Case-sensitive flag */}
        {rule.caseSensitive && (
          <Text size="xs" fw={600}>
            {t("fileRandomiser.filtersPanel.ruleBadge.caseSensitiveLabel")}
          </Text>
        )}

        {/* Delete action */}
        <ActionIcon
          size="xs"
          variant="subtle"
          color={badgeColor}
          onPointerDown={stopPropagation}
          onMouseDown={stopPropagation}
          onClick={(e) => {
            stopPropagation(e);
            onRemove();
          }}
        >
          <TrashIcon size={10} />
        </ActionIcon>
      </Group>
    </Badge>
  );
};

export default RuleBadge;
