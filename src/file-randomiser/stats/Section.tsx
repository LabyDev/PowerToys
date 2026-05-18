import { Stack, Text } from "@mantine/core";

export function Section({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <Stack gap={6}>
      <Text fw={600}>{title}</Text>
      {sub && (
        <Text size="xs" c="dimmed">
          {sub}
        </Text>
      )}
      {children}
    </Stack>
  );
}
