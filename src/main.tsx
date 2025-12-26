import React from "react";
import ReactDOM from "react-dom/client";
import "@mantine/core/styles.css";
import { ColorSchemeScript, MantineProvider } from "@mantine/core";
import { BrowserRouter } from "react-router";
import "./main.css";
import { App } from "./core/app/App";
import { ErrorBoundary } from "./core/app/ErrorBoundary";
import { useAppSettings } from "./core/hooks/useAppSettings";

function Root() {
  const { isDarkMode } = useAppSettings();

  const defaultColorScheme = isDarkMode ? "dark" : "light";

  return (
    <>
      {/* Prevent flash of wrong color scheme on load */}
      <ColorSchemeScript defaultColorScheme={defaultColorScheme} />
      <MantineProvider defaultColorScheme={defaultColorScheme}>
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
