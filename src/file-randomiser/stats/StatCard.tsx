import { Box, Text } from "@mantine/core";

export function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <Box
      p="sm"
      style={{ border: "1px solid #373a40", borderRadius: 8, minWidth: 0 }}
    >
      <Text size="xs" c="dimmed" truncate>
        {label}
      </Text>
      <Text fw={700} size="lg" lh={1.2}>
        {value}
      </Text>
      {sub && (
        <Text size="10px" c="dimmed">
          {sub}
        </Text>
      )}
    </Box>
  );
}
