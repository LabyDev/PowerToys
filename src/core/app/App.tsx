import { NavBar } from "./NavBar";
import FileRandomiser from "../../file-randomiser/fileRandomiser";
import MainPage from "../mainpage/MainPage";
import { Routes, Route, useLocation } from "react-router";

export function App() {
  const location = useLocation();

  const isAtRoot = location.pathname === "/";

  return (
    <>
      {/* Conditionally render the NavBar */}
      {!isAtRoot && <NavBar />}

      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/FileRandomiser" element={<FileRandomiser />} />
      </Routes>
    </>
  );
}
