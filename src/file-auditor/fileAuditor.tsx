import { Box, Button, Group, Stack, Text } from "@mantine/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppSettings } from "../core/hooks/useAppSettings";
import { DEFAULT_BOOKMARK_COLOR_OPTIONS } from "../types/common";
import * as auditorApi from "../core/api/fileAuditorApi";
import type { AuditFileEntry } from "../core/api/fileAuditorApi";
import "./fileAuditor.css";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

const FileAuditor = () => {
  const { t } = useTranslation();
  const { settings, globalBookmarks, setGlobalBookmarks } = useAppSettings();

  const [files, setFiles] = useState<AuditFileEntry[]>([]);
  const [index, setIndex] = useState(0);
  const [isAuditing, setIsAuditing] = useState(false);
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const indexRef = useRef(0);
  const filesRef = useRef<AuditFileEntry[]>([]);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  const bookmarkColors = (
    settings?.bookmarkColors ?? DEFAULT_BOOKMARK_COLOR_OPTIONS
  ).map((b) => b.hex);

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
    await auditorApi.openAuditFile(f[next].path);
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
    await auditorApi.openAuditFile(remaining[nextIdx].path);
  }, []);

  const setBookmark = useCallback(
    async (slot: number) => {
      const file = filesRef.current[indexRef.current];
      if (!file) return;
      const color = bookmarkColors[slot - 1] ?? null;
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
    setIndex(0);
    indexRef.current = 0;
    setIsAuditing(true);
    await auditorApi.openAuditFile(files[0].path);
  };

  if (isAuditing && currentFile) {
    return (
      <Box className="audit-fullscreen">
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            {index + 1} / {files.length}
          </Text>
          <Button
            size="xs"
            variant="subtle"
            color="red"
            onClick={() => setIsAuditing(false)}
          >
            {t("fileAuditor.stopAudit")}
          </Button>
        </Group>

        <Stack gap="xs" className="audit-file-info">
          {currentBookmark?.color && (
            <Box
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: currentBookmark.color,
              }}
            />
          )}
          <Text size="xl" fw={700} className="audit-filename">
            {currentFile.name}
          </Text>
          <Text size="sm" c="dimmed" className="audit-filepath">
            {currentFile.path}
          </Text>
          <Group gap="md">
            <Text size="xs" c="dimmed">
              {formatBytes(currentFile.size)}
            </Text>
            {currentFile.modifiedAt && (
              <Text size="xs" c="dimmed">
                {new Date(currentFile.modifiedAt).toLocaleString()}
              </Text>
            )}
          </Group>
        </Stack>

        <Stack gap="sm">
          <Group gap="xs" align="center">
            {bookmarkColors.map((hex, i) => (
              <Box
                key={hex}
                onClick={() => setBookmark(i + 1)}
                title={`[${i + 1}]`}
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
            <Text size="xs" c="dimmed">
              {t("fileAuditor.clearBookmark")}
            </Text>
          </Group>
          <Group gap="xl">
            <Text size="sm" c="dimmed">
              {t("fileAuditor.keyPrev")}
            </Text>
            <Text size="sm" c="dimmed">
              {t("fileAuditor.keyNext")}
            </Text>
            <Text size="sm" c="red">
              {t("fileAuditor.keyDelete")}
            </Text>
          </Group>
        </Stack>
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
          {folderPath && (
            <Text
              size="xs"
              c="dimmed"
              style={{
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {folderPath}
            </Text>
          )}
        </Group>
        {files.length > 0 && (
          <Text size="sm">
            {t("fileAuditor.filesFound", { count: files.length })}
          </Text>
        )}
        <Button onClick={handleStart} disabled={!files.length}>
          {t("fileAuditor.startAudit")}
        </Button>
      </Stack>
    </Box>
  );
};

export default FileAuditor;
