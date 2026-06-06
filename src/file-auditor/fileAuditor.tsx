import {
  ActionIcon,
  Box,
  Button,
  Checkbox,
  Divider,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
  Transition,
} from "@mantine/core";
import { BookmarkIcon, FolderOpenIcon } from "@phosphor-icons/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppSettings } from "../core/hooks/useAppSettings";
import { DEFAULT_BOOKMARK_COLOR_OPTIONS } from "../types/common";
import * as auditorApi from "../core/api/fileAuditorApi";
import type { AuditFileEntry } from "../core/api/fileAuditorApi";
import {
  register as registerShortcut,
  unregister as unregisterShortcut,
} from "@tauri-apps/plugin-global-shortcut";
import "./fileAuditor.css";
import { formatBytes } from "../utils/formatBytes";
import { displayKey } from "../utils/displayKey";
import { DEFAULT_AUDITOR_KEYBINDS } from "./auditorKeybinds";

function toAccelerator(key: string): string {
  if (key.length === 1) return key.toUpperCase();
  return key;
}

const SESSION_KEY = "fileAuditor_session";
type SavedSession = {
  folderPath: string;
  index: number;
  total: number;
  displayIndex?: number;
};
const loadSession = (): SavedSession | null => {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null");
  } catch {
    return null;
  }
};
const saveSession = (
  folderPath: string,
  index: number,
  total: number,
  displayIndex?: number,
) =>
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ folderPath, index, total, displayIndex }),
  );
const clearSession = () => localStorage.removeItem(SESSION_KEY);

