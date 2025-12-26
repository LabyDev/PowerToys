import React from "react";
import ReactDOM from "react-dom/client";
import "@mantine/core/styles.css";
import { MantineProvider } from "@mantine/core";
import { BrowserRouter } from "react-router";
import "./main.css";
import { App } from "./core/app/App";
import { ErrorBoundary } from "./core/app/ErrorBoundary";
import { useAppSettings } from "./core/hooks/useAppSettings";

function Root() {
  const { isDarkMode } = useAppSettings();
  return (
    <>
      {/* Prevent flash of wrong color scheme on load */}
      <MantineProvider
        defaultColorScheme={isDarkMode ? "dark" : "light"}
        forceColorScheme={isDarkMode ? "dark" : "light"}
      >
        <ErrorBoundary>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ErrorBoundary>
      </MantineProvider>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
