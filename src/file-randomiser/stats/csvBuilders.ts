import { AppStateData, FileScore } from "../../types/filerandomiser";

function esc(v: unknown) {
  return `"${String(v).replace(/"/g, '""')}"`;
}

export function buildScoresCsv(
  scores: FileScore[],
  pickCounts: Record<string, number>,
  displayName: (id: number, name: string) => string,
  lastPickedMap: Map<number, Date>,
  totalIncludedWeight: number,
  totalPicks: number,
) {
  const header =
    "name,isExcluded,orderScore,memoryFactor,bookmarkFactor,totalWeight,picks,delta%,lastSeen";
  const rows = scores.map((s) => {
    const picks = pickCounts[String(s.id)] ?? 0;
    const expectedPct =
      totalIncludedWeight > 0 ? (s.totalWeight / totalIncludedWeight) * 100 : 0;
    const actualPct = totalPicks > 0 ? (picks / totalPicks) * 100 : 0;
    const last = lastPickedMap.get(s.id);
    return [
      displayName(s.id, s.name),
      s.isExcluded,
      s.orderScore,
      s.memoryFactor,
      s.bookmarkFactor,
      s.totalWeight,
      picks,
      (actualPct - expectedPct).toFixed(2),
      last ? last.toISOString() : "never",
    ]
      .map(esc)
      .join(",");
  });
  return [header, ...rows].join("\n");
}

export function buildHistoryCsv(
  history: AppStateData["history"],
  displayName: (id: number, name: string) => string,
) {
  const header = "name,path,openedAt";
  const rows = history.map((h) =>
    [
      displayName(h.id, h.name),
      h.path as unknown as string,
      new Date(h.openedAt).toISOString(),
    ]
      .map(esc)
      .join(","),
  );
  return [header, ...rows].join("\n");
}
