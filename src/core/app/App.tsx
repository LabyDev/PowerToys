import { NavBar } from "./NavBar";
import FileRandomiser from "../../file-randomiser/fileRandomiser";
import MainPage from "../mainpage/MainPage";
import { Routes, Route, useLocation } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import FileRandomiserSettings from "../settings/filerandomiserSettings";
import Settings from "../settings/settings";
import { FileRandomiserProvider } from "../hooks/fileRandomiserStateProvider";
import FileSorter from "../../file-sorter/fileSorter";

export function App() {
  const location = useLocation();
  const isAtRoot = location.pathname === "/";

  // Page wrapper for subtle fade+slide
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

  return (
    <>
      <FileRandomiserProvider>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={location.pathname} style={{ height: "100%" }}>
            {!isAtRoot && <NavBar />}
            <Routes location={location} key={location.pathname}>
              <Route
                path="/"
                element={
                  <PageWrapper>
                    <MainPage />
                  </PageWrapper>
                }
              />
              <Route
                path="/FileRandomiser"
                element={
                  <PageWrapper>
                    <FileRandomiser />
                  </PageWrapper>
                }
              />
              <Route
                path="/FileRandomiserSettings"
                element={
                  <PageWrapper>
                    <FileRandomiserSettings />
                  </PageWrapper>
                }
              />

              <Route
                path="/FileSorter"
                element={
                  <PageWrapper>
                    <FileSorter />
                  </PageWrapper>
                }
              />
              <Route
                path="/Settings"
                element={
                  <PageWrapper>
                    <Settings />
                  </PageWrapper>
                }
              />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </FileRandomiserProvider>
    </>
  );
}
