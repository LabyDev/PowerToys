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
    "name,isExcluded,orderProximity,memoryFactor,bookmarkFactor,totalWeight,picks,expectedPct,actualPct,delta%,lastSeen";
  const rows = scores.map((s) => {
    const picks = pickCounts[String(s.id)] ?? 0;
    const expectedPct =
      totalIncludedWeight > 0 ? (s.totalWeight / totalIncludedWeight) * 100 : 0;
    const actualPct = totalPicks > 0 ? (picks / totalPicks) * 100 : 0;
    const last = lastPickedMap.get(s.id);
    return [
      displayName(s.id, s.name),
      s.isExcluded,
      s.orderScore.toFixed(4),
      s.memoryFactor,
      s.bookmarkFactor,
      s.totalWeight,
      picks,
      expectedPct.toFixed(3),
      actualPct.toFixed(3),
      (actualPct - expectedPct).toFixed(2),
      last ? last.toISOString() : "never",
    ]
      .map(esc)
      .join(",");
  });
  return [header, ...rows].join("\n");
}

export function buildDiagnosticsCsv(
  history: AppStateData["history"],
  displayName: (id: number, name: string) => string,
) {
  const header = [
    "pickNumber",
    "openedAt",
    "name",
    "randomnessLevel",
    "candidates",
    "bookmarkPrefEnabled",
    "recencyWindow",
    "recencyPenalised",
    "weightMin",
    "weightMax",
    "weightMean",
    "weightMedian",
    "bookmarkedCount",
    "bookmarkedMean",
    "unbookmarkedCount",
    "unbookmarkedMean",
    "chosenWeight",
    "chosenOrderScore",
    "chosenMemoryFactor",
    "chosenColorStreakFactor",
    "chosenFolderStreakFactor",
    "chosenBookmarkColor",
    "chosenBookmarkGlobal",
  ].join(",");
  const sorted = [...history].sort(
    (a, b) => new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime(),
  );
  const rows = sorted
    .map((h, i) => {
      const d = h.diagnostics;
      if (!d) return null;
      return [
        i + 1,
        new Date(h.openedAt).toISOString(),
        displayName(h.id, h.name),
        d.randomnessLevel,
        d.candidates,
        d.bookmarkPrefEnabled,
        d.recencyWindow,
        d.recencyPenalised,
        d.weightMin,
        d.weightMax,
        d.weightMean,
        d.weightMedian,
        d.bookmarkedCount,
        d.bookmarkedMean,
        d.unbookmarkedCount,
        d.unbookmarkedMean,
        d.chosenWeight,
        d.chosenOrderScore,
        d.chosenMemoryFactor,
        d.chosenColorStreakFactor ?? 1,
        d.chosenFolderStreakFactor ?? 1,
        d.chosenBookmarkColor ?? "",
        d.chosenBookmarkGlobal,
      ]
        .map(esc)
        .join(",");
    })
    .filter((r): r is string => r !== null);
  return [header, ...rows].join("\n");
}

export function buildHistoryCsv(
  history: AppStateData["history"],
  displayName: (id: number, name: string) => string,
) {
  const header = "pickNumber,name,openedAt";
  const sorted = [...history].sort(
    (a, b) => new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime(),
  );
  const rows = sorted.map((h, i) =>
    [i + 1, displayName(h.id, h.name), new Date(h.openedAt).toISOString()]
      .map(esc)
      .join(","),
  );
  return [header, ...rows].join("\n");
}
