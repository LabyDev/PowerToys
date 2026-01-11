import { useState, useEffect, useRef } from "react";
import { Paper, Group, ScrollArea, Text } from "@mantine/core";
import { TerminalIcon } from "@phosphor-icons/react";
import { listen } from "@tauri-apps/api/event";

const ConsolePanel = ({ currentPath }: { currentPath: string | null }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // --- HARD GUARDS ---
  const listenerRegisteredRef = useRef(false);
  const lastLogRef = useRef<string | null>(null);
  const lastPathRef = useRef<string | null>(null);
  const didLogAwaitingRef = useRef(false);

  const pushLog = (message: string) => {
    // Collapse identical consecutive logs
    if (message === lastLogRef.current) return;

    lastLogRef.current = message;
    setLogs((prev) => [...prev, `> ${message}`]);
  };

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [logs]);

  // Listen to backend logs — STRICTMODE SAFE
  useEffect(() => {
    if (listenerRegisteredRef.current) return;
    listenerRegisteredRef.current = true;

    let unlisten: (() => void) | null = null;

    listen<string>("file_sorter_log", (event) => {
      pushLog(event.payload);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // Path-based logging (fully deduped)
  useEffect(() => {
    if (!currentPath) {
      if (!didLogAwaitingRef.current) {
        didLogAwaitingRef.current = true;
        pushLog("Awaiting folder...");
      }
      lastPathRef.current = null;
      return;
    }

    if (currentPath !== lastPathRef.current) {
      lastPathRef.current = currentPath;
      pushLog(`Directory set: ${currentPath}`);
    }
  }, [currentPath]);

  return (
    <Paper
      withBorder
      radius="md"
      bg="dark.8"
      style={{
        height: "25vh",
        minHeight: 160,
        maxHeight: 320,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <Group px="sm" py={6} bg="dark.9">
        <TerminalIcon size={14} color="white" />
      </Group>

      <ScrollArea
        style={{ flex: 1 }}
        p="xs"
        viewportRef={scrollRef}
        offsetScrollbars
      >
        {logs.map((line, i) => (
          <Text key={i} size="xs" ff="monospace" c="blue.3" mb={2}>
            {line}
          </Text>
        ))}

        {/* bottom breathing room */}
        <div style={{ height: 12 }} />
      </ScrollArea>
    </Paper>
  );
};

export default ConsolePanel;
