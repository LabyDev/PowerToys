import { AppStateData, FileScore } from "../../types/filerandomiser";
import { fmt } from "./utils";

export function buildOpensAndCumulative(history: AppStateData["history"]) {
  const counts: Record<string, number> = {};
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    counts[d.toISOString().slice(0, 10)] = 0;
  }
  for (const h of history) {
    const day = new Date(h.openedAt).toISOString().slice(0, 10);
    if (counts[day] !== undefined) counts[day]++;
  }
  let running = 0;
  return Object.entries(counts).map(([date, count]) => {
    running += count;
    return { date: date.slice(5), count, cumulative: running };
  });
}

export function addRollingAvg(
  data: ReturnType<typeof buildOpensAndCumulative>,
  w = 7,
) {
  return data.map((d, i) => {
    const slice = data.slice(Math.max(0, i - w + 1), i + 1);
    const avg = slice.reduce((s, x) => s + x.count, 0) / slice.length;
    return { ...d, rolling7d: parseFloat(avg.toFixed(1)) };
  });
}

export function buildHourOfDay(history: AppStateData["history"]) {
  const counts = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    label: `${String(i).padStart(2, "0")}:00`,
    count: 0,
  }));
  for (const h of history) {
    counts[new Date(h.openedAt).getHours()].count++;
  }
  return counts;
}

export function buildDayOfWeek(history: AppStateData["history"]) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const counts = days.map((d) => ({ day: d, count: 0 }));
  for (const h of history) {
    counts[new Date(h.openedAt).getDay()].count++;
  }
  return counts;
}

