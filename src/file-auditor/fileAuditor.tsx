import {
  Box,
  Button,
  Checkbox,
  Divider,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Transition,
} from "@mantine/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppSettings } from "../core/hooks/useAppSettings";
import { DEFAULT_BOOKMARK_COLOR_OPTIONS } from "../types/common";
import * as auditorApi from "../core/api/fileAuditorApi";
import type { AuditFileEntry } from "../core/api/fileAuditorApi";
import "./fileAuditor.css";
import { formatBytes } from "../utils/formatBytes";

const SESSION_KEY = "fileAuditor_session";
type SavedSession = { folderPath: string; index: number; total: number };
const loadSession = (): SavedSession | null => {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null");
  } catch {
    return null;
  }
};
const saveSession = (folderPath: string, index: number, total: number) =>
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ folderPath, index, total }),
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
  const [savedSession, setSavedSession] = useState<SavedSession | null>(null);

  useEffect(() => {
    setSavedSession(loadSession());
  }, []);

  const autoOpenRef = useRef(true);

  useEffect(() => {
    autoOpenRef.current = autoOpen;
  }, [autoOpen]);

  const indexRef = useRef(0);
  const filesRef = useRef<AuditFileEntry[]>([]);

  useEffect(() => {
    indexRef.current = index;
    if (isAuditing && folderPath)
      saveSession(folderPath, index, filesRef.current.length);
  }, [index, isAuditing, folderPath]);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  const bookmarkColors =
    settings?.bookmarkColors ?? DEFAULT_BOOKMARK_COLOR_OPTIONS;

  const currentItemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    currentItemRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [index]);

  type GroupFile = AuditFileEntry & { globalIdx: number };
  const fileGroups = useMemo(() => {
    if (!folderPath || !files.length)
      return [] as { relFolder: string; files: GroupFile[] }[];
    const sep = folderPath.includes("\\") ? "\\" : "/";
    const groups: { relFolder: string; files: GroupFile[] }[] = [];
    let lastFolder = "";
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const parentFull = file.path.substring(0, file.path.lastIndexOf(sep));
      const relFolder = parentFull.startsWith(folderPath)
        ? parentFull.slice(folderPath.length).replace(/^[/\\]/, "") || "."
        : parentFull;
      if (relFolder !== lastFolder) {
        lastFolder = relFolder;
        groups.push({ relFolder, files: [{ ...file, globalIdx: i }] });
      } else {
        groups[groups.length - 1].files.push({ ...file, globalIdx: i });
      }
    }
    return groups;
  }, [files, folderPath]);

  const jumpTo = useCallback(async (idx: number) => {
    const f = filesRef.current;
    if (!f[idx]) return;
    indexRef.current = idx;
    setIndex(idx);
    if (autoOpenRef.current) await auditorApi.openAuditFile(f[idx].path);
  }, []);

  const currentFile = isAuditing ? (files[index] ?? null) : null;
  const currentBookmark = currentFile
    ? globalBookmarks?.find((b) => b.hash === currentFile.hash)
    : null;

  const navigate = useCallback(async (delta: number) => {
    const f = filesRef.current;
    if (!f.length) return;
    const next = Math.max(0, Math.min(indexRef.current + delta, f.length - 1));
    indexRef.current = next;
    setIndex(next);
    if (autoOpenRef.current) await auditorApi.openAuditFile(f[next].path);
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
      setIsAuditing(false);
      return;
    }
    const nextIdx = Math.min(idx, remaining.length - 1);
    indexRef.current = nextIdx;
    setIndex(nextIdx);
    if (autoOpenRef.current)
      await auditorApi.openAuditFile(remaining[nextIdx].path);
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
    const onKey = async (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      switch (e.key.toLowerCase()) {
        case "d":
          await navigate(1);
          break;
        case "a":
          await navigate(-1);
          break;
        case "s":
          await deleteFile();
          break;
        case "0":
          await clearBookmark();
          break;
        case "escape":
          clearSession();
          setIsAuditing(false);
          break;
        default:
          if (e.key >= "1" && e.key <= "5") await setBookmark(Number(e.key));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isAuditing, navigate, deleteFile, setBookmark, clearBookmark]);

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
    clearSession();
    setIndex(0);
    indexRef.current = 0;
    setIsAuditing(true);
    if (autoOpen) await auditorApi.openAuditFile(files[0].path);
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
      if (autoOpenRef.current && result[resumeIdx])
        await auditorApi.openAuditFile(result[resumeIdx].path);
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

  if (isAuditing && currentFile) {
    return (
      <Box className="audit-fullscreen">
        <Group justify="space-between" align="center">
          <Text size="xl" fw={600}>
            {index + 1} / {files.length}
          </Text>
          <Button
            size="xs"
            variant="subtle"
            color="red"
            onClick={() => {
              clearSession();
              setIsAuditing(false);
            }}
          >
            {t("fileAuditor.stopAudit")}
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
                  {t("fileAuditor.clearBookmark")} [0]
                </Button>
              </Group>
              <Group gap="md">
                <Button
                  variant="default"
                  size="md"
                  onClick={() => navigate(-1)}
                >
                  ← {t("fileAuditor.keyPrev")} [A]
                </Button>
                <Button variant="default" size="md" onClick={() => navigate(1)}>
                  {t("fileAuditor.keyNext")} [D] →
                </Button>
                <Button color="red" size="md" onClick={deleteFile}>
                  {t("fileAuditor.keyDelete")} [S]
                </Button>
              </Group>
            </Stack>
          </Box>

          {/* Right column: file tree */}
          <ScrollArea className="audit-file-list" p="xs">
            {fileGroups.map(({ relFolder, files: groupFiles }) => (
              <Box key={relFolder} mb="sm">
                <Divider
                  label={
                    relFolder === "." ? t("fileAuditor.rootFolder") : relFolder
                  }
                  labelPosition="left"
                  mb="xs"
                />
                {groupFiles.map((file) => {
                  const isCurrent = file.globalIdx === index;
                  return (
                    <Box
                      key={file.path}
                      ref={isCurrent ? currentItemRef : undefined}
                      onClick={() => jumpTo(file.globalIdx)}
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
                      <Text size="sm" truncate>
                        {file.name}
                      </Text>
                    </Box>
                  );
                })}
              </Box>
            ))}
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
                  index: savedSession.index + 1,
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
          label={t("fileAuditor.autoOpen")}
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
