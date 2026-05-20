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
  buildActualVsExpected,
  buildCoverageOverTime,
  buildDayOfWeek,
  buildDiagnosticsTrend,
  buildHourOfDay,
  buildOpensAndCumulative,
  buildPathBreakdown,
  buildPickDistribution,
  buildRepeatIntervals,
  buildRollingEntropy,
  buildTopPicked,
  summariseDiagnostics,
} from "./stats/dataBuilders";
import {
  buildDiagnosticsCsv,
  buildHistoryCsv,
  buildScoresCsv,
} from "./stats/csvBuilders";
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
    let unlistenPick: (() => void) | null = null;
    listen("file-picked", () => fetchData()).then((fn) => {
      unlistenPick = fn;
    });
    return () => {
      unlistenPick?.();
    };
  }, []);

  const anonMap = useMemo(() => {
    const m = new Map<number, string>();
    scores.forEach((s, i) =>
      m.set(s.id, `File ${String(i + 1).padStart(3, "0")}`),
    );
    return m;
  }, [scores]);

  const displayName = (id: number, name: string) =>
    anonymise ? (anonMap.get(id) ?? "File ???") : name;

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
  const pickDistribution = buildPickDistribution(appState.files, pickCounts);
  const topPicked = buildTopPicked(appState.files, pickCounts, displayName);
  const pathBreakdown = buildPathBreakdown(
    appState.files,
    appState.paths,
    pickCounts,
    anonymise,
  );
  const peakHour = hourOfDay.reduce(
    (best, h) => (h.count > best.count ? h : best),
    hourOfDay[0],
  );
  const peakDay = dayOfWeek.reduce(
    (best, d) => (d.count > best.count ? d : best),
    dayOfWeek[0],
  );
  const coverageData = buildCoverageOverTime(appState.history, included.length);
  const repeatIntervals = buildRepeatIntervals(appState.history);
  const actualVsExpected = buildActualVsExpected(
    scores,
    pickCounts,
    totalPicks,
    totalIncludedWeight,
  );
  const rollingEntropy = buildRollingEntropy(appState.history);
  const diagSummary = summariseDiagnostics(appState.history);
  const diagTrend = buildDiagnosticsTrend(appState.history);

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
  const diagnosticsCount = appState.history.filter((h) => h.diagnostics).length;
  const exportDiagnostics = () =>
    randomiserApi.saveCsv(
      "diagnostics.csv",
      buildDiagnosticsCsv(appState.history, displayName),
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
            <Tooltip
              label={t(`${sw}.exportDiagnosticsTooltip`, {
                count: diagnosticsCount,
              })}
              withArrow
            >
              <Button
                size="xs"
                variant="light"
                onClick={exportDiagnostics}
                disabled={diagnosticsCount === 0}
              >
                {t(`${sw}.exportDiagnostics`)}
              </Button>
            </Tooltip>
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
          {diagSummary.count > 0 && (
            <>
              <StatCard
                label={t(`${sw}.cards.recencyHits`)}
                value={`${diagSummary.recencyHitPct.toFixed(1)}%`}
                sub={t(`${sw}.cards.recencyHitsSub`, {
                  count: diagSummary.count,
                })}
              />
              <StatCard
                label={t(`${sw}.cards.avgMemoryFactor`)}
                value={fmt(diagSummary.avgChosenMemoryFactor, 3)}
                sub={t(`${sw}.cards.avgMemoryFactorSub`)}
              />
              <StatCard
                label={t(`${sw}.cards.avgChosenRatio`)}
                value={fmt(diagSummary.avgChosenRatio, 3)}
                sub={t(`${sw}.cards.avgChosenRatioSub`)}
              />
              <StatCard
                label={t(`${sw}.cards.avgCandidates`)}
                value={fmt(diagSummary.avgCandidates, 1)}
                sub={t(`${sw}.cards.avgCandidatesSub`)}
              />
              <StatCard
                label={t(`${sw}.cards.bookmarkPickRate`)}
                value={`${diagSummary.bookmarkPickPct.toFixed(1)}%`}
                sub={t(`${sw}.cards.bookmarkPickRateSub`)}
              />
            </>
          )}
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
                  <Tooltip
                    label="Actual pick% minus weight-implied expected%. Files penalised by recency have a reduced expected%, so even one pick produces a large positive delta"
                    withArrow
                    multiline
                    w={280}
                  >
                    {col("deviation", t(`${sw}.table.delta`), true)}
                  </Tooltip>
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

        {/* ── DIAGNOSTIC CHARTS ──────────────────────────────────────────────── */}

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

        {/* Coverage efficiency */}
        {coverageData.length > 1 && (
          <Section
            title={t(`${sw}.coverage.title`)}
            sub={t(`${sw}.coverage.sub`)}
          >
            <ResponsiveContainer width="100%" height={CH + 20}>
              <ComposedChart
                data={coverageData}
                margin={{ top: 4, right: 8, left: -16, bottom: 16 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                <XAxis
                  dataKey="pickNumber"
                  tick={tick}
                  interval={Math.max(1, Math.floor(coverageData.length / 10))}
                  label={{
                    value: t(`${sw}.coverage.xLabel`),
                    position: "insideBottom",
                    offset: -4,
                    fill: "#909296",
                    fontSize: 10,
                  }}
                />
                <YAxis tick={tick} allowDecimals={false} />
                <RTooltip
                  contentStyle={ttStyle}
                  labelStyle={ttLabel}
                  itemStyle={ttItem}
                  cursor={ttCursor}
                />
                <Legend
                  verticalAlign="top"
                  wrapperStyle={{ fontSize: 11, color: "#909296" }}
                  iconType="circle"
                />
                <Line
                  type="monotone"
                  dataKey="uniqueFiles"
                  name={t(`${sw}.coverage.actual`)}
                  stroke="var(--mantine-color-teal-5)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="birthdayBaseline"
                  name={t(`${sw}.coverage.baseline`)}
                  stroke="#909296"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </Section>
        )}

        {/* Repeat gap distribution */}
        {totalPicks >= 20 && repeatIntervals.some((b) => b.count > 0) && (
          <Section
            title={t(`${sw}.repeatGap.title`)}
            sub={t(`${sw}.repeatGap.sub`)}
          >
            <ResponsiveContainer width="100%" height={CH}>
              <BarChart
                data={repeatIntervals}
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
                  formatter={(v) => [v, t(`${sw}.repeatGap.repeats`)]}
                />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {repeatIntervals.map((_, i) => (
                    <Cell key={i} fill={`hsl(${i * 22}, 65%, 50%)`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Section>
        )}

        {/* Actual vs expected deviation scatter */}
        {totalPicks > 0 && actualVsExpected.length > 1 && (
          <Section
            title={t(`${sw}.actualVsExpected.title`)}
            sub={t(`${sw}.actualVsExpected.sub`)}
          >
            <ResponsiveContainer width="100%" height={CH + 30}>
              <ScatterChart
                margin={{ top: 8, right: 24, left: 16, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                <XAxis
                  dataKey="expected"
                  name={t(`${sw}.actualVsExpected.expected`)}
                  type="number"
                  tick={tick}
                  label={{
                    value: t(`${sw}.actualVsExpected.xLabel`),
                    position: "insideBottom",
                    offset: -12,
                    fill: "#909296",
                    fontSize: 10,
                  }}
                />
                <YAxis
                  dataKey="actual"
                  name={t(`${sw}.actualVsExpected.actual`)}
                  type="number"
                  tick={tick}
                  label={{
                    value: t(`${sw}.actualVsExpected.yLabel`),
                    angle: -90,
                    position: "insideLeft",
                    offset: 8,
                    fill: "#909296",
                    fontSize: 10,
                  }}
                />
                <ZAxis range={[20, 20]} />
                <Legend
                  verticalAlign="top"
                  wrapperStyle={{ fontSize: 11, color: "#909296" }}
                  iconType="circle"
                />
                <ReferenceLine
                  segment={[
                    { x: 0, y: 0 },
                    {
                      x:
                        Math.max(...actualVsExpected.map((d) => d.expected)) *
                        1.1,
                      y:
                        Math.max(...actualVsExpected.map((d) => d.expected)) *
                        1.1,
                    },
                  ]}
                  stroke="#909296"
                  strokeDasharray="4 4"
                />
                <RTooltip
                  contentStyle={ttStyle}
                  labelStyle={ttLabel}
                  itemStyle={ttItem}
                  cursor={ttCursor}
                  formatter={(v, name) => [
                    `${(v as number).toFixed(3)}%`,
                    name,
                  ]}
                />
                <Scatter
                  data={actualVsExpected.filter((d) => !d.bookmarked)}
                  name={t(`${sw}.actualVsExpected.normal`)}
                  fill="var(--mantine-color-blue-5)"
                  fillOpacity={0.5}
                />
                <Scatter
                  data={actualVsExpected.filter((d) => d.bookmarked)}
                  name={t(`${sw}.actualVsExpected.bookmarked`)}
                  fill="var(--mantine-color-yellow-5)"
                  fillOpacity={0.8}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </Section>
        )}

        {/* Chosen weight vs distribution (from per-pick diagnostics) */}
        {diagTrend.length > 5 && (
          <Section
            title={t(`${sw}.chosenWeight.title`)}
            sub={t(`${sw}.chosenWeight.sub`)}
          >
            <ResponsiveContainer width="100%" height={CH + 10}>
              <ComposedChart
                data={diagTrend}
                margin={{ top: 4, right: 8, left: -16, bottom: 16 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                <XAxis
                  dataKey="pickNumber"
                  tick={tick}
                  interval={Math.max(1, Math.floor(diagTrend.length / 10))}
                  label={{
                    value: t(`${sw}.coverage.xLabel`),
                    position: "insideBottom",
                    offset: -4,
                    fill: "#909296",
                    fontSize: 10,
                  }}
                />
                <YAxis tick={tick} />
                <RTooltip
                  contentStyle={ttStyle}
                  labelStyle={ttLabel}
                  itemStyle={ttItem}
                  cursor={ttCursor}
                  formatter={(v) => [(v as number).toFixed(3), ""]}
                />
                <Legend
                  verticalAlign="top"
                  wrapperStyle={{ fontSize: 11, color: "#909296" }}
                  iconType="circle"
                />
                <Line
                  type="monotone"
                  dataKey="max"
                  name={t(`${sw}.chosenWeight.max`)}
                  stroke="#909296"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="mean"
                  name={t(`${sw}.chosenWeight.mean`)}
                  stroke="#74c0fc"
                  strokeWidth={1.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="chosen"
                  name={t(`${sw}.chosenWeight.chosen`)}
                  stroke="var(--mantine-color-orange-5)"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </Section>
        )}

        {/* Rolling diversity (entropy) */}
        {rollingEntropy.length > 0 && (
          <Section
            title={t(`${sw}.entropy.title`)}
            sub={t(`${sw}.entropy.sub`)}
          >
            <ResponsiveContainer width="100%" height={CH}>
              <ComposedChart
                data={rollingEntropy}
                margin={{ top: 4, right: 8, left: -16, bottom: 16 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                <XAxis
                  dataKey="pickNumber"
                  tick={tick}
                  interval={Math.max(1, Math.floor(rollingEntropy.length / 10))}
                  label={{
                    value: t(`${sw}.coverage.xLabel`),
                    position: "insideBottom",
                    offset: -4,
                    fill: "#909296",
                    fontSize: 10,
                  }}
                />
                <YAxis tick={tick} domain={[0, 1]} />
                <ReferenceLine
                  y={1}
                  stroke="#51cf66"
                  strokeDasharray="4 4"
                  label={{
                    value: t(`${sw}.entropy.maxLabel`),
                    fill: "#51cf66",
                    fontSize: 10,
                    position: "insideTopLeft",
                  }}
                />
                <RTooltip
                  contentStyle={ttStyle}
                  labelStyle={ttLabel}
                  itemStyle={ttItem}
                  cursor={ttCursor}
                  formatter={(v) => [
                    (v as number).toFixed(3),
                    t(`${sw}.entropy.diversity`),
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="entropy"
                  name={t(`${sw}.entropy.diversity`)}
                  stroke="var(--mantine-color-violet-5)"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </Section>
        )}

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
                margin={{ top: 4, right: 8, left: -16, bottom: 16 }}
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
                  verticalAlign="top"
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