export function buildWeightHistogram(scores: FileScore[]) {
  const included = scores.filter((s) => !s.isExcluded);
  if (included.length < 2) return [];
  const weights = included.map((s) => s.totalWeight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  if (max === min) return [{ label: fmt(min, 2), count: included.length }];
  const B = 14;
  const step = (max - min) / B;
  const buckets = Array.from({ length: B }, (_, i) => ({
    label: fmt(min + i * step, 2),
    count: 0,
  }));
  for (const w of weights) {
    const idx = Math.min(Math.floor((w - min) / step), B - 1);
    buckets[idx].count++;
  }
  return buckets;
}

export function buildMemoryHistogram(scores: FileScore[]) {
  const included = scores.filter((s) => !s.isExcluded);
  if (!included.length) return [];
  const B = 10;
  const buckets = Array.from({ length: B }, (_, i) => ({
    label: fmt(i / B, 1),
    count: 0,
  }));
  for (const s of included) {
    const idx = Math.min(Math.floor(s.memoryFactor * B), B - 1);
    buckets[idx].count++;
  }
  return buckets;
}

export function buildPickDistribution(
  files: AppStateData["files"],
  pickCounts: Record<string, number>,
) {
  const counts = files.map((f) => pickCounts[String(f.id)] ?? 0);
  if (!counts.length) return [];
  const max = Math.max(...counts);
  if (max === 0) return [{ label: "0", count: counts.length }];
  const B = Math.min(10, max + 1);
  const buckets = Array.from({ length: B }, (_, i) => {
    const lo = Math.round((i / B) * max);
    const hi = Math.round(((i + 1) / B) * max);
    return { label: i === B - 1 ? `${lo}+` : `${lo}–${hi}`, count: 0 };
  });
  for (const c of counts) {
    const idx = Math.min(Math.floor((c / (max + 1)) * B), B - 1);
    buckets[idx].count++;
  }
  return buckets;
}

export function buildTopPicked(
  files: AppStateData["files"],
  pickCounts: Record<string, number>,
  displayName: (id: number, name: string) => string,
  n = 15,
) {
  return files
    .map((f) => ({
      id: f.id,
      name: displayName(f.id, f.name),
      count: pickCounts[String(f.id)] ?? 0,
    }))
    .filter((f) => f.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

export function buildPathBreakdown(
  files: AppStateData["files"],
  paths: AppStateData["paths"],
  pickCounts: Record<string, number>,
  anonymise = false,
) {
  return paths
    .map((p, i) => {
      const rootStr =
        typeof p.path === "string" ? p.path : ((p.path as any)?.Path ?? "");
      const matching = files.filter((f) => {
        const fp =
          typeof f.path === "string" ? f.path : ((f.path as any)?.Path ?? "");
        return String(fp).startsWith(rootStr);
      });
      const picks = matching.reduce(
        (s, f) => s + (pickCounts[String(f.id)] ?? 0),
        0,
      );
      const realLabel =
        p.name ||
        String(rootStr).split(/[\\/]/).filter(Boolean).pop() ||
        rootStr;
      const label = anonymise
        ? `Folder ${String(i + 1).padStart(3, "0")}`
        : realLabel;
      return { name: label, files: matching.length, picks };
    })
    .filter((p) => p.files > 0);
}

export function buildScatterData(scores: FileScore[]) {
  return scores
    .filter((s) => !s.isExcluded)
    .map((s) => ({
      x: parseFloat(fmt(s.memoryFactor, 3)),
      y: parseFloat(fmt(s.totalWeight, 3)),
      z: s.bookmarkFactor > 1 ? 2 : 1,
    }));
}

export function buildCoverageOverTime(
  history: AppStateData["history"],
  totalFiles: number,
) {
  if (!history.length || !totalFiles) return [];
  const sorted = [...history].sort(
    (a, b) => new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime(),
  );
  const seen = new Set<number>();
  return sorted.map((h, i) => {
    seen.add(h.id);
    const n = i + 1;
    const baseline =
      totalFiles * (1 - Math.pow((totalFiles - 1) / totalFiles, n));
    return {
      pickNumber: n,
      uniqueFiles: seen.size,
      birthdayBaseline: Math.round(baseline),
    };
  });
}

export function buildRepeatIntervals(history: AppStateData["history"]) {
  const sorted = [...history].sort(
    (a, b) => new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime(),
  );
  const lastSeenAt = new Map<number, number>(); // id → pick index
  const gaps: number[] = [];
  sorted.forEach((h, i) => {
    if (lastSeenAt.has(h.id)) {
      gaps.push(i - lastSeenAt.get(h.id)!);
    }
    lastSeenAt.set(h.id, i);
  });
  if (!gaps.length) return [];
  const buckets = [
    { label: "<5", min: 0, max: 5, count: 0 },
    { label: "5–15", min: 5, max: 15, count: 0 },
    { label: "15–30", min: 15, max: 30, count: 0 },
    { label: "30–60", min: 30, max: 60, count: 0 },
    { label: "60–100", min: 60, max: 100, count: 0 },
    { label: "100+", min: 100, max: Infinity, count: 0 },
  ];
  for (const g of gaps) {
    const b = buckets.find((b) => g >= b.min && g < b.max);
    if (b) b.count++;
  }
  return buckets;
}

export function buildActualVsExpected(
  scores: FileScore[],
  pickCounts: Record<string, number>,
  totalPicks: number,
  totalIncludedWeight: number,
) {
  if (totalPicks === 0 || totalIncludedWeight === 0) return [];
  return scores
    .filter((s) => !s.isExcluded)
    .map((s) => ({
      expected: parseFloat(
        ((s.totalWeight / totalIncludedWeight) * 100).toFixed(3),
      ),
      actual: parseFloat(
        (((pickCounts[String(s.id)] ?? 0) / totalPicks) * 100).toFixed(3),
      ),
      bookmarked: s.bookmarkFactor > 1,
      name: s.name,
    }));
}

export function buildDiagnosticsTrend(history: AppStateData["history"]) {
  const sorted = [...history].sort(
    (a, b) => new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime(),
  );
  const out: {
    pickNumber: number;
    chosen: number;
    mean: number;
    max: number;
    ratio: number;
  }[] = [];
  sorted.forEach((h, i) => {
    const d = h.diagnostics;
    if (!d || d.weightMax <= 0) return;
    out.push({
      pickNumber: i + 1,
      chosen: d.chosenWeight,
      mean: d.weightMean,
      max: d.weightMax,
      ratio: d.chosenWeight / d.weightMax,
    });
  });
  return out;
}

export function summariseDiagnostics(history: AppStateData["history"]) {
  const withDiag = history.filter((h) => h.diagnostics);
  if (!withDiag.length) {
    return {
      count: 0,
      avgChosenMemoryFactor: 0,
      recencyHitPct: 0,
      avgChosenRatio: 0,
      avgCandidates: 0,
      bookmarkPickPct: 0,
    };
  }
  let memSum = 0;
  let recencyHits = 0;
  let ratioSum = 0;
  let ratioN = 0;
  let candSum = 0;
  let bookmarkPicks = 0;
  for (const h of withDiag) {
    const d = h.diagnostics!;
    memSum += d.chosenMemoryFactor;
    if (d.chosenMemoryFactor < 0.9) recencyHits++;
    if (d.weightMax > 0) {
      ratioSum += d.chosenWeight / d.weightMax;
      ratioN++;
    }
    candSum += d.candidates;
    if (d.chosenBookmarkColor !== null && d.chosenBookmarkColor !== "")
      bookmarkPicks++;
  }
  return {
    count: withDiag.length,
    avgChosenMemoryFactor: memSum / withDiag.length,
    recencyHitPct: (recencyHits / withDiag.length) * 100,
    avgChosenRatio: ratioN ? ratioSum / ratioN : 0,
    avgCandidates: candSum / withDiag.length,
    bookmarkPickPct: (bookmarkPicks / withDiag.length) * 100,
  };
}
