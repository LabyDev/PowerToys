import { Box, Divider, Paper, Stack, Title } from "@mantine/core";

const Section = ({
  title,
  children,
  style,
  className,
}: {
  title: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) => (
  <Paper
    withBorder
    radius="md"
    p="sm"
    style={{ height: "100%", ...style }}
    className={className}
  >
    <Stack gap="xs" h="100%">
      <Title order={5}>{title}</Title>
      <Divider />
      <Box style={{ flex: 1, minHeight: 0 }}>{children}</Box>
    </Stack>
  </Paper>
);

export default Section;
