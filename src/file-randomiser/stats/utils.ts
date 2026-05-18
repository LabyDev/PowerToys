import type { TFunction } from "i18next";
import { AppStateData, FileScore } from "../../types/filerandomiser";

// ── Chart style constants ──────────────────────────────────────────────────────

export const ttStyle = {
  background: "#1a1b1e",
  border: "1px solid #373a40",
  borderRadius: 6,
  fontSize: 12,
  color: "#c1c2c5",
};
export const ttLabel = { color: "#909296" };
export const ttItem = { color: "#c1c2c5" };
export const ttCursor = { fill: "rgba(255,255,255,0.04)" };
export const tick = { fontSize: 10, fill: "#909296" };
export const grid = "#2c2e33";
export const CH = 210;

// ── Helpers ───────────────────────────────────────────────────────────────────

export function fmt(n: number, d = 3) {
  return n.toFixed(d);
}

export function relTime(date: Date | undefined, t: TFunction): string {
  if (!date) return t("fileRandomiser.statsWindow.relTime.never");
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return t("fileRandomiser.statsWindow.relTime.today");
  if (days === 1) return t("fileRandomiser.statsWindow.relTime.yesterday");
  if (days < 30)
    return t("fileRandomiser.statsWindow.relTime.daysAgo", { count: days });
  const mo = Math.floor(days / 30);
  if (mo < 12)
    return t("fileRandomiser.statsWindow.relTime.monthsAgo", { count: mo });
  return t("fileRandomiser.statsWindow.relTime.yearsAgo", {
    count: Math.floor(mo / 12),
  });
}

// ── Sort key type ─────────────────────────────────────────────────────────────

export type SortKey =
  | "name"
  | "orderScore"
  | "memoryFactor"
  | "bookmarkFactor"
  | "totalWeight"
  | "pickCount"
  | "lastPicked"
  | "deviation";

// ── Re-exports used across stats files ────────────────────────────────────────

export type { AppStateData, FileScore };
