import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "@mantine/core/styles.css";
import { MantineProvider } from "@mantine/core";
import { BrowserRouter, Routes, Route } from "react-router";
import { NavBar } from "./NavBar";
import FileRandomiser from "./file-randomiser/fileRandomiser";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <MantineProvider>
        <NavBar />
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/FileRandomiser" element={<FileRandomiser />} />
        </Routes>
      </MantineProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