const FileAuditor = () => {
  const { t } = useTranslation();
  const { settings, globalBookmarks, setGlobalBookmarks } = useAppSettings();

  const [files, setFiles] = useState<AuditFileEntry[]>([]);
  const [index, setIndex] = useState(0);
  const [isAuditing, setIsAuditing] = useState(false);
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [autoOpen, setAutoOpen] = useState(true);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [savedSession, setSavedSession] = useState<SavedSession | null>(null);

  useEffect(() => {
    setSavedSession(loadSession());
  }, []);

  const autoOpenRef = useRef(true);
  const trackingEnabledRef = useRef(false);
  const sortedIndicesRef = useRef<number[]>([]);

  useEffect(() => {
    autoOpenRef.current = autoOpen;
  }, [autoOpen]);

  useEffect(() => {
    trackingEnabledRef.current =
      settings?.fileAuditor?.allowProcessTracking ?? false;
  }, [settings?.fileAuditor?.allowProcessTracking]);

  const indexRef = useRef(0);
  const filesRef = useRef<AuditFileEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  type GroupFile = AuditFileEntry & { globalIdx: number };
  const fileGroups = useMemo(() => {
    if (!folderPath || !files.length)
      return [] as { relFolder: string; files: GroupFile[] }[];
    const sep = folderPath.includes("\\") ? "\\" : "/";
    const map = new Map<string, GroupFile[]>();
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const parentFull = file.path.substring(0, file.path.lastIndexOf(sep));
      const relFolder = parentFull.startsWith(folderPath)
        ? parentFull.slice(folderPath.length).replace(/^[/\\]/, "") || "."
        : parentFull;
      const group = map.get(relFolder);
      if (group) group.push({ ...file, globalIdx: i });
      else map.set(relFolder, [{ ...file, globalIdx: i }]);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => {
        if (a === ".") return -1;
        if (b === ".") return 1;
        return a.localeCompare(b);
      })
      .map(([relFolder, files]) => ({ relFolder, files }));
  }, [files, folderPath]);

  const sortedPos = useMemo(
    () =>
      fileGroups.flatMap((g) => g.files.map((f) => f.globalIdx)).indexOf(index),
    [fileGroups, index],
  );

  useEffect(() => {
    indexRef.current = index;
    if (isAuditing && folderPath) {
      saveSession(
        folderPath,
        index,
        filesRef.current.length,
        sortedPos >= 0 ? sortedPos : undefined,
      );
    }
  }, [index, isAuditing, folderPath, sortedPos]);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  const bookmarkColors =
    settings?.bookmarkColors ?? DEFAULT_BOOKMARK_COLOR_OPTIONS;

  useEffect(() => {
    sortedIndicesRef.current = fileGroups.flatMap((g) =>
      g.files.map((f) => f.globalIdx),
    );
  }, [fileGroups]);

  type VirtualRow =
    | { type: "header"; label: string; key: string }
    | { type: "file"; file: GroupFile; key: string };

  const virtualRows = useMemo<VirtualRow[]>(
    () =>
      fileGroups.flatMap(({ relFolder, files: gf }) => [
        {
          type: "header" as const,
          label: relFolder === "." ? t("fileAuditor.rootFolder") : relFolder,
          key: `h:${relFolder}`,
        },
        ...gf.map((file) => ({ type: "file" as const, file, key: file.path })),
      ]),
    [fileGroups, t],
  );

  const rowVirtualizer = useVirtualizer({
    count: virtualRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => (virtualRows[i]?.type === "header" ? 36 : 30),
    overscan: 15,
  });

  useEffect(() => {
    const idx = virtualRows.findIndex(
      (r) => r.type === "file" && r.file.globalIdx === index,
    );
    if (idx !== -1) rowVirtualizer.scrollToIndex(idx, { align: "auto" });
  }, [index]);

  const jumpTo = useCallback(async (idx: number) => {
    const f = filesRef.current;
    if (!f[idx]) return;
    if (
      trackingEnabledRef.current &&
      idx !== indexRef.current &&
      f[indexRef.current]
    )
      await auditorApi.closeTrackedFile(f[indexRef.current].path);
    indexRef.current = idx;
    setIndex(idx);
    if (autoOpenRef.current) {
      await auditorApi.openAuditFile(f[idx].path, trackingEnabledRef.current);
      setViewerOpen(true);
    }
  }, []);

  const currentFile = isAuditing ? (files[index] ?? null) : null;
  const currentBookmark = currentFile
    ? globalBookmarks?.find((b) => b.hash === currentFile.hash)
    : null;

  const navigate = useCallback(async (delta: number) => {
    const f = filesRef.current;
    const order = sortedIndicesRef.current;
    if (!f.length || !order.length) return;
    const currentPos = order.indexOf(indexRef.current);
    const startPos = currentPos === -1 ? 0 : currentPos;
    const nextPos = Math.max(0, Math.min(startPos + delta, order.length - 1));
    const next = order[nextPos];
    if (trackingEnabledRef.current && f[indexRef.current])
      await auditorApi.closeTrackedFile(f[indexRef.current].path);
    indexRef.current = next;
    setIndex(next);
    if (autoOpenRef.current) {
      await auditorApi.openAuditFile(f[next].path, trackingEnabledRef.current);
      setViewerOpen(true);
    }
  }, []);

  const deleteFile = useCallback(async () => {
    const f = filesRef.current;
    const idx = indexRef.current;
    const file = f[idx];
    if (!file) return;

    try {
      await auditorApi.deleteToTrash(file.path);
    } catch (err) {
      console.error("Delete failed:", err);
      return;
    }

    const remaining = f.filter((_, i) => i !== idx);
    filesRef.current = remaining;
    setFiles(remaining);

    if (!remaining.length) {
      setViewerOpen(false);
      setIsAuditing(false);
      return;
    }

    // Find next file in sorted visual order, skipping the deleted entry.
    // sortedIndicesRef still has old indices; map them to remaining via path lookup.
    const remainingPaths = new Set(remaining.map((x) => x.path));
    const nextSorted = sortedIndicesRef.current
      .filter((gi) => f[gi] && remainingPaths.has(f[gi].path))
      .map((gi) => remaining.findIndex((x) => x.path === f[gi].path));
    const sortedPos = sortedIndicesRef.current.indexOf(idx);
    // Pick the candidate at the same sorted position, or the last one
    const nextIdx =
      nextSorted[Math.min(sortedPos, nextSorted.length - 1)] ??
      Math.min(idx, remaining.length - 1);

    indexRef.current = nextIdx;
    setIndex(nextIdx);
    if (autoOpenRef.current) {
      await auditorApi.openAuditFile(
        remaining[nextIdx].path,
        trackingEnabledRef.current,
      );
      setViewerOpen(true);
    }
  }, []);

  const setBookmark = useCallback(
    async (slot: number) => {
      const file = filesRef.current[indexRef.current];
      if (!file) return;
      const color = bookmarkColors[slot - 1]?.hex ?? null;
      const existing = globalBookmarks ?? [];
      const without = existing.filter((b) => b.hash !== file.hash);
      await setGlobalBookmarks(
        color
          ? [...without, { path: file.path, hash: file.hash, color }]
          : without,
      );
    },
    [bookmarkColors, globalBookmarks, setGlobalBookmarks],
  );

  const clearBookmark = useCallback(async () => {
    const file = filesRef.current[indexRef.current];
    if (!file) return;
    await setGlobalBookmarks(
      (globalBookmarks ?? []).filter((b) => b.hash !== file.hash),
    );
  }, [globalBookmarks, setGlobalBookmarks]);

  useEffect(() => {
    if (!isAuditing) return;
    const kb = settings?.fileAuditor?.keybinds ?? DEFAULT_AUDITOR_KEYBINDS;
    const onKey = async (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const key = e.key.toLowerCase();
      if (key === kb.prev.toLowerCase()) await navigate(-1);
      else if (key === kb.next.toLowerCase()) await navigate(1);
      else if (key === kb.delete.toLowerCase()) await deleteFile();
      else if (key === kb.clearBookmark.toLowerCase()) await clearBookmark();
      else if (
        (kb.closeViewer ?? "w").toLowerCase() === key &&
        autoOpenRef.current &&
        filesRef.current[indexRef.current] &&
        !(
          (settings?.fileAuditor?.globalCloseViewerShortcut ?? false) &&
          (settings?.fileAuditor?.allowProcessTracking ?? false)
        )
      ) {
        setViewerOpen(false);
        await auditorApi.closeTrackedFile(
          filesRef.current[indexRef.current].path,
        );
      } else if (key === kb.stop.toLowerCase()) {
        if (trackingEnabledRef.current && filesRef.current[indexRef.current])
          await auditorApi.forgetTrackedFile(
            filesRef.current[indexRef.current].path,
          );
        clearSession();
        setIsAuditing(false);
      } else {
        const effectiveBookmarkKeys = bookmarkColors.map(
          (_, i) => kb.bookmarks[i] ?? String(i + 1),
        );
        const slot = effectiveBookmarkKeys.findIndex(
          (k) => k.toLowerCase() === key,
        );
        if (slot !== -1) await setBookmark(slot + 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isAuditing, navigate, deleteFile, setBookmark, clearBookmark, settings]);

  const allowTracking = settings?.fileAuditor?.allowProcessTracking ?? false;

  useEffect(() => {
    const globalEnabled =
      settings?.fileAuditor?.globalCloseViewerShortcut ?? false;
    if (
      !isAuditing ||
      !autoOpen ||
      !allowTracking ||
      !globalEnabled ||
      !viewerOpen
    )
      return;
    const kb = settings?.fileAuditor?.keybinds ?? DEFAULT_AUDITOR_KEYBINDS;
    const accelerator = toAccelerator(kb.closeViewer ?? "w");
    registerShortcut(accelerator, (event) => {
      if (event.state !== "Pressed") return;
      const f = filesRef.current[indexRef.current];
      if (f) {
        setViewerOpen(false);
        auditorApi.closeTrackedFile(f.path);
      }
    }).catch(console.error);
    return () => {
      unregisterShortcut(accelerator).catch(() => {});
    };
  }, [isAuditing, autoOpen, allowTracking, settings, viewerOpen]);

  const handlePickFolder = async () => {
    const path = await auditorApi.pickAuditFolder();
    if (!path) return;
    setFolderPath(path);
    setIsLoading(true);
    try {
      const result = await auditorApi.auditListFiles(path);
      setFiles(result);
      filesRef.current = result;
    } finally {
      setIsLoading(false);
    }
  };

  const handleStart = async () => {
    if (!files.length) return;
    const startIdx = sortedIndicesRef.current[0] ?? 0;
    clearSession();
    setIndex(startIdx);
    indexRef.current = startIdx;
    setIsAuditing(true);
    if (autoOpen) {
      await auditorApi.openAuditFile(
        files[startIdx].path,
        trackingEnabledRef.current,
      );
      setViewerOpen(true);
    }
  };

  const handleResume = async () => {
    if (!savedSession) return;
    setFolderPath(savedSession.folderPath);
    setIsLoading(true);
    try {
      const result = await auditorApi.auditListFiles(savedSession.folderPath);
      setFiles(result);
      filesRef.current = result;
      const resumeIdx = Math.min(savedSession.index, result.length - 1);
      setIndex(resumeIdx);
      indexRef.current = resumeIdx;
      setIsAuditing(true);
      if (autoOpenRef.current && result[resumeIdx]) {
        await auditorApi.openAuditFile(
          result[resumeIdx].path,
          trackingEnabledRef.current,
        );
        setViewerOpen(true);
      }
      setSavedSession(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDiscard = () => {
    clearSession();
    setSavedSession(null);
  };

  const bookmarkColor = currentBookmark?.color ?? null;
  const kb = settings?.fileAuditor?.keybinds ?? DEFAULT_AUDITOR_KEYBINDS;

  if (isAuditing && currentFile) {
    return (
      <Box className="audit-fullscreen">
        <Group justify="space-between" align="center">
          <Text size="xl" fw={600}>
            {Math.max(0, sortedPos) + 1} / {files.length}
          </Text>
          <Button
            size="xs"
            variant="subtle"
            color="red"
            onClick={async () => {
              if (
                trackingEnabledRef.current &&
                filesRef.current[indexRef.current]
              )
                await auditorApi.forgetTrackedFile(
                  filesRef.current[indexRef.current].path,
                );
              clearSession();
              setIsAuditing(false);
            }}
          >
            {t("fileAuditor.stopAudit")} [{displayKey(kb.stop)}]
          </Button>
        </Group>

        <Box className="audit-body">
          {/* Left column: file info + controls */}
          <Box className="audit-left">
            <Box
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <Stack gap="xs" className="audit-file-info">
                <Transition
                  mounted={!!bookmarkColor}
                  transition="fade"
                  duration={200}
                >
                  {(styles) => (
                    <Box
                      style={{
                        ...styles,
                        display: "inline-block",
                        alignSelf: "flex-start",
                        background: (bookmarkColor ?? "#888") + "28",
                        border: `1px solid ${bookmarkColor ?? "#888"}`,
                        borderRadius: 4,
                        padding: "2px 10px",
                        color: bookmarkColor ?? "#888",
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                      }}
                    >
                      {t("fileAuditor.bookmarked")}
                    </Box>
                  )}
                </Transition>
                <Text
                  fw={700}
                  className="audit-filename"
                  style={{ fontSize: "2rem" }}
                >
                  {currentFile.name}
                </Text>
                <Text size="md" c="dimmed" className="audit-filepath">
                  {currentFile.path}
                </Text>
                <Group gap="md">
                  <Text size="sm" c="dimmed">
                    {formatBytes(currentFile.size)}
                  </Text>
                  {currentFile.modifiedAt && (
                    <Text size="sm" c="dimmed">
                      {new Date(currentFile.modifiedAt).toLocaleString()}
                    </Text>
                  )}
                </Group>
              </Stack>
            </Box>

            <Stack gap="sm">
              <Group gap="xs" align="center">
                {bookmarkColors.map(({ hex, label }, i) => (
                  <Box
                    key={hex}
                    onClick={() => setBookmark(i + 1)}
                    title={`${label} [${i + 1}]`}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: hex,
                      cursor: "pointer",
                      border:
                        currentBookmark?.color === hex
                          ? "3px solid white"
                          : "2px solid transparent",
                      outline:
                        currentBookmark?.color === hex
                          ? "2px solid rgba(255,255,255,0.4)"
                          : "none",
                    }}
                  />
                ))}
                <Button size="xs" variant="subtle" onClick={clearBookmark}>
                  {t("fileAuditor.clearBookmark")} [
                  {displayKey(kb.clearBookmark)}]
                </Button>
              </Group>
              <Group gap="md">
                <Button
                  variant="default"
                  size="md"
                  onClick={() => navigate(-1)}
                >
                  ← {t("fileAuditor.keyPrev")} [{displayKey(kb.prev)}]
                </Button>
                <Button variant="default" size="md" onClick={() => navigate(1)}>
                  {t("fileAuditor.keyNext")} [{displayKey(kb.next)}] →
                </Button>
                <Button color="red" size="md" onClick={deleteFile}>
                  {t("fileAuditor.keyDelete")} [{displayKey(kb.delete)}]
                </Button>
                {autoOpen && allowTracking && (
                  <Button
                    variant="default"
                    size="md"
                    onClick={async () => {
                      const f = filesRef.current[indexRef.current];
                      if (f) {
                        setViewerOpen(false);
                        await auditorApi.closeTrackedFile(f.path);
                      }
                    }}
                  >
                    {t("fileAuditor.keyCloseViewer")} [
                    {displayKey(kb.closeViewer ?? "w")}]
                  </Button>
                )}
              </Group>
            </Stack>
          </Box>

          {/* Right column: file tree */}
          <ScrollArea
            className="audit-file-list"
            p="xs"
            viewportRef={scrollRef}
          >
            <Box
              style={{
                height: rowVirtualizer.getTotalSize(),
                position: "relative",
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                const row = virtualRows[virtualItem.index];
                return (
                  <Box
                    key={row.key}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    {row.type === "header" ? (
                      <Divider
                        label={row.label}
                        labelPosition="left"
                        mt={virtualItem.index > 0 ? "sm" : 0}
                        mb="xs"
                      />
                    ) : (
                      (() => {
                        const { file } = row;
                        const isCurrent = file.globalIdx === index;
                        const fileBm = globalBookmarks?.find(
                          (b) => b.hash === file.hash,
                        );
                        return (
                          <Box
                            onClick={() => jumpTo(file.globalIdx)}
                            className="audit-item"
                            style={{
                              padding: "5px 8px 5px 14px",
                              borderRadius: 4,
                              cursor: "pointer",
                              borderLeft: `3px solid ${isCurrent ? "var(--mantine-color-blue-6)" : "transparent"}`,
                              background: isCurrent
                                ? "rgba(34,139,230,0.12)"
                                : "transparent",
                              fontWeight: isCurrent ? 600 : 400,
                              transition: "background 0.15s ease",
                            }}
                          >
                            <Group gap={4} align="center" wrap="nowrap">
                              <Text size="sm" truncate style={{ flex: 1 }}>
                                {file.name}
                              </Text>
                              {fileBm && (
                                <BookmarkIcon
                                  size={18}
                                  weight="fill"
                                  style={{
                                    color: fileBm.color ?? undefined,
                                    flexShrink: 0,
                                  }}
                                />
                              )}
                              <Tooltip
                                label={t("fileAuditor.revealInFolder")}
                                withArrow
                              >
                                <ActionIcon
                                  size="xs"
                                  variant="subtle"
                                  className="audit-item-action"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    auditorApi.revealInExplorer(file.path);
                                  }}
                                >
                                  <FolderOpenIcon size={12} />
                                </ActionIcon>
                              </Tooltip>
                            </Group>
                          </Box>
                        );
                      })()
                    )}
                  </Box>
                );
              })}
            </Box>
          </ScrollArea>
        </Box>
      </Box>
    );
  }

  return (
    <Box p="md" h="92vh" className="audit-setup">
      <Stack gap="md" style={{ maxWidth: 480, width: "100%" }}>
        <Text size="xl" fw={700}>
          {t("fileAuditor.title")}
        </Text>
        <Text size="sm" c="dimmed">
          {t("fileAuditor.description")}
        </Text>
        <Group>
          <Button onClick={handlePickFolder} loading={isLoading}>
            {folderPath
              ? t("fileAuditor.changeFolder")
              : t("fileAuditor.pickFolder")}
          </Button>
          <Transition mounted={!!folderPath} transition="fade" duration={250}>
            {(styles) => (
              <Text
                size="xs"
                c="dimmed"
                style={{
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  ...styles,
                }}
              >
                {folderPath}
              </Text>
            )}
          </Transition>
        </Group>
        {files.length > 0 && (
          <Text size="sm">
            {t("fileAuditor.filesFound", { count: files.length })}
          </Text>
        )}
        {savedSession && (
          <Paper withBorder p="md" radius="md">
            <Stack gap="xs">
              <Text fw={600}>{t("fileAuditor.resumeSession")}</Text>
              <Text size="sm" c="dimmed" truncate>
                {t("fileAuditor.resumeFolder", {
                  path: savedSession.folderPath,
                })}
              </Text>
              <Text size="sm">
                {t("fileAuditor.resumeFrom", {
                  index: (savedSession.displayIndex ?? savedSession.index) + 1,
                  total: savedSession.total,
                })}
              </Text>
              <Group gap="xs">
                <Button size="xs" onClick={handleResume} loading={isLoading}>
                  {t("fileAuditor.resume")}
                </Button>
                <Button
                  size="xs"
                  variant="subtle"
                  color="red"
                  onClick={handleDiscard}
                >
                  {t("fileAuditor.discardSession")}
                </Button>
              </Group>
            </Stack>
          </Paper>
        )}
        <Checkbox
          label={
            settings?.fileAuditor?.allowProcessTracking
              ? t("fileAuditor.autoOpenTracked")
              : t("fileAuditor.autoOpen")
          }
          description={t("fileAuditor.autoOpenDescription")}
          checked={autoOpen}
          onChange={(e) => setAutoOpen(e.currentTarget.checked)}
        />
        <Button onClick={handleStart} disabled={!files.length}>
          {t("fileAuditor.startAudit")}
        </Button>
      </Stack>
    </Box>
  );
};

export default FileAuditor;
