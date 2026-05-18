import { NavBar } from "./NavBar";
import FileRandomiser from "../../file-randomiser/fileRandomiser";
import MainPage from "../mainpage/MainPage";
import { Routes, Route, useLocation } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import FileRandomiserSettings from "../settings/filerandomiserSettings";
import FileAuditorSettings from "../settings/fileAuditorSettings";
import Settings from "../settings/settings";
import { FileRandomiserProvider } from "../hooks/fileRandomiserStateProvider";
import FileSorter from "../../file-sorter/fileSorter";
import FileAuditor from "../../file-auditor/fileAuditor";
import StatsWindow from "../../file-randomiser/statsWindow";

const PageWrapper = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.1 }}
    style={{ height: "100%" }}
  >
    {children}
  </motion.div>
);

const routes = [
  { path: "/", element: <MainPage /> },
  { path: "/FileRandomiser", element: <FileRandomiser /> },
  { path: "/FileRandomiserSettings", element: <FileRandomiserSettings /> },
  { path: "/FileSorter", element: <FileSorter /> },
  { path: "/FileAuditor", element: <FileAuditor /> },
  { path: "/FileAuditorSettings", element: <FileAuditorSettings /> },
  { path: "/Settings", element: <Settings /> },
  { path: "/Stats", element: <StatsWindow /> },
];

export function App() {
  const location = useLocation();
  const isAtRoot = location.pathname === "/";
  const isStats = location.pathname === "/Stats";

  return (
    <FileRandomiserProvider>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={location.pathname} style={{ height: "100%" }}>
          {!isAtRoot && !isStats && <NavBar />}
          <Routes location={location} key={location.pathname}>
            {routes.map(({ path, element }) => (
              <Route
                key={path}
                path={path}
                element={<PageWrapper>{element}</PageWrapper>}
              />
            ))}
          </Routes>
        </motion.div>
      </AnimatePresence>
    </FileRandomiserProvider>
  );
}
