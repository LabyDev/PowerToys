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
) {
  return paths
    .map((p) => {
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
      const label =
        p.name ||
        String(rootStr).split(/[\\/]/).filter(Boolean).pop() ||
        rootStr;
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
