import { Box, Text, Tooltip } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { AppStateData } from "../../types/filerandomiser";

const CELL = 11;
const GAP = 2;

export function ActivityHeatmap({
  history,
}: {
  history: AppStateData["history"];
}) {
  const { t, i18n } = useTranslation();

  const counts: Record<string, number> = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 363; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    counts[d.toISOString().slice(0, 10)] = 0;
  }
  for (const h of history) {
    const day = new Date(h.openedAt).toISOString().slice(0, 10);
    if (day in counts) counts[day]++;
  }

  const days = Object.entries(counts).map(([date, count]) => ({ date, count }));
  const startDow = new Date(days[0].date).getDay();

  const padded: ({ date: string; count: number } | null)[] = [
    ...Array(startDow).fill(null),
    ...days,
  ];
  while (padded.length % 7 !== 0) padded.push(null);

  const totalWeeks = padded.length / 7;
  const weeks: ({ date: string; count: number } | null)[][] = [];
  for (let w = 0; w < totalWeeks; w++) {
    weeks.push(padded.slice(w * 7, (w + 1) * 7));
  }

  const maxCount = Math.max(...days.map((d) => d.count), 1);

  const monthLabel = (idx: number) =>
    new Date(2000, idx, 1).toLocaleString(i18n.language, { month: "short" });

  const monthLabels: { label: string; weekIdx: number }[] = [];
  let lastMonth = -1;
  weeks.forEach((week, wi) => {
    const first = week.find((d) => d !== null);
    if (first) {
      const m = new Date(first.date).getMonth();
      if (m !== lastMonth) {
        monthLabels.push({ label: monthLabel(m), weekIdx: wi });
        lastMonth = m;
      }
    }
  });

  return (
    <Box style={{ overflowX: "auto" }}>
      <Box style={{ display: "flex", marginBottom: 3, height: 14 }}>
        {weeks.map((_, wi) => {
          const ml = monthLabels.find((m) => m.weekIdx === wi);
          return (
            <Box key={wi} style={{ width: CELL + GAP, flexShrink: 0 }}>
              {ml && (
                <Text size="10px" c="dimmed" style={{ whiteSpace: "nowrap" }}>
                  {ml.label}
                </Text>
              )}
            </Box>
          );
        })}
      </Box>
      <Box style={{ display: "flex", gap: GAP }}>
        {weeks.map((week, wi) => (
          <Box
            key={wi}
            style={{ display: "flex", flexDirection: "column", gap: GAP }}
          >
            {week.map((cell, di) => {
              if (!cell)
                return <Box key={di} style={{ width: CELL, height: CELL }} />;
              const intensity =
                cell.count === 0 ? 0 : Math.max(0.15, cell.count / maxCount);
              const bg =
                cell.count === 0
                  ? "#2c2e33"
                  : `hsl(215, 70%, ${Math.round(20 + intensity * 45)}%)`;
              return (
                <Tooltip
                  key={di}
                  label={t("fileRandomiser.statsWindow.heatmap.pickTooltip", {
                    date: cell.date,
                    count: cell.count,
                  })}
                  withArrow
                  styles={{ tooltip: { fontSize: 11 } }}
                >
                  <Box
                    style={{
                      width: CELL,
                      height: CELL,
                      borderRadius: 2,
                      background: bg,
                    }}
                  />
                </Tooltip>
              );
            })}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
