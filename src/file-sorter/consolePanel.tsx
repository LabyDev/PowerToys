import { useState, useEffect, useRef } from "react";
import { Paper, Group, ScrollArea, Text } from "@mantine/core";
import { TerminalIcon } from "@phosphor-icons/react";
import { listen } from "@tauri-apps/api/event";

const ConsolePanel = ({ currentPath }: { currentPath: string | null }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasInitRef = useRef(false);

  const pushLog = (message: string) => {
    setLogs((prev) => [...prev, `> ${message}`]);
  };

  // Auto-scroll on new logs
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
      });
    }
  }, [logs]);

  // Listen to backend logs from Tauri
  useEffect(() => {
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

  // Initial + path change logging (NO DUPLICATES)
  useEffect(() => {
    if (!hasInitRef.current) {
      hasInitRef.current = true;

      if (!currentPath) {
        pushLog("Awaiting folder...");
      }
      return;
    }

    if (currentPath) {
      pushLog(`Directory set: ${currentPath}`);
    }
  }, [currentPath]);

  return (
    <Paper
      withBorder
      radius="md"
      bg="dark.8"
      style={{ height: 200, overflow: "hidden" }}
    >
      <Group px="sm" py={6} bg="dark.9">
        <TerminalIcon size={14} color="white" />
      </Group>

      <ScrollArea h={200} p="xs" viewportRef={scrollRef}>
        {logs.map((line, i) => (
          <Text key={i} size="xs" ff="monospace" c="blue.3">
            {line}
          </Text>
        ))}
      </ScrollArea>
    </Paper>
  );
};

export default ConsolePanel;
