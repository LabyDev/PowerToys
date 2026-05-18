import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Loader,
  ScrollArea,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { EyeIcon, EyeSlashIcon } from "@phosphor-icons/react";
import * as randomiserApi from "../core/api/fileRandomiserApi";
import { AppStateData, FileScore } from "../types/filerandomiser";
import {
  CH,
  fmt,
  grid,
  relTime,
  SortKey,
  tick,
  ttCursor,
  ttItem,
  ttLabel,
  ttStyle,
} from "./stats/utils";
import {
  addRollingAvg,
  buildDayOfWeek,
  buildHourOfDay,
  buildMemoryHistogram,
  buildOpensAndCumulative,
  buildPathBreakdown,
  buildPickDistribution,
  buildScatterData,
  buildTopPicked,
  buildWeightHistogram,
} from "./stats/dataBuilders";
import { buildHistoryCsv, buildScoresCsv } from "./stats/csvBuilders";
import { ActivityHeatmap } from "./stats/ActivityHeatmap";
import { StatCard } from "./stats/StatCard";
import { Section } from "./stats/Section";

const StatsWindow = () => {
  const { t } = useTranslation();
  const [appState, setAppState] = useState<AppStateData | null>(null);
  const [scores, setScores] = useState<FileScore[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("totalWeight");
  const [sortAsc, setSortAsc] = useState(false);
  const [anonymise, setAnonymise] = useState(false);

  const fetchData = async () => {
    const [state, fileScores] = await Promise.all([
      randomiserApi.getAppState(),
      randomiserApi.getFileScores(),
    ]);
    setAppState(state);
    setScores(fileScores);
    setLastUpdated(new Date());
  };

  useEffect(() => {
    fetchData();
    let unlisten: (() => void) | null = null;
    listen("file-picked", () => fetchData()).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, []);

  const anonMap = useMemo(() => {
    const m = new Map<number, string>();
    scores.forEach((s, i) =>
      m.set(s.id, `File ${String(i + 1).padStart(3, "0")}`),
    );
    return m;
  }, [scores]);

  const displayName = (id: number, name: string) =>
    anonymise ? (anonMap.get(id) ?? name) : name;

  const pickCounts = useMemo(
    () => appState?.pickCounts ?? {},
    [appState?.pickCounts],
  );

  const lastPickedMap = useMemo(() => {
    const m = new Map<number, Date>();
    for (const h of appState?.history ?? []) {
      const d = new Date(h.openedAt);
      if (!m.has(h.id) || d > m.get(h.id)!) m.set(h.id, d);
    }
    return m;
  }, [appState?.history]);

  const derivedStats = useMemo(() => {
    const inc = scores.filter((s) => !s.isExcluded);
    return {
      totalIncludedWeight: inc.reduce((s, f) => s + f.totalWeight, 0),
      totalPicks: Object.values(pickCounts).reduce((a, b) => a + b, 0),
      uniquePicked: Object.values(pickCounts).filter((c) => c > 0).length,
    };
  }, [scores, pickCounts]);

  const sortedScores = useMemo(() => {
    const { totalIncludedWeight, totalPicks } = derivedStats;
    return [...scores].sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      if (sortKey === "pickCount") {
        av = pickCounts[String(a.id)] ?? 0;
        bv = pickCounts[String(b.id)] ?? 0;
      } else if (sortKey === "lastPicked") {
        av = lastPickedMap.get(a.id)?.getTime() ?? 0;
        bv = lastPickedMap.get(b.id)?.getTime() ?? 0;
      } else if (sortKey === "deviation") {
        const calc = (s: FileScore) => {
          const picks = pickCounts[String(s.id)] ?? 0;
          const exp =
            totalIncludedWeight > 0
              ? (s.totalWeight / totalIncludedWeight) * 100
              : 0;
          const act = totalPicks > 0 ? (picks / totalPicks) * 100 : 0;
          return act - exp;
        };
        av = calc(a);
        bv = calc(b);
      } else {
        av = a[sortKey as keyof FileScore] as number | string;
        bv = b[sortKey as keyof FileScore] as number | string;
      }
      const cmp =
        typeof av === "string"
          ? av.localeCompare(bv as string)
          : (av as number) - (bv as number);
      return sortAsc ? cmp : -cmp;
    });
  }, [scores, sortKey, sortAsc, pickCounts, lastPickedMap, derivedStats]);

  if (!appState) {
    return (
      <Box
        p="xl"
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <Loader type="dots" />
      </Box>
    );
  }

  // ── Derived stats ────────────────────────────────────────────────────────────

  const { totalIncludedWeight, totalPicks, uniquePicked } = derivedStats;
  const included = scores.filter((s) => !s.isExcluded);
  const neverPicked = included.filter(
    (s) => (pickCounts[String(s.id)] ?? 0) === 0,
  ).length;
  const avgWeight = included.length
    ? included.reduce((s, f) => s + f.totalWeight, 0) / included.length
    : 0;
  const maxWeight = included.length
    ? Math.max(...included.map((s) => s.totalWeight))
    : 0;
  const minWeight = included.length
    ? Math.min(...included.map((s) => s.totalWeight))
    : 0;

  const gini = (() => {
    if (!included.length) return 0;
    const ws = included.map((s) => s.totalWeight).sort((a, b) => a - b);
    const n = ws.length;
    const sum = ws.reduce((a, b) => a + b, 0);
    if (sum === 0) return 0;
    const num = ws.reduce((acc, w, i) => acc + (2 * (i + 1) - n - 1) * w, 0);
    return num / (n * sum);
  })();

  const shannonEntropy = (() => {
    if (totalPicks === 0 || uniquePicked < 2) return 0;
    let H = 0;
    for (const c of Object.values(pickCounts)) {
      if (c > 0) {
        const p = c / totalPicks;
        H -= p * Math.log2(p);
      }
    }
    return H / Math.log2(uniquePicked);
  })();

  const uniqueDays = new Set(
    appState.history.map((h) =>
      new Date(h.openedAt).toISOString().slice(0, 10),
    ),
  );
  const daysActive = uniqueDays.size;
  const firstActivity = appState.history.length
    ? new Date(
        Math.min(
          ...appState.history.map((h) => new Date(h.openedAt).getTime()),
        ),
      )
    : null;

  // ── Chart data ───────────────────────────────────────────────────────────────

  const opensWithRolling = addRollingAvg(
    buildOpensAndCumulative(appState.history),
  );
  const hourOfDay = buildHourOfDay(appState.history);
  const dayOfWeek = buildDayOfWeek(appState.history);
  const weightHistogram = buildWeightHistogram(scores);
  const memoryHistogram = buildMemoryHistogram(scores);
  const pickDistribution = buildPickDistribution(appState.files, pickCounts);
  const topPicked = buildTopPicked(appState.files, pickCounts, displayName);
  const pathBreakdown = buildPathBreakdown(
    appState.files,
    appState.paths,
    pickCounts,
  );
  const scatterData = buildScatterData(scores);
  const peakHour = hourOfDay.reduce(
    (best, h) => (h.count > best.count ? h : best),
    hourOfDay[0],
  );
  const peakDay = dayOfWeek.reduce(
    (best, d) => (d.count > best.count ? d : best),
    dayOfWeek[0],
  );

  // ── Table helpers ─────────────────────────────────────────────────────────────

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(key === "name");
    }
  };

  const col = (key: SortKey, label: string, right = false) => (
    <Table.Th
      onClick={() => handleSort(key)}
      style={{
        cursor: "pointer",
        userSelect: "none",
        whiteSpace: "nowrap",
        textAlign: right ? "right" : undefined,
      }}
    >
      {label} {sortKey === key ? (sortAsc ? "▲" : "▼") : ""}
    </Table.Th>
  );

  // ── Exports ───────────────────────────────────────────────────────────────────

  const exportScores = () =>
    randomiserApi.saveCsv(
      "scores.csv",
      buildScoresCsv(
        scores,
        pickCounts,
        displayName,
        lastPickedMap,
        totalIncludedWeight,
        totalPicks,
      ),
    );
  const exportHistory = () =>
    randomiserApi.saveCsv(
      "history.csv",
      buildHistoryCsv(appState.history, displayName),
    );

  const sw = "fileRandomiser.statsWindow";

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <Box p="md" style={{ height: "100vh", overflowY: "auto" }}>
      <style>{`.recharts-wrapper:focus,.recharts-surface:focus{outline:none}`}</style>
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between" align="flex-end">
          <Stack gap={2}>
            <Title order={3}>{t(`${sw}.title`)}</Title>
            {lastUpdated && (
              <Text size="xs" c="dimmed">
                {t(`${sw}.subtitle`, {
                  time: lastUpdated.toLocaleTimeString(),
                })}
              </Text>
            )}
          </Stack>
          <Group gap="xs">
            <Tooltip
              label={anonymise ? t(`${sw}.deanonymise`) : t(`${sw}.anonymise`)}
              withArrow
            >
              <ActionIcon
                variant={anonymise ? "filled" : "subtle"}
                color={anonymise ? "violet" : undefined}
                onClick={() => setAnonymise((v) => !v)}
              >
                {anonymise ? <EyeSlashIcon size={16} /> : <EyeIcon size={16} />}
              </ActionIcon>
            </Tooltip>
            <Button size="xs" variant="light" onClick={exportScores}>
              {t(`${sw}.exportScores`)}
            </Button>
            <Button size="xs" variant="light" onClick={exportHistory}>
              {t(`${sw}.exportHistory`)}
            </Button>
          </Group>
        </Group>

        {/* ── ANALYTICAL ─────────────────────────────────────────────────────── */}

        <SimpleGrid cols={4}>
          <StatCard
            label={t(`${sw}.cards.totalFiles`)}
            value={appState.files.length}
            sub={t(`${sw}.cards.nExcluded`, {
              count: appState.files.length - included.length,
            })}
          />
          <StatCard label={t(`${sw}.cards.included`)} value={included.length} />
          <StatCard label={t(`${sw}.cards.totalPicks`)} value={totalPicks} />
          <StatCard
            label={t(`${sw}.cards.coverage`)}
            value={
              included.length
                ? `${((uniquePicked / included.length) * 100).toFixed(1)}%`
                : "—"
            }
            sub={t(`${sw}.cards.nNeverPicked`, { count: neverPicked })}
          />
          <StatCard
            label={t(`${sw}.cards.weightSpread`)}
            value={`${fmt(minWeight, 2)}–${fmt(maxWeight, 2)}`}
            sub={t(`${sw}.cards.weightAvg`, { value: fmt(avgWeight, 2) })}
          />
          <StatCard
            label={t(`${sw}.cards.gini`)}
            value={fmt(gini, 3)}
            sub={t(`${sw}.cards.giniSub`)}
          />
          <StatCard
            label={t(`${sw}.cards.entropy`)}
            value={fmt(shannonEntropy, 3)}
            sub={t(`${sw}.cards.entropySub`)}
          />
          <StatCard
            label={t(`${sw}.cards.daysActive`)}
            value={daysActive}
            sub={
              firstActivity
                ? t(`${sw}.cards.firstActivity`, {
                    date: firstActivity.toLocaleDateString(),
                  })
                : undefined
            }
          />
        </SimpleGrid>

        {/* Scores table */}
        <Section
          title={t(`${sw}.table.title`, { count: scores.length })}
          sub={t(`${sw}.table.sub`)}
        >
          <ScrollArea style={{ height: "42vh" }} type="auto" offsetScrollbars>
            <Table
              striped
              highlightOnHover
              withTableBorder
              withColumnBorders
              style={{ fontSize: 13 }}
            >
              <Table.Thead
                style={{
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                  background: "var(--mantine-color-body)",
                }}
              >
                <Table.Tr>
                  {col("name", t(`${sw}.table.name`))}
                  {col("orderScore", t(`${sw}.table.order`), true)}
                  {col("memoryFactor", t(`${sw}.table.memory`), true)}
                  {col("bookmarkFactor", t(`${sw}.table.bookmark`), true)}
                  {col("totalWeight", t(`${sw}.table.weight`), true)}
                  {col("pickCount", t(`${sw}.table.picks`), true)}
                  {col("deviation", t(`${sw}.table.delta`), true)}
                  {col("lastPicked", t(`${sw}.table.lastSeen`), true)}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {sortedScores.map((s) => {
                  const picks = pickCounts[String(s.id)] ?? 0;
                  const expectedPct =
                    totalIncludedWeight > 0
                      ? (s.totalWeight / totalIncludedWeight) * 100
                      : 0;
                  const actualPct =
                    totalPicks > 0 ? (picks / totalPicks) * 100 : 0;
                  const delta = totalPicks > 0 ? actualPct - expectedPct : null;
                  const lastSeen = lastPickedMap.get(s.id);
                  return (
                    <Table.Tr
                      key={s.id}
                      style={{ opacity: s.isExcluded ? 0.38 : 1 }}
                    >
                      <Table.Td
                        style={{
                          maxWidth: 260,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          textDecoration: s.isExcluded
                            ? "line-through"
                            : undefined,
                        }}
                      >
                        {displayName(s.id, s.name)}
                        {s.isExcluded && (
                          <Badge size="xs" color="red" ml={6}>
                            {t(`${sw}.table.excludedBadge`)}
                          </Badge>
                        )}
                      </Table.Td>
                      <Table.Td ta="right">{fmt(s.orderScore)}</Table.Td>
                      <Table.Td ta="right">{fmt(s.memoryFactor)}</Table.Td>
                      <Table.Td ta="right">{fmt(s.bookmarkFactor)}</Table.Td>
                      <Table.Td ta="right" fw={600}>
                        {fmt(s.totalWeight)}
                      </Table.Td>
                      <Table.Td ta="right">{picks}</Table.Td>
                      <Table.Td
                        ta="right"
                        c={
                          delta === null
                            ? "dimmed"
                            : delta > 0.5
                              ? "green"
                              : delta < -0.5
                                ? "red"
                                : "dimmed"
                        }
                      >
                        {delta === null
                          ? "—"
                          : `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%`}
                      </Table.Td>
                      <Table.Td ta="right" c="dimmed">
                        {relTime(lastSeen, t)}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Section>

        {/* Weight distribution */}
        {weightHistogram.length > 1 && (
          <Section
            title={t(`${sw}.weightDist.title`)}
            sub={t(`${sw}.weightDist.sub`)}
          >
            <ResponsiveContainer width="100%" height={CH}>
              <BarChart
                data={weightHistogram}
                margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                <XAxis dataKey="label" tick={tick} interval={1} />
                <YAxis tick={tick} allowDecimals={false} />
                <RTooltip
                  contentStyle={ttStyle}
                  labelStyle={ttLabel}
                  itemStyle={ttItem}
                  cursor={ttCursor}
                  formatter={(v) => [
                    t(`${sw}.weightDist.files`, { count: v as number }),
                    "",
                  ]}
                />
                <ReferenceLine
                  x={fmt(avgWeight, 2)}
                  stroke="#ffd43b"
                  strokeDasharray="4 4"
                  label={{
                    value: t(`${sw}.weightDist.avg`),
                    fill: "#ffd43b",
                    fontSize: 10,
                    position: "top",
                  }}
                />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {weightHistogram.map((_, i) => (
                    <Cell
                      key={i}
                      fill={`hsl(${200 + i * 10}, 65%, ${58 - i * 1.5}%)`}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Section>
        )}

        {/* Memory factor distribution */}
        {memoryHistogram.length > 0 && (
          <Section
            title={t(`${sw}.memoryDist.title`)}
            sub={t(`${sw}.memoryDist.sub`)}
          >
            <ResponsiveContainer width="100%" height={CH}>
              <BarChart
                data={memoryHistogram}
                margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                <XAxis dataKey="label" tick={tick} />
                <YAxis tick={tick} allowDecimals={false} />
                <RTooltip
                  contentStyle={ttStyle}
                  labelStyle={ttLabel}
                  itemStyle={ttItem}
                  cursor={ttCursor}
                  formatter={(v) => [
                    t(`${sw}.memoryDist.files`, { count: v as number }),
                    "",
                  ]}
                />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {memoryHistogram.map((_, i) => (
                    <Cell
                      key={i}
                      fill={`hsl(${140 + i * 8}, 60%, ${45 + i * 3}%)`}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Section>
        )}

        {/* Memory vs weight scatter */}
        {scatterData.length > 1 && (
          <Section
            title={t(`${sw}.scatter.title`)}
            sub={t(`${sw}.scatter.sub`)}
          >
            <ResponsiveContainer width="100%" height={CH + 30}>
              <ScatterChart
                margin={{ top: 8, right: 24, left: -8, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                <XAxis
                  dataKey="x"
                  name="Memory"
                  type="number"
                  domain={[0, 1]}
                  tick={tick}
                  label={{
                    value: t(`${sw}.scatter.xLabel`),
                    position: "insideBottom",
                    offset: -12,
                    fill: "#909296",
                    fontSize: 10,
                  }}
                />
                <YAxis
                  dataKey="y"
                  name="Weight"
                  type="number"
                  tick={tick}
                  label={{
                    value: t(`${sw}.scatter.yLabel`),
                    angle: -90,
                    position: "insideLeft",
                    fill: "#909296",
                    fontSize: 10,
                  }}
                />
                <ZAxis dataKey="z" range={[20, 60]} />
                <RTooltip
                  contentStyle={ttStyle}
                  labelStyle={ttLabel}
                  itemStyle={ttItem}
                  cursor={ttCursor}
                  formatter={(v, name) => [
                    fmt(v as number, 3),
                    name === "x"
                      ? t(`${sw}.scatter.memoryLabel`)
                      : t(`${sw}.scatter.weightLabel`),
                  ]}
                />
                <Scatter
                  data={scatterData}
                  fill="var(--mantine-color-blue-5)"
                  fillOpacity={0.6}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </Section>
        )}

        {/* ── USAGE / FUN ────────────────────────────────────────────────────── */}

        {/* Opens per day */}
        <Section
          title={t(`${sw}.opensPerDay.title`)}
          sub={t(`${sw}.opensPerDay.sub`)}
        >
          <ResponsiveContainer width="100%" height={CH + 20}>
            <ComposedChart
              data={opensWithRolling}
              margin={{ top: 4, right: 40, left: -16, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={grid} />
              <XAxis dataKey="date" tick={tick} interval={4} />
              <YAxis yAxisId="left" tick={tick} allowDecimals={false} />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={tick}
                allowDecimals={false}
              />
              <RTooltip
                contentStyle={ttStyle}
                labelStyle={ttLabel}
                itemStyle={ttItem}
                cursor={ttCursor}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, color: "#909296" }}
                iconType="circle"
              />
              <Bar
                yAxisId="left"
                dataKey="count"
                name={t(`${sw}.opensPerDay.opens`)}
                fill="var(--mantine-color-blue-5)"
                fillOpacity={0.7}
                radius={[3, 3, 0, 0]}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="cumulative"
                name={t(`${sw}.opensPerDay.cumulative`)}
                stroke="#f59f00"
                strokeWidth={2}
                dot={false}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="rolling7d"
                name={t(`${sw}.opensPerDay.rollingAvg`)}
                stroke="#74c0fc"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </Section>

        {/* Activity heatmap */}
        <Section title={t(`${sw}.heatmap.title`)} sub={t(`${sw}.heatmap.sub`)}>
          <ActivityHeatmap history={appState.history} />
        </Section>

        {/* Hour of day + Day of week */}
        {totalPicks > 0 && (
          <SimpleGrid cols={2}>
            <Section
              title={t(`${sw}.hourOfDay.title`)}
              sub={t(`${sw}.hourOfDay.peakSub`, {
                label: peakHour.label,
                count: peakHour.count,
              })}
            >
              <ResponsiveContainer width="100%" height={CH}>
                <BarChart
                  data={hourOfDay}
                  margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                  <XAxis dataKey="label" tick={tick} interval={2} />
                  <YAxis tick={tick} allowDecimals={false} />
                  <RTooltip
                    contentStyle={ttStyle}
                    labelStyle={ttLabel}
                    itemStyle={ttItem}
                    cursor={ttCursor}
                    formatter={(v) => [v, t(`${sw}.opensPerDay.opens`)]}
                  />
                  <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                    {hourOfDay.map((h, i) => (
                      <Cell
                        key={i}
                        fill={`hsl(260, 65%, ${35 + (h.count / (peakHour.count || 1)) * 30}%)`}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Section>
            <Section
              title={t(`${sw}.dayOfWeek.title`)}
              sub={t(`${sw}.dayOfWeek.peakSub`, {
                day: peakDay.day,
                count: peakDay.count,
              })}
            >
              <ResponsiveContainer width="100%" height={CH}>
                <BarChart
                  data={dayOfWeek}
                  margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                  <XAxis dataKey="day" tick={tick} />
                  <YAxis tick={tick} allowDecimals={false} />
                  <RTooltip
                    contentStyle={ttStyle}
                    labelStyle={ttLabel}
                    itemStyle={ttItem}
                    cursor={ttCursor}
                    formatter={(v) => [v, t(`${sw}.opensPerDay.opens`)]}
                  />
                  <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                    {dayOfWeek.map((d, i) => (
                      <Cell
                        key={i}
                        fill={`hsl(${170 + i * 10}, 55%, ${40 + (d.count / (peakDay.count || 1)) * 25}%)`}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Section>
          </SimpleGrid>
        )}

        {/* Top picked files */}
        {topPicked.length > 0 && (
          <Section
            title={t(`${sw}.topPicked.title`, { count: topPicked.length })}
          >
            <ResponsiveContainer
              width="100%"
              height={Math.max(CH, topPicked.length * 26)}
            >
              <BarChart
                data={topPicked}
                layout="vertical"
                margin={{ top: 4, right: 40, left: 8, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={grid}
                  horizontal={false}
                />
                <XAxis type="number" tick={tick} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={190}
                  tick={{ fontSize: 11, fill: "#c1c2c5" }}
                  tickFormatter={(v: string) =>
                    v.length > 28 ? v.slice(0, 27) + "…" : v
                  }
                />
                <RTooltip
                  contentStyle={ttStyle}
                  labelStyle={ttLabel}
                  itemStyle={ttItem}
                  cursor={ttCursor}
                  formatter={(v) => [v, t(`${sw}.topPicked.picks`)]}
                />
                <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                  {topPicked.map((_, i) => (
                    <Cell
                      key={i}
                      fill={`hsl(${215 + i * 6}, 70%, ${58 - i * 1.5}%)`}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Section>
        )}

        {/* Pick count distribution */}
        {pickDistribution.length > 0 && (
          <Section
            title={t(`${sw}.pickDist.title`)}
            sub={t(`${sw}.pickDist.sub`)}
          >
            <ResponsiveContainer width="100%" height={CH}>
              <BarChart
                data={pickDistribution}
                margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                <XAxis dataKey="label" tick={tick} />
                <YAxis tick={tick} allowDecimals={false} />
                <RTooltip
                  contentStyle={ttStyle}
                  labelStyle={ttLabel}
                  itemStyle={ttItem}
                  cursor={ttCursor}
                  formatter={(v) => [
                    t(`${sw}.pickDist.files`, { count: v as number }),
                    t(`${sw}.pickDist.filesInRange`),
                  ]}
                />
                <Bar
                  dataKey="count"
                  fill="var(--mantine-color-teal-5)"
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </Section>
        )}

        {/* Per-path breakdown */}
        {pathBreakdown.length > 1 && (
          <Section
            title={t(`${sw}.pathBreakdown.title`)}
            sub={t(`${sw}.pathBreakdown.sub`)}
          >
            <ResponsiveContainer width="100%" height={CH}>
              <BarChart
                data={pathBreakdown}
                margin={{ top: 4, right: 8, left: -16, bottom: 24 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                <XAxis
                  dataKey="name"
                  tick={tick}
                  tickFormatter={(v: string) =>
                    v.length > 18 ? v.slice(0, 17) + "…" : v
                  }
                />
                <YAxis tick={tick} allowDecimals={false} />
                <RTooltip
                  contentStyle={ttStyle}
                  labelStyle={ttLabel}
                  itemStyle={ttItem}
                  cursor={ttCursor}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, color: "#909296" }}
                  iconType="circle"
                />
                <Bar
                  dataKey="files"
                  name={t(`${sw}.pathBreakdown.files`)}
                  fill="var(--mantine-color-blue-5)"
                  radius={[3, 3, 0, 0]}
                />
                <Bar
                  dataKey="picks"
                  name={t(`${sw}.pathBreakdown.picks`)}
                  fill="var(--mantine-color-violet-5)"
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </Section>
        )}
      </Stack>
    </Box>
  );
};

export default StatsWindow;
